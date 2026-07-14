import { describe, expect, it } from 'vitest';
import {
  changesFromTimeframe,
  GOLD_USD_OZ_MAX,
  GOLD_USD_OZ_MIN,
  isPlausibleGoldUsdPerOz,
  parseGoldUsdPerOz,
  parseMetalUsdPerOz,
  percentChange,
  sparklineFromTimeframe,
  type MetalpriceRatesResponse,
  type MetalpriceTimeframeResponse,
} from './metalprice';

/** Documented MetalpriceAPI sample: base=USD, currencies=XAU (troy oz per USD + USD/oz pair). */
const USD_BASE_LATEST: MetalpriceRatesResponse = {
  success: true,
  base: 'USD',
  timestamp: 1625609377,
  rates: {
    EUR: 0.8255334,
    XAG: 0.03602543,
    XAU: 0.00053853,
    USDEUR: 1.211338027,
    USDXAG: 27.75816972,
    USDXAU: 1856.906765,
  },
};

/** base=XAU: USD quote is USD per troy oz (matches OHLC semantics). */
const XAU_BASE_LATEST: MetalpriceRatesResponse = {
  success: true,
  base: 'XAU',
  timestamp: 1738108799,
  rates: {
    USD: 2742.2233288617,
  },
};

/** Prior buggy path: invert USD then ×31.1035 would yield ~11.3 — must be rejected. */
const MIS_SCALED_INVERT_GRAM = 1 / XAU_BASE_LATEST.rates.USD * 31.1035;

describe('parseGoldUsdPerOz', () => {
  it('reads USDXAU directly from USD-base latest payload', () => {
    expect(parseGoldUsdPerOz(USD_BASE_LATEST.rates, 'USD')).toBeCloseTo(1856.906765, 4);
  });

  it('derives USD/oz from XAU oz-per-USD when USDXAU absent', () => {
    const rates = { ...USD_BASE_LATEST.rates };
    delete rates.USDXAU;
    expect(parseGoldUsdPerOz(rates, 'USD')).toBeCloseTo(1 / 0.00053853, 2);
  });

  it('reads rates.USD as USD/oz when base=XAU (no invert ×31.1035)', () => {
    expect(parseGoldUsdPerOz(XAU_BASE_LATEST.rates, 'XAU')).toBeCloseTo(2742.2233288617, 4);
  });

  it('does not apply gram conversion to XAU-base USD quote', () => {
    expect(MIS_SCALED_INVERT_GRAM).toBeLessThan(GOLD_USD_OZ_MIN);
    expect(isPlausibleGoldUsdPerOz(MIS_SCALED_INVERT_GRAM)).toBe(false);
  });
});

describe('parseMetalUsdPerOz (silver sample)', () => {
  it('returns USD/oz for XAG via USDXAG or invert', () => {
    expect(parseMetalUsdPerOz(USD_BASE_LATEST.rates, 'XAG', 'USD')).toBeCloseTo(27.75816972, 4);
    const rates = { ...USD_BASE_LATEST.rates };
    delete rates.USDXAG;
    expect(parseMetalUsdPerOz(rates, 'XAG', 'USD')).toBeCloseTo(1 / 0.03602543, 2);
  });
});

describe('isPlausibleGoldUsdPerOz', () => {
  it('accepts realistic spot band', () => {
    expect(isPlausibleGoldUsdPerOz(3290)).toBe(true);
    expect(isPlausibleGoldUsdPerOz(GOLD_USD_OZ_MIN)).toBe(true);
    expect(isPlausibleGoldUsdPerOz(GOLD_USD_OZ_MAX)).toBe(true);
  });

  it('rejects mis-scaled values', () => {
    expect(isPlausibleGoldUsdPerOz(MIS_SCALED_INVERT_GRAM)).toBe(false);
    expect(isPlausibleGoldUsdPerOz(50)).toBe(false);
    expect(isPlausibleGoldUsdPerOz(50_000)).toBe(false);
  });
});

describe('timeframe helpers', () => {
  const TIMEFRAME: MetalpriceTimeframeResponse = {
    success: true,
    base: 'USD',
    start_date: '2026-07-06',
    end_date: '2026-07-13',
    rates: {
      '2026-07-06': { XAU: 0.000303, USDXAU: 3300 },
      '2026-07-07': { XAU: 0.000304, USDXAU: 3289 },
      '2026-07-08': { XAU: 0.000305, USDXAU: 3278 },
      '2026-07-09': { XAU: 0.000306, USDXAU: 3267 },
      '2026-07-10': { XAU: 0.000307, USDXAU: 3256 },
      '2026-07-11': { XAU: 0.000308, USDXAU: 3245 },
      '2026-07-12': { XAU: 0.000309, USDXAU: 3234 },
      '2026-07-13': { XAU: 0.000310, USDXAU: 3223 },
    },
  };

  it('builds chronological sparkline from daily rates', () => {
    const spark = sparklineFromTimeframe(TIMEFRAME);
    expect(spark).toHaveLength(8);
    expect(spark[0].price).toBeCloseTo(3300, 0);
    expect(spark[spark.length - 1].price).toBeCloseTo(3223, 0);
    expect(spark[0].time).toBeLessThan(spark[spark.length - 1].time);
  });

  it('computes 24h and 7d percent changes', () => {
    const { change24h, change7d } = changesFromTimeframe(TIMEFRAME);
    expect(change24h).toBeCloseTo(percentChange(3234, 3223), 4);
    expect(change7d).toBeCloseTo(percentChange(3300, 3223), 4);
  });
});
