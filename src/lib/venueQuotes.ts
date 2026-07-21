/**
 * Pure venue quote parsing and cross-venue PAXG/XAUT arb math (issue #53 Phase B).
 */

import type { ExchangeId } from './exchanges';
import { getExchangeConfig, roundTripPaxgXautFeeBps, supportsPair } from './exchanges';
import { computeSpread } from './utils';

export type QuoteSource = 'live' | 'estimated' | 'mock';

export interface VenueLegQuote {
  bid: number;
  ask: number;
  mid: number;
  ts: number;
  source: QuoteSource;
}

export interface VenueGoldSnapshot {
  venueId: ExchangeId;
  paxgUsd: VenueLegQuote;
  xautUsd?: VenueLegQuote;
  /** Kraken direct PAXG-XAUT book when available. */
  paxgXautDirect?: VenueLegQuote;
}

export interface IntraVenueSpread {
  rawSpreadPct: number;
  roundTripFeeBps: number;
  netSpreadPct: number;
  profitable: boolean;
}

export interface CrossVenueOpportunity {
  buyVenue: ExchangeId;
  sellVenue: ExchangeId;
  buyAsset: 'PAXG' | 'XAUT';
  sellAsset: 'PAXG' | 'XAUT';
  rawSpreadPct: number;
  roundTripFeeBps: number;
  netSpreadPct: number;
  profitable: boolean;
}

/** Default net-spread threshold for arb opportunity UI (0.55%). */
export const DEFAULT_ARB_NET_THRESHOLD_PCT = 0.55;

const ARB_VENUE_IDS: ExchangeId[] = ['coinbase', 'kraken', 'gemini'];

export function arbVenueIds(): ExchangeId[] {
  return [...ARB_VENUE_IDS];
}

function legQuote(
  bid: number,
  ask: number,
  ts: number,
  source: QuoteSource,
): VenueLegQuote | null {
  if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask <= 0 || ask < bid) {
    return null;
  }
  return { bid, ask, mid: (bid + ask) / 2, ts, source };
}

function topPrice(levels: Array<{ price?: string }> | undefined): number | null {
  const raw = levels?.[0]?.price;
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Parse Coinbase `best_bid_ask` response into PAXG/XAUT USD legs. */
export function parseCoinbaseBestBidAsk(
  json: unknown,
  ts = Date.now(),
  source: QuoteSource = 'live',
): { paxgUsd?: VenueLegQuote; xautUsd?: VenueLegQuote } {
  const body = json as {
    pricebooks?: Array<{
      product_id?: string;
      bids?: Array<{ price?: string }>;
      asks?: Array<{ price?: string }>;
    }>;
  };

  const out: { paxgUsd?: VenueLegQuote; xautUsd?: VenueLegQuote } = {};

  for (const book of body.pricebooks ?? []) {
    const bid = topPrice(book.bids);
    const ask = topPrice(book.asks);
    if (bid == null || ask == null) continue;
    const leg = legQuote(bid, ask, ts, source);
    if (!leg) continue;
    if (book.product_id === 'PAXG-USD') out.paxgUsd = leg;
    if (book.product_id === 'XAUT-USD') out.xautUsd = leg;
  }

  return out;
}

/** Parse Kraken public `Ticker` response. */
export function parseKrakenTicker(
  json: unknown,
  ts = Date.now(),
  source: QuoteSource = 'live',
): {
  paxgUsd?: VenueLegQuote;
  xautUsd?: VenueLegQuote;
  paxgXautDirect?: VenueLegQuote;
} {
  const body = json as {
    error?: string[];
    result?: Record<string, { a?: string[]; b?: string[] }>;
  };

  if (body.error?.length) return {};

  const out: {
    paxgUsd?: VenueLegQuote;
    xautUsd?: VenueLegQuote;
    paxgXautDirect?: VenueLegQuote;
  } = {};

  for (const [pair, row] of Object.entries(body.result ?? {})) {
    const ask = row.a?.[0] != null ? Number(row.a[0]) : NaN;
    const bid = row.b?.[0] != null ? Number(row.b[0]) : NaN;
    const leg = legQuote(bid, ask, ts, source);
    if (!leg) continue;

    const normalized = pair.replace(/[^A-Z]/gi, '').toUpperCase();
    if (normalized === 'PAXGUSD' || pair === 'PAXGUSD') out.paxgUsd = leg;
    else if (normalized === 'XAUTUSD' || pair === 'XAUTUSD') out.xautUsd = leg;
    else if (normalized === 'PAXGXAUT' || pair === 'PAXGXAUT') out.paxgXautDirect = leg;
  }

  return out;
}

/** Parse Gemini `pubticker` for PAXG/USD (quote-only venue). */
export function parseGeminiPubTicker(
  json: unknown,
  ts = Date.now(),
  source: QuoteSource = 'live',
): { paxgUsd?: VenueLegQuote } {
  const body = json as { bid?: string; ask?: string };
  const bid = body.bid != null ? Number(body.bid) : NaN;
  const ask = body.ask != null ? Number(body.ask) : NaN;
  const leg = legQuote(bid, ask, ts, source);
  return leg ? { paxgUsd: leg } : {};
}

/** Build a normalized snapshot from parsed legs. */
export function buildVenueSnapshot(
  venueId: ExchangeId,
  legs: {
    paxgUsd?: VenueLegQuote;
    xautUsd?: VenueLegQuote;
    paxgXautDirect?: VenueLegQuote;
  },
  fallbackMid?: { paxg?: number; xaut?: number },
  fallbackSource: QuoteSource = 'estimated',
): VenueGoldSnapshot | null {
  const ts = Date.now();
  const emptyLeg = (mid: number, source: QuoteSource): VenueLegQuote => ({
    bid: mid,
    ask: mid,
    mid,
    ts,
    source,
  });

  let paxgUsd = legs.paxgUsd;
  let xautUsd = legs.xautUsd;

  if (!paxgUsd && fallbackMid?.paxg != null && fallbackMid.paxg > 0) {
    paxgUsd = emptyLeg(fallbackMid.paxg, fallbackSource);
  }
  if (!xautUsd && fallbackMid?.xaut != null && fallbackMid.xaut > 0) {
    xautUsd = emptyLeg(fallbackMid.xaut, fallbackSource);
  }

  if (!paxgUsd && !xautUsd) return null;

  const listsXaut = supportsPair(venueId, 'XAUT-USD');

  if (!paxgUsd && xautUsd) {
    paxgUsd = emptyLeg(xautUsd.mid, xautUsd.source);
  }
  if (!xautUsd && listsXaut && paxgUsd) {
    xautUsd = emptyLeg(paxgUsd.mid, paxgUsd.source);
  }

  if (!paxgUsd) return null;

  return {
    venueId,
    paxgUsd,
    ...(xautUsd ? { xautUsd } : {}),
    paxgXautDirect: legs.paxgXautDirect,
  };
}

/** Whether the venue lists an XAUT/USD pair (vs quote-only PAXG). */
export function venueListsXaut(venueId: ExchangeId): boolean {
  return supportsPair(venueId, 'XAUT-USD');
}

/**
 * Executable intra-venue spread: buy PAXG at ask, sell XAUT at bid (or reverse).
 * Positive spread means XAUT is richer vs PAXG on this venue.
 */
export function intraVenueSpread(
  snapshot: VenueGoldSnapshot,
  thresholdPct = DEFAULT_ARB_NET_THRESHOLD_PCT,
): IntraVenueSpread | null {
  if (!venueListsXaut(snapshot.venueId) && !snapshot.paxgXautDirect) {
    return null;
  }

  const cfg = getExchangeConfig(snapshot.venueId);
  const roundTripFeeBps = roundTripPaxgXautFeeBps(snapshot.venueId);

  if (snapshot.paxgXautDirect && cfg?.directPaxgXaut) {
    const rawSpreadPct = computeSpread(snapshot.paxgXautDirect.bid, snapshot.paxgXautDirect.ask);
    const feeDragPct = roundTripFeeBps / 100;
    const netSpreadPct = rawSpreadPct - feeDragPct;
    return {
      rawSpreadPct,
      roundTripFeeBps,
      netSpreadPct,
      profitable: Math.abs(netSpreadPct) >= thresholdPct,
    };
  }

  const paxgAsk = snapshot.paxgUsd.ask;
  const xautBid = snapshot.xautUsd?.bid;
  if (xautBid == null) return null;
  const rawSpreadPct = computeSpread(paxgAsk, xautBid);
  const feeDragPct = roundTripFeeBps / 100;
  const netSpreadPct = rawSpreadPct - feeDragPct;

  return {
    rawSpreadPct,
    roundTripFeeBps,
    netSpreadPct,
    profitable: Math.abs(netSpreadPct) >= thresholdPct,
  };
}

function routeFeeBps(buyVenue: ExchangeId, sellVenue: ExchangeId): number {
  if (buyVenue === sellVenue) {
    return roundTripPaxgXautFeeBps(buyVenue);
  }
  const buyBps = getExchangeConfig(buyVenue)?.takerFeeBps ?? 60;
  const sellBps = getExchangeConfig(sellVenue)?.takerFeeBps ?? 60;
  return buyBps + sellBps;
}

/**
 * Best cross-venue opportunity: buy PAXG at cheapest ask, sell XAUT at richest bid
 * (tokenized gold arb rotation). Also evaluates the reverse direction.
 */
export function bestCrossVenueOpportunity(
  snapshots: VenueGoldSnapshot[],
  thresholdPct = DEFAULT_ARB_NET_THRESHOLD_PCT,
): CrossVenueOpportunity | null {
  const tradable = snapshots.filter((s) => {
    const cfg = getExchangeConfig(s.venueId);
    return cfg?.canTrade !== false || s.venueId === 'gemini';
  });

  if (tradable.length < 2) return null;

  let best: CrossVenueOpportunity | null = null;

  const consider = (
    buyVenue: ExchangeId,
    sellVenue: ExchangeId,
    buyAsk: number,
    sellBid: number,
    buyAsset: 'PAXG' | 'XAUT',
    sellAsset: 'PAXG' | 'XAUT',
  ) => {
    if (buyAsk <= 0 || sellBid <= 0) return;
    const rawSpreadPct = computeSpread(buyAsk, sellBid);
    const roundTripFeeBps = routeFeeBps(buyVenue, sellVenue);
    const feeDragPct = roundTripFeeBps / 100;
    const netSpreadPct = rawSpreadPct - feeDragPct;
    const candidate: CrossVenueOpportunity = {
      buyVenue,
      sellVenue,
      buyAsset,
      sellAsset,
      rawSpreadPct,
      roundTripFeeBps,
      netSpreadPct,
      profitable: netSpreadPct >= thresholdPct,
    };
    if (!best || candidate.netSpreadPct > best.netSpreadPct) {
      best = candidate;
    }
  };

  for (const buy of tradable) {
    for (const sell of tradable) {
      if (buy.venueId === sell.venueId) continue;
      consider(
        buy.venueId,
        sell.venueId,
        buy.paxgUsd.ask,
        sell.xautUsd?.bid ?? 0,
        'PAXG',
        'XAUT',
      );
      consider(
        buy.venueId,
        sell.venueId,
        buy.xautUsd?.ask ?? 0,
        sell.paxgUsd.bid,
        'XAUT',
        'PAXG',
      );
    }
  }

  return best;
}

/** Summarize quote sources across snapshots for UI badges. */
export function summarizeQuoteSources(snapshots: VenueGoldSnapshot[]): {
  live: number;
  estimated: number;
  mock: number;
  label: string;
} {
  let live = 0;
  let estimated = 0;
  let mock = 0;

  for (const s of snapshots) {
    for (const leg of [s.paxgUsd, s.xautUsd, s.paxgXautDirect]) {
      if (!leg) continue;
      if (leg.source === 'live') live += 1;
      else if (leg.source === 'estimated') estimated += 1;
      else mock += 1;
    }
  }

  const parts: string[] = [];
  if (live > 0) parts.push(`${live} live`);
  if (estimated > 0) parts.push(`${estimated} est.`);
  if (mock > 0) parts.push(`${mock} mock`);

  return {
    live,
    estimated,
    mock,
    label: parts.length > 0 ? parts.join(' · ') : 'no data',
  };
}

/** Build snapshots from fixture JSON (mock mode / E2E). */
export function snapshotsFromFixture(
  fixture: {
    fetchedAt?: number;
    venues: Array<{
      venueId: ExchangeId;
      paxgUsd: { bid: number; ask: number };
      xautUsd?: { bid: number; ask: number };
      paxgXautDirect?: { bid: number; ask: number };
    }>;
  },
): VenueGoldSnapshot[] {
  const ts = fixture.fetchedAt ?? Date.now();
  return fixture.venues
    .map((v) => {
      const paxgUsd = legQuote(v.paxgUsd.bid, v.paxgUsd.ask, ts, 'mock');
      if (!paxgUsd) return null;
      const xautUsd =
        v.xautUsd != null
          ? legQuote(v.xautUsd.bid, v.xautUsd.ask, ts, 'mock') ?? undefined
          : undefined;
      const paxgXautDirect =
        v.paxgXautDirect != null
          ? legQuote(v.paxgXautDirect.bid, v.paxgXautDirect.ask, ts, 'mock') ?? undefined
          : undefined;
      return buildVenueSnapshot(
        v.venueId,
        {
          paxgUsd,
          xautUsd,
          paxgXautDirect,
        },
      );
    })
    .filter((s): s is VenueGoldSnapshot => s != null);
}
