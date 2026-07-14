/**
 * Shared market-history cache for CoinGecko `/market_chart` series (issue #34).
 *
 * Analytics panels (FiscalYearChart, TradeReplayChart, PerformanceComparison,
 * regime analysis, gold-comparison overlays) all request the same
 * `(cgId, days, interval)` series. Without coordination that means duplicate
 * network calls and CoinGecko free-tier rate-limit risk on a full page load.
 *
 * This module adds, around the existing `fetchMarketChartSeries`:
 *  - an in-memory TTL cache keyed by `(cgId, days, interval)`
 *  - in-flight promise de-dupe (concurrent identical requests share one fetch)
 *  - per-caller AbortSignal that cancels the *waiter* without killing the shared
 *    fetch other callers depend on
 *  - invalidate / clear for force-refresh (e.g. keyboard "R")
 *  - optional last-good persistence to sessionStorage for an offline hybrid
 *
 * Pure enough to unit-test: the network call is injectable via `opts.fetcher`.
 */

import { fetchMarketChartSeries } from './api';

export type MarketSeries = [number, number][];

export type MarketFetcher = (
  cgId: string,
  days: string,
  interval: string,
  signal?: AbortSignal,
  apiKey?: string,
) => Promise<MarketSeries>;

export interface MarketCacheEntry {
  data: MarketSeries;
  savedAt: number;
}

export interface GetMarketChartOptions {
  signal?: AbortSignal;
  apiKey?: string;
  /** Cache lifetime in ms (default 10 min). */
  ttlMs?: number;
  /** Skip the cached value and fetch fresh (still de-duped with other refreshes). */
  forceRefresh?: boolean;
  /** Persist/read last-good series to sessionStorage (default true). */
  persist?: boolean;
  /** Injectable network call — defaults to the real CoinGecko fetch. */
  fetcher?: MarketFetcher;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const PERSIST_PREFIX = 'gt-mkt::';

const cache = new Map<string, MarketCacheEntry>();
const inFlight = new Map<string, Promise<MarketSeries>>();

function keyOf(cgId: string, days: string, interval: string): string {
  return `${cgId}::${days}::${interval}`;
}

class AbortError extends Error {
  constructor() {
    super('The operation was aborted');
    this.name = 'AbortError';
  }
}

/** A rejected promise carrying an AbortError (throw form keeps the lint rule happy). */
async function rejectedAbort(): Promise<never> {
  throw new AbortError();
}

/** Reject if/when the caller's signal aborts, without disturbing the shared fetch. */
function raceWithSignal<T>(p: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return p;
  if (signal.aborted) return rejectedAbort();
  // Race the shared fetch against this caller's abort. Losing the race does not
  // cancel `p`, so other waiters on the same shared fetch are unaffected.
  const abortPromise = new Promise<never>((_, reject) => {
    signal.addEventListener('abort', () => reject(new AbortError()), { once: true });
  });
  return Promise.race([p, abortPromise]);
}

function persistSeries(k: string, data: MarketSeries): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(PERSIST_PREFIX + k, JSON.stringify({ data, savedAt: Date.now() }));
  } catch {
    // storage full / unavailable — non-fatal
  }
}

function readPersisted(k: string): MarketCacheEntry | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PERSIST_PREFIX + k);
    return raw ? (JSON.parse(raw) as MarketCacheEntry) : null;
  } catch {
    return null;
  }
}

function removePersisted(k: string): void {
  if (typeof sessionStorage === 'undefined') return;
  try { sessionStorage.removeItem(PERSIST_PREFIX + k); } catch { /* ignore */ }
}

/**
 * Get a market-chart series, served from cache when fresh and de-duped when a
 * matching request is already in flight. Empty/error results are never cached,
 * so failures retry rather than poisoning the cache.
 */
export function getMarketChartSeries(
  cgId: string,
  days: string,
  interval: string,
  opts: GetMarketChartOptions = {},
): Promise<MarketSeries> {
  const {
    signal,
    apiKey,
    ttlMs = DEFAULT_TTL_MS,
    forceRefresh = false,
    persist = true,
    fetcher = fetchMarketChartSeries,
  } = opts;

  if (signal?.aborted) return rejectedAbort();

  const k = keyOf(cgId, days, interval);

  if (forceRefresh) {
    cache.delete(k);
    removePersisted(k);
  } else {
    const hit = cache.get(k);
    if (hit && Date.now() - hit.savedAt < ttlMs) {
      return raceWithSignal(Promise.resolve(hit.data), signal);
    }
  }

  let shared = inFlight.get(k);
  if (!shared) {
    // Note: the shared fetch is intentionally NOT bound to any caller's signal —
    // one waiter aborting must not cancel the fetch the others are awaiting.
    shared = (async () => {
      const data = await fetcher(cgId, days, interval, undefined, apiKey);
      if (data && data.length > 0) {
        cache.set(k, { data, savedAt: Date.now() });
        if (persist) persistSeries(k, data);
        return data;
      }
      // Network empty/failed — fall back to last-good persisted series if any.
      if (persist) {
        const saved = readPersisted(k);
        if (saved?.data?.length) return saved.data;
      }
      return data ?? [];
    })();
    inFlight.set(k, shared);
    void shared.finally(() => {
      if (inFlight.get(k) === shared) inFlight.delete(k);
    });
  }

  return raceWithSignal(shared, signal);
}

/**
 * Invalidate cached series. With no args, clears everything (memory + persisted).
 * With a cgId (and optionally days/interval), clears matching entries only.
 */
export function invalidateMarketCache(cgId?: string, days?: string, interval?: string): void {
  if (!cgId) {
    clearMarketCache();
    return;
  }
  const exact = days && interval ? keyOf(cgId, days, interval) : null;
  for (const k of [...cache.keys()]) {
    const match = exact ? k === exact : k.startsWith(`${cgId}::`);
    if (match) {
      cache.delete(k);
      removePersisted(k);
    }
  }
}

/** Drop all cached and persisted market series (used by force-refresh / "R"). */
export function clearMarketCache(): void {
  cache.clear();
  if (typeof sessionStorage === 'undefined') return;
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(PERSIST_PREFIX)) sessionStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

/** Snapshot of cache state — handy for tests and measuring dedupe. */
export function getMarketCacheStats(): { entries: number; inFlight: number } {
  return { entries: cache.size, inFlight: inFlight.size };
}
