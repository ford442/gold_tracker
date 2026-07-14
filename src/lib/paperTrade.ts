/**
 * Paper-trading ledger — PURE logic (no React).
 *
 * Records *simulated* fills produced by dry-run execution of trade suggestions
 * so users can practice arb / rebalancing without live keys, then reconcile a
 * paper-portfolio sleeve, review realized P&L, and export for journaling.
 *
 * Every fill is permanently stamped `mode: 'paper'` — there is no code path in
 * this module that produces a `'live'` fill, so a paper record can never be
 * mistaken for a real one.
 */

import { takerFeeBps } from './exchanges';
import { fromSymbol } from './assets';

export type PaperExchange = 'coinbase' | 'kraken';

/** A single simulated fill appended to the paper ledger. */
export interface PaperFill {
  id: string;
  /** ms epoch of the simulated execution. */
  timestamp: number;
  /** Immutable safety marker — always 'paper', never 'live'. */
  mode: 'paper';
  /** Originating suggestion id (for de-dupe / traceability). */
  suggestionId: string;
  /** Suggestion category: arb | premium | hedge. */
  suggestionType: string;
  /** Human-readable action label, e.g. "BUY PAXG SELL XAUT". */
  action: string;
  /** Exchange product id, e.g. "PAXG-USD". */
  productId: string;
  /** Base asset ticker, e.g. "PAXG". */
  symbol: string;
  /** Internal asset id, e.g. "pax-gold". */
  assetId: string;
  side: 'BUY' | 'SELL';
  /** Fill price in USD (per base unit). */
  price: number;
  /** Base units filled (oz / coins). */
  units: number;
  /** price * units. */
  notionalUsd: number;
  /** Fee model applied, in basis points per leg. */
  feeBps: number;
  /** Estimated exchange fee for this leg, USD. */
  feeUsd: number;
  exchange: PaperExchange;
  reason?: string;
}

/** Per-leg fee basis points for an exchange (from the venue registry). */
export function feeBpsForExchange(exchange: PaperExchange): number {
  return takerFeeBps(exchange);
}

/** Estimate the exchange fee (USD) for a notional at a given bps. */
export function estimateFeeUsd(notionalUsd: number, feeBps: number): number {
  return Math.max(0, notionalUsd) * feeBps / 10_000;
}

/** Base ticker from a product id: "PAXG-USD" -> "PAXG". */
export function baseSymbolFromProductId(productId: string): string {
  return (productId.split('-')[0] ?? productId).toUpperCase();
}

let fillSeq = 0;

export interface BuildPaperFillParams {
  suggestion: {
    id: string;
    type: string;
    action: string;
    productId: string;
    side: 'BUY' | 'SELL';
    reason?: string;
  };
  /** Base units to simulate filling (e.g. maxTradeSize). */
  units: number;
  /** Reference price in USD for the base asset. */
  price: number;
  exchange: PaperExchange;
  /** Injectable clock for deterministic tests. */
  now?: number;
}

/** Build a paper fill from a suggestion + reference price. Never throws on bad input. */
export function buildPaperFill({
  suggestion,
  units,
  price,
  exchange,
  now,
}: BuildPaperFillParams): PaperFill {
  const safeUnits = Number.isFinite(units) && units > 0 ? units : 0;
  const safePrice = Number.isFinite(price) && price > 0 ? price : 0;
  const notionalUsd = safeUnits * safePrice;
  const feeBps = feeBpsForExchange(exchange);
  const symbol = baseSymbolFromProductId(suggestion.productId);
  const assetId = fromSymbol(symbol)?.id ?? symbol.toLowerCase();
  const ts = now ?? Date.now();

  return {
    id: `paper-${ts}-${fillSeq++}`,
    timestamp: ts,
    mode: 'paper',
    suggestionId: suggestion.id,
    suggestionType: suggestion.type,
    action: suggestion.action,
    productId: suggestion.productId,
    symbol,
    assetId,
    side: suggestion.side,
    price: safePrice,
    units: safeUnits,
    notionalUsd,
    feeBps,
    feeUsd: estimateFeeUsd(notionalUsd, feeBps),
    exchange,
    reason: suggestion.reason,
  };
}

/** Aggregated paper position for one asset (average-cost basis). */
export interface PaperPosition {
  assetId: string;
  symbol: string;
  units: number;
  /** Average cost per unit for the currently held units (incl. buy fees). */
  avgCost: number;
  /** Realized P&L booked on this asset (net of fees). */
  realizedPnl: number;
  /** Total fees paid across this asset's fills. */
  fees: number;
}

export interface PaperLedgerSummary {
  positions: PaperPosition[];
  /** Sum of realized P&L across all assets (net of fees). */
  realizedPnl: number;
  /** Unrealized P&L of open units vs. current prices (0 when no price given). */
  unrealizedPnl: number;
  totalFees: number;
  fillCount: number;
}

/**
 * Reduce a chronological fill list into per-asset positions using average-cost
 * accounting. BUY fees are added to cost basis; SELL fees reduce proceeds.
 * A SELL beyond held units books P&L on the held units and flips the remainder
 * to a short at the fill price (kept simple — this is an educational sim).
 */
export function summarizePaperLedger(
  fills: PaperFill[],
  currentPrices?: Record<string, number>,
): PaperLedgerSummary {
  const ordered = [...fills].sort((a, b) => a.timestamp - b.timestamp);
  const byAsset = new Map<string, PaperPosition>();

  const posFor = (f: PaperFill): PaperPosition => {
    let p = byAsset.get(f.assetId);
    if (!p) {
      p = { assetId: f.assetId, symbol: f.symbol, units: 0, avgCost: 0, realizedPnl: 0, fees: 0 };
      byAsset.set(f.assetId, p);
    }
    return p;
  };

  for (const f of ordered) {
    const p = posFor(f);
    p.fees += f.feeUsd;

    if (f.side === 'BUY') {
      const addCost = f.units * f.price + f.feeUsd;
      const newUnits = p.units + f.units;
      // Weighted average cost; guard divide-by-zero.
      p.avgCost = newUnits > 0 ? (p.avgCost * p.units + addCost) / newUnits : 0;
      p.units = newUnits;
    } else {
      const soldFromHeld = Math.min(p.units, f.units);
      if (soldFromHeld > 0) {
        p.realizedPnl += soldFromHeld * (f.price - p.avgCost) - f.feeUsd;
        p.units -= soldFromHeld;
        if (p.units === 0) p.avgCost = 0;
      } else {
        // Selling with no long inventory — book fee, open/extend a short.
        p.realizedPnl -= f.feeUsd;
        p.avgCost = f.price;
        p.units -= f.units;
      }
    }
  }

  const positions = [...byAsset.values()];
  const realizedPnl = positions.reduce((s, p) => s + p.realizedPnl, 0);
  const totalFees = positions.reduce((s, p) => s + p.fees, 0);
  const unrealizedPnl = currentPrices
    ? positions.reduce((s, p) => {
        const cur = currentPrices[p.assetId];
        if (!cur || p.units === 0) return s;
        return s + p.units * (cur - p.avgCost);
      }, 0)
    : 0;

  return {
    positions,
    realizedPnl,
    unrealizedPnl,
    totalFees,
    fillCount: ordered.length,
  };
}

export interface PaperEquityPoint {
  t: string;   // ISO timestamp
  value: number; // cumulative realized P&L (net of fees) after this fill
}

/**
 * Cumulative realized-P&L curve (net of fees), one point per SELL that books
 * P&L plus a leading zero origin. Useful for plotting the paper learning curve.
 */
export function paperEquityCurve(fills: PaperFill[]): PaperEquityPoint[] {
  const ordered = [...fills].sort((a, b) => a.timestamp - b.timestamp);
  if (ordered.length === 0) return [];

  const running = new Map<string, { units: number; avgCost: number }>();
  const points: PaperEquityPoint[] = [];
  let cumulative = 0;

  for (const f of ordered) {
    let pos = running.get(f.assetId);
    if (!pos) {
      pos = { units: 0, avgCost: 0 };
      running.set(f.assetId, pos);
    }

    if (f.side === 'BUY') {
      const newUnits = pos.units + f.units;
      pos.avgCost = newUnits > 0
        ? (pos.avgCost * pos.units + (f.units * f.price + f.feeUsd)) / newUnits
        : 0;
      pos.units = newUnits;
      cumulative -= f.feeUsd; // buy fee is a realized drag immediately
    } else {
      const soldFromHeld = Math.min(pos.units, f.units);
      if (soldFromHeld > 0) {
        cumulative += soldFromHeld * (f.price - pos.avgCost) - f.feeUsd;
        pos.units -= soldFromHeld;
        if (pos.units === 0) pos.avgCost = 0;
      } else {
        cumulative -= f.feeUsd;
        pos.avgCost = f.price;
        pos.units -= f.units;
      }
    }

    points.push({
      t: new Date(f.timestamp).toISOString(),
      value: Math.round(cumulative * 100) / 100,
    });
  }

  return points;
}

const CSV_HEADER = [
  'timestamp_iso',
  'mode',
  'exchange',
  'product',
  'symbol',
  'side',
  'units',
  'price_usd',
  'notional_usd',
  'fee_bps',
  'fee_usd',
  'suggestion_type',
  'action',
];

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serialize the ledger to CSV for tax/journaling export (educational only). */
export function paperFillsToCsv(fills: PaperFill[]): string {
  const ordered = [...fills].sort((a, b) => a.timestamp - b.timestamp);
  const rows = ordered.map((f) =>
    [
      new Date(f.timestamp).toISOString(),
      f.mode,
      f.exchange,
      f.productId,
      f.symbol,
      f.side,
      f.units,
      f.price,
      Math.round(f.notionalUsd * 100) / 100,
      f.feeBps,
      Math.round(f.feeUsd * 1e6) / 1e6,
      f.suggestionType,
      f.action,
    ]
      .map(csvCell)
      .join(','),
  );
  return [CSV_HEADER.join(','), ...rows].join('\n');
}
