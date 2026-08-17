/**
 * Pure math and evaluation logic for Counterfactual Trade Explorer ("What-If Trade Simulator").
 *
 * Evaluates hypothetical historical trades and computes what crypto/gold holdings
 * would be worth today vs holding the original asset, including fee drag,
 * time-series trajectory generation, and multi-asset alignment.
 *
 * Pure TypeScript; no React imports. Fully unit-tested with Vitest.
 */

import { takerFeeBps } from './exchanges';

export type CounterfactualPresetRange = '7d' | '14d' | '30d' | '60d' | '90d' | '180d' | '1y';

export const COUNTERFACTUAL_RANGE_DAYS: Record<CounterfactualPresetRange, number> = {
  '7d': 7,
  '14d': 14,
  '30d': 30,
  '60d': 60,
  '90d': 90,
  '180d': 180,
  '1y': 365,
};

export interface HypotheticalTrade {
  id: string;
  fromAsset: string;      // CoinGecko ID or 'usd' (e.g. 'bitcoin', 'pax-gold', 'ethereum', 'tether-gold', 'bitcoin-cash', 'usd')
  toAsset: string;        // CoinGecko ID or 'usd'
  fromAmount: number;     // Units of fromAsset sold
  timestamp: number;      // Unix ms timestamp when trade supposedly happened
  feeBps?: number;        // Exchange fee in basis points (e.g. 60 for Coinbase, 26 for Kraken, 0 for none)
  exchangePreset?: 'none' | 'coinbase' | 'kraken' | 'custom';
}

export interface CounterfactualPoint {
  timestamp: number;
  dateStr: string;
  valueIfTraded: number; // USD valuation of acquired asset on this date
  valueIfKept: number;   // USD valuation of original asset on this date
  deltaUsd: number;      // valueIfTraded - valueIfKept
  alphaPct: number;      // (valueIfTraded - valueIfKept) / valueIfKept * 100
}

export interface CounterfactualEvaluation {
  trade: HypotheticalTrade;

  // Snapshot at time of hypothetical trade
  priceFromAtTrade: number;
  priceToAtTrade: number;
  tradeValueUsd: number;
  feeUsd: number;
  netTradeValueUsd: number;
  toAmountReceived: number;

  // Current valuations today
  currentPriceFrom: number;
  currentPriceTo: number;
  currentValueIfKept: number;
  currentValueIfTraded: number;

  // Performance deltas
  deltaUsd: number;
  returnIfKeptPct: number;
  returnIfTradedPct: number;
  alphaPct: number;
  isProfitable: boolean;

  // Timeseries from trade date to present
  trajectory: CounterfactualPoint[];
}

/**
 * Get fee in basis points for an exchange preset.
 */
export function getCounterfactualFeeBps(preset: 'none' | 'coinbase' | 'kraken' | 'custom', customBps = 0): number {
  if (preset === 'none') return 0;
  if (preset === 'coinbase') return takerFeeBps('coinbase');
  if (preset === 'kraken') return takerFeeBps('kraken');
  return customBps;
}

/**
 * Find the closest price in a sorted `[timestamp, price][]` series at or before `targetTs`.
 */
export function findClosestPriceInSeries(
  series: [number, number][],
  targetTs: number,
  maxGapMs = 48 * 3_600_000,
): number | null {
  if (!series || series.length === 0) return null;

  let bestPrice: number | null = null;
  let bestDist = Infinity;

  for (let i = 0; i < series.length; i++) {
    const [ts, price] = series[i];
    if (!Number.isFinite(price) || price <= 0) continue;
    const dist = Math.abs(ts - targetTs);
    if (dist <= maxGapMs && dist < bestDist) {
      bestDist = dist;
      bestPrice = price;
    }
  }

  return bestPrice;
}

/**
 * Evaluate a single hypothetical swap trade against historical series and current live prices.
 */
export function evaluateCounterfactualTrade(params: {
  trade: HypotheticalTrade;
  fromSeries: [number, number][];
  toSeries: [number, number][];
  currentPriceFrom: number;
  currentPriceTo: number;
  currentTimestamp?: number;
}): CounterfactualEvaluation {
  const {
    trade,
    fromSeries,
    toSeries,
    currentPriceFrom: curFromRaw,
    currentPriceTo: curToRaw,
    currentTimestamp = Date.now(),
  } = params;

  const isFromUsd = trade.fromAsset.toLowerCase() === 'usd';
  const isToUsd = trade.toAsset.toLowerCase() === 'usd';

  const currentPriceFrom = isFromUsd ? 1 : Math.max(0.0001, curFromRaw);
  const currentPriceTo = isToUsd ? 1 : Math.max(0.0001, curToRaw);

  // Determine price on trade date
  const priceFromAtTrade = isFromUsd
    ? 1
    : (findClosestPriceInSeries(fromSeries, trade.timestamp) ?? currentPriceFrom);

  const priceToAtTrade = isToUsd
    ? 1
    : (findClosestPriceInSeries(toSeries, trade.timestamp) ?? currentPriceTo);

  const tradeValueUsd = trade.fromAmount * priceFromAtTrade;
  const feeBps = trade.feeBps ?? 0;
  const feeUsd = tradeValueUsd * (feeBps / 10_000);
  const netTradeValueUsd = Math.max(0, tradeValueUsd - feeUsd);

  const toAmountReceived = priceToAtTrade > 0 ? netTradeValueUsd / priceToAtTrade : 0;

  const currentValueIfKept = trade.fromAmount * currentPriceFrom;
  const currentValueIfTraded = toAmountReceived * currentPriceTo;

  const deltaUsd = currentValueIfTraded - currentValueIfKept;
  const returnIfKeptPct = priceFromAtTrade > 0
    ? ((currentPriceFrom - priceFromAtTrade) / priceFromAtTrade) * 100
    : 0;
  const returnIfTradedPct = priceToAtTrade > 0
    ? ((currentPriceTo - priceToAtTrade) / priceToAtTrade) * 100
    : 0;
  const alphaPct = currentValueIfKept > 0
    ? ((currentValueIfTraded - currentValueIfKept) / currentValueIfKept) * 100
    : 0;

  // Build timeseries trajectory from trade date to present
  const trajectory = generateCounterfactualTrajectory({
    tradeTimestamp: trade.timestamp,
    endTimestamp: currentTimestamp,
    fromAmount: trade.fromAmount,
    toAmount: toAmountReceived,
    fromSeries: isFromUsd ? [] : fromSeries,
    toSeries: isToUsd ? [] : toSeries,
    currentPriceFrom,
    currentPriceTo,
    isFromUsd,
    isToUsd,
  });

  return {
    trade,
    priceFromAtTrade,
    priceToAtTrade,
    tradeValueUsd,
    feeUsd,
    netTradeValueUsd,
    toAmountReceived,
    currentPriceFrom,
    currentPriceTo,
    currentValueIfKept,
    currentValueIfTraded,
    deltaUsd,
    returnIfKeptPct,
    returnIfTradedPct,
    alphaPct,
    isProfitable: deltaUsd >= 0,
    trajectory,
  };
}

/**
 * Generate daily/hourly trajectory comparing If-Traded vs If-Kept over time.
 */
export function generateCounterfactualTrajectory(params: {
  tradeTimestamp: number;
  endTimestamp: number;
  fromAmount: number;
  toAmount: number;
  fromSeries: [number, number][];
  toSeries: [number, number][];
  currentPriceFrom: number;
  currentPriceTo: number;
  isFromUsd: boolean;
  isToUsd: boolean;
}): CounterfactualPoint[] {
  const {
    tradeTimestamp,
    endTimestamp,
    fromAmount,
    toAmount,
    fromSeries,
    toSeries,
    currentPriceFrom,
    currentPriceTo,
    isFromUsd,
    isToUsd,
  } = params;

  // Filter series to >= tradeTimestamp
  const validFrom = fromSeries.filter(([t]) => t >= tradeTimestamp - 3_600_000);
  const validTo = toSeries.filter(([t]) => t >= tradeTimestamp - 3_600_000);

  // Union of timestamps
  const tsSet = new Set<number>();
  tsSet.add(tradeTimestamp);
  validFrom.forEach(([t]) => tsSet.add(t));
  validTo.forEach(([t]) => tsSet.add(t));
  tsSet.add(endTimestamp);

  const sortedTs = Array.from(tsSet).sort((a, b) => a - b);
  const points: CounterfactualPoint[] = [];

  let lastPFrom = isFromUsd ? 1 : (findClosestPriceInSeries(fromSeries, tradeTimestamp) ?? currentPriceFrom);
  let lastPTo = isToUsd ? 1 : (findClosestPriceInSeries(toSeries, tradeTimestamp) ?? currentPriceTo);

  for (const t of sortedTs) {
    if (t < tradeTimestamp) continue;

    if (!isFromUsd) {
      const match = findClosestPriceInSeries(fromSeries, t, 36 * 3_600_000);
      if (match !== null) lastPFrom = match;
    }
    if (!isToUsd) {
      const match = findClosestPriceInSeries(toSeries, t, 36 * 3_600_000);
      if (match !== null) lastPTo = match;
    }

    const valKept = fromAmount * lastPFrom;
    const valTraded = toAmount * lastPTo;
    const delta = valTraded - valKept;
    const alpha = valKept > 0 ? (delta / valKept) * 100 : 0;

    const d = new Date(t);
    const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;

    points.push({
      timestamp: t,
      dateStr,
      valueIfTraded: parseFloat(valTraded.toFixed(2)),
      valueIfKept: parseFloat(valKept.toFixed(2)),
      deltaUsd: parseFloat(delta.toFixed(2)),
      alphaPct: parseFloat(alpha.toFixed(2)),
    });
  }

  // Deduplicate timestamps if too close (min 2 hours apart, except first/last)
  if (points.length > 50) {
    const sampled: CounterfactualPoint[] = [];
    let lastSampleT = 0;
    const stepMs = Math.max(3_600_000, (endTimestamp - tradeTimestamp) / 50);

    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      if (i === 0 || i === points.length - 1 || pt.timestamp - lastSampleT >= stepMs) {
        sampled.push(pt);
        lastSampleT = pt.timestamp;
      }
    }
    return sampled;
  }

  return points;
}
