/**
 * Quote fan-out — parallel public venue REST fetches with TTL cache + mock fallback.
 */

import type { ExchangeId } from './exchanges';
import {
  arbVenueIds,
  buildVenueSnapshot,
  parseCoinbaseBestBidAsk,
  parseGeminiPubTicker,
  parseKrakenTicker,
  snapshotsFromFixture,
  type VenueGoldSnapshot,
} from './venueQuotes';
import venueQuotesFixture from './__fixtures__/venueQuotes.json';

export const COINBASE_BEST_BID_ASK_URL =
  'https://api.coinbase.com/api/v3/brokerage/best_bid_ask?product_ids=PAXG-USD,XAUT-USD';
export const KRAKEN_TICKER_URL =
  'https://api.kraken.com/0/public/Ticker?pair=PAXGUSD,XAUTUSD,PAXGXAUT';
export const GEMINI_PAXG_TICKER_URL = 'https://api.gemini.com/v1/pubticker/paxgusd';

const DEFAULT_TTL_MS = 15_000;

export type VenueFetcher = (url: string, signal?: AbortSignal) => Promise<unknown>;

export interface VenueQuoteFanoutOptions {
  signal?: AbortSignal;
  ttlMs?: number;
  forceRefresh?: boolean;
  useMock?: boolean;
  /** CoinGecko mids for estimated fallback when a venue leg is missing. */
  indexMids?: { paxg?: number; xaut?: number };
  fetcher?: VenueFetcher;
}

export interface VenueQuoteFanoutResult {
  snapshots: VenueGoldSnapshot[];
  fetchedAt: number;
  isMock: boolean;
  errors: string[];
}

interface CacheEntry {
  result: VenueQuoteFanoutResult;
  savedAt: number;
}

let cache: CacheEntry | null = null;
let inFlight: Promise<VenueQuoteFanoutResult> | null = null;

async function defaultFetcher(url: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  return res.json() as Promise<unknown>;
}

function mockResult(): VenueQuoteFanoutResult {
  return {
    snapshots: snapshotsFromFixture(venueQuotesFixture as Parameters<typeof snapshotsFromFixture>[0]),
    fetchedAt: Date.now(),
    isMock: true,
    errors: [],
  };
}

async function fetchVenueLegs(
  venueId: ExchangeId,
  fetcher: VenueFetcher,
  signal?: AbortSignal,
): Promise<{
  legs: Parameters<typeof buildVenueSnapshot>[1];
  error?: string;
}> {
  const ts = Date.now();
  try {
    if (venueId === 'coinbase') {
      const json = await fetcher(COINBASE_BEST_BID_ASK_URL, signal);
      return { legs: parseCoinbaseBestBidAsk(json, ts, 'live') };
    }
    if (venueId === 'kraken') {
      const json = await fetcher(KRAKEN_TICKER_URL, signal);
      return { legs: parseKrakenTicker(json, ts, 'live') };
    }
    if (venueId === 'gemini') {
      const json = await fetcher(GEMINI_PAXG_TICKER_URL, signal);
      return { legs: parseGeminiPubTicker(json, ts, 'live') };
    }
    return { legs: {}, error: `Unsupported venue: ${venueId}` };
  } catch (err) {
    return {
      legs: {},
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function fetchAllSnapshots(
  opts: VenueQuoteFanoutOptions,
): Promise<VenueQuoteFanoutResult> {
  if (opts.useMock) return mockResult();

  const fetcher = opts.fetcher ?? defaultFetcher;
  const indexMids = opts.indexMids;
  const errors: string[] = [];
  const snapshots: VenueGoldSnapshot[] = [];

  const results = await Promise.all(
    arbVenueIds().map(async (venueId) => {
      const { legs, error } = await fetchVenueLegs(venueId, fetcher, opts.signal);
      if (error) errors.push(`${venueId}: ${error}`);
      const snap = buildVenueSnapshot(venueId, legs, indexMids, 'estimated');
      return snap;
    }),
  );

  for (const snap of results) {
    if (snap) snapshots.push(snap);
  }

  if (snapshots.length === 0) {
    const mock = mockResult();
    return { ...mock, errors };
  }

  return {
    snapshots,
    fetchedAt: Date.now(),
    isMock: false,
    errors,
  };
}

/** Fetch venue gold quotes with TTL cache and in-flight dedupe. */
export function getVenueGoldSnapshots(
  opts: VenueQuoteFanoutOptions = {},
): Promise<VenueQuoteFanoutResult> {
  const { ttlMs = DEFAULT_TTL_MS, forceRefresh = false } = opts;

  if (opts.useMock) return Promise.resolve(mockResult());

  if (!forceRefresh && cache && Date.now() - cache.savedAt < ttlMs) {
    return Promise.resolve(cache.result);
  }

  if (!forceRefresh && inFlight) return inFlight;

  inFlight = fetchAllSnapshots(opts).then((result) => {
    if (!result.isMock && result.snapshots.length > 0) {
      cache = { result, savedAt: Date.now() };
    }
    return result;
  }).finally(() => {
    inFlight = null;
  });

  return inFlight;
}

/** Clear fan-out cache (tests / force refresh). */
export function clearVenueQuoteCache(): void {
  cache = null;
  inFlight = null;
}

/** Snapshot cache stats for tests. */
export function getVenueQuoteCacheStats(): { cached: boolean; inFlight: boolean } {
  return { cached: cache != null, inFlight: inFlight != null };
}
