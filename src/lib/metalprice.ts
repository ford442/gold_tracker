import type { SparklinePoint } from '@/types';

/** Troy ounces per gram — only used when API explicitly returns gram-denominated quotes. */
export const TROY_OZ_GRAMS = 31.1035;

/** Reject obviously mis-scaled gold spot (orders-of-magnitude guard). */
export const GOLD_USD_OZ_MIN = 500;
export const GOLD_USD_OZ_MAX = 10_000;

/** MetalpriceAPI latest/historical payload (subset). */
export interface MetalpriceRatesResponse {
  success: boolean;
  base: string;
  timestamp?: number;
  rates: Record<string, number>;
}

/** MetalpriceAPI /timeframe payload (subset). */
export interface MetalpriceTimeframeResponse {
  success: boolean;
  base: string;
  start_date?: string;
  end_date?: string;
  rates: Record<string, Record<string, number>>;
}

/**
 * MetalpriceAPI expresses precious metals in troy ounces by default.
 *
 * When `base=USD` and `currencies=XAU`, documented sample:
 * ```json
 * { "base": "USD", "rates": { "XAU": 0.00053853, "USDXAU": 1856.906765 } }
 * ```
 * Meaning: 1 USD buys `XAU` troy oz → USD/oz = 1/XAU = USDXAU.
 *
 * When `base=XAU` and `currencies=USD`, `rates.USD` is USD per troy oz (same as OHLC close).
 * Do **not** invert and multiply by 31.1035 — that was the prior bug.
 */
export function parseMetalUsdPerOz(
  rates: Record<string, number>,
  metalSymbol: string,
  base = 'USD',
): number | null {
  const usdPair = rates[`USD${metalSymbol}`];
  if (typeof usdPair === 'number' && usdPair > 0) {
    return usdPair;
  }

  if (base === 'USD') {
    const ozPerUsd = rates[metalSymbol];
    if (typeof ozPerUsd === 'number' && ozPerUsd > 0) {
      return 1 / ozPerUsd;
    }
    return null;
  }

  if (base === metalSymbol) {
    const usdPerOz = rates.USD;
    if (typeof usdPerOz === 'number' && usdPerOz > 0) {
      return usdPerOz;
    }
    return null;
  }

  return null;
}

/** @deprecated Use parseMetalUsdPerOz — kept as alias for gold-specific call sites. */
export function parseGoldUsdPerOz(
  rates: Record<string, number>,
  base = 'USD',
): number | null {
  return parseMetalUsdPerOz(rates, 'XAU', base);
}

export function isPlausibleGoldUsdPerOz(price: number): boolean {
  return Number.isFinite(price) && price >= GOLD_USD_OZ_MIN && price <= GOLD_USD_OZ_MAX;
}

export function percentChange(from: number, to: number): number {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) return 0;
  return ((to - from) / from) * 100;
}

function sortedTimeframeDates(rates: Record<string, Record<string, number>>): string[] {
  return Object.keys(rates).sort();
}

function priceFromTimeframeDay(
  dayRates: Record<string, number>,
  metalSymbol: string,
  base: string,
): number | null {
  const price = parseMetalUsdPerOz(dayRates, metalSymbol, base);
  return price !== null && isPlausibleGoldUsdPerOz(price) ? price : null;
}

/** Build sparkline from /timeframe daily USD/oz prices (newest last). */
export function sparklineFromTimeframe(
  response: MetalpriceTimeframeResponse,
  metalSymbol = 'XAU',
): SparklinePoint[] {
  const dates = sortedTimeframeDates(response.rates);
  const points: SparklinePoint[] = [];

  for (const date of dates) {
    const price = priceFromTimeframeDay(response.rates[date], metalSymbol, response.base);
    if (price === null) continue;
    points.push({
      time: Date.parse(`${date}T12:00:00Z`),
      price,
    });
  }

  return points;
}

/** Derive 24h / 7d % moves from daily timeframe (last 2 days / first vs last). */
export function changesFromTimeframe(
  response: MetalpriceTimeframeResponse,
  metalSymbol = 'XAU',
): { change24h: number; change7d: number } {
  const dates = sortedTimeframeDates(response.rates);
  const prices = dates
    .map((date) => priceFromTimeframeDay(response.rates[date], metalSymbol, response.base))
    .filter((p): p is number => p !== null);

  if (prices.length < 2) {
    return { change24h: 0, change7d: 0 };
  }

  const latest = prices[prices.length - 1];
  const previous = prices[prices.length - 2];
  const earliest = prices[0];

  return {
    change24h: percentChange(previous, latest),
    change7d: percentChange(earliest, latest),
  };
}

export function formatIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function timeframeDateRange(days: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - Math.max(1, days));
  return { start: formatIsoDate(start), end: formatIsoDate(end) };
}
