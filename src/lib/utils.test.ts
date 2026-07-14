import { describe, expect, it } from 'vitest';
import { computeSpread, correlationColor, formatNumber, formatPercent, formatPrice, getCorrelationStyle, pearsonCorrelation, sparklinePrices } from './utils';

describe('pearsonCorrelation', () => {
  it('returns 1 for perfectly positively correlated series', () => {
    const x = [1, 2, 3, 4, 5];
    expect(pearsonCorrelation(x, x)).toBeCloseTo(1, 5);
    expect(pearsonCorrelation(x, x.map((v) => v * 2 + 10))).toBeCloseTo(1, 5);
  });

  it('returns -1 for perfectly negatively correlated series', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [5, 4, 3, 2, 1];
    expect(pearsonCorrelation(x, y)).toBeCloseTo(-1, 5);
  });

  it('returns ~0 for uncorrelated series', () => {
    const x = [1, -1, 1, -1, 1];
    const y = [1, 1, -1, -1, 0];
    expect(Math.abs(pearsonCorrelation(x, y))).toBeLessThan(0.5);
  });

  it('returns 0 for series shorter than 2 points', () => {
    expect(pearsonCorrelation([], [])).toBe(0);
    expect(pearsonCorrelation([1], [2])).toBe(0);
  });

  it('returns 0 for constant series (zero denominator)', () => {
    expect(pearsonCorrelation([5, 5, 5, 5], [1, 2, 3, 4])).toBe(0);
    expect(pearsonCorrelation([1, 2, 3], [4, 4, 4])).toBe(0);
  });

  it('uses the shorter series length when lengths differ', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [1, 2, 3];
    expect(pearsonCorrelation(x, y)).toBeCloseTo(1, 5);
  });

  it('clamps result to [-1, 1]', () => {
    const x = [1, 2, 3];
    const y = [1, 2, 3];
    const r = pearsonCorrelation(x, y);
    expect(r).toBeGreaterThanOrEqual(-1);
    expect(r).toBeLessThanOrEqual(1);
  });
});

describe('computeSpread', () => {
  it('computes percent spread from price1 to price2', () => {
    expect(computeSpread(100, 110)).toBeCloseTo(10, 5);
    expect(computeSpread(3280, 3290)).toBeCloseTo(0.304878, 3);
  });

  it('returns negative spread when price2 < price1', () => {
    expect(computeSpread(100, 90)).toBeCloseTo(-10, 5);
  });

  it('returns 0 when price1 is zero', () => {
    expect(computeSpread(0, 100)).toBe(0);
  });
});

describe('formatPrice', () => {
  it('formats USD currency', () => {
    expect(formatPrice(3290.5)).toBe('$3,290.50');
    expect(formatPrice(0.5, 4)).toBe('$0.5000');
  });
});

describe('formatPercent', () => {
  it('formats with optional sign', () => {
    expect(formatPercent(1.234)).toBe('+1.23%');
    expect(formatPercent(-0.5)).toBe('-0.50%');
    expect(formatPercent(0, false)).toBe('0.00%');
  });
});

describe('formatNumber', () => {
  it('uses compact suffixes for large values', () => {
    expect(formatNumber(1_500_000)).toBe('$1.50M');
    expect(formatNumber(2_500_000_000)).toBe('$2.50B');
  });
});

describe('sparklinePrices', () => {
  it('downsamples sparkline points to requested count', () => {
    const points = Array.from({ length: 48 }, (_, i) => ({ time: i, price: i * 10 }));
    const prices = sparklinePrices(points, 24);
    expect(prices.length).toBeLessThanOrEqual(24);
    expect(prices[prices.length - 1]).toBeGreaterThanOrEqual(0);
    expect(prices[0]).toBe(0);
  });
});

describe('correlationColor', () => {
  it('returns rgb strings for positive and negative values', () => {
    expect(correlationColor(0.8)).toMatch(/^rgb\(/);
    expect(correlationColor(-0.8)).toMatch(/^rgb\(/);
  });
});

describe('getCorrelationStyle', () => {
  it('returns diagonal style for perfect correlation', () => {
    const style = getCorrelationStyle(1);
    expect(style.glowClass).toBe('');
    expect(style.background).toContain('124,92,252');
  });

  it('returns diverging styles for positive and negative values', () => {
    expect(getCorrelationStyle(0.9).glowClass).toBe('corr-high-pos');
    expect(getCorrelationStyle(-0.9).glowClass).toBe('corr-high-neg');
  });
});
