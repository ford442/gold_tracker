import { describe, expect, it } from 'vitest';
import {
  alignToRefLength,
  annualizedRealizedVol,
  classifyRegime,
  computeFidelityScores,
  DEFAULT_REGIME_GATE_CONFIG,
  downsample,
  evaluateArbRegimeGate,
  isCryptoLikeDivergence,
  maxDrawdownFromPrices,
  rollingCorrelations,
} from './regime';
import type { FidelityScore } from '@/types';

describe('downsample', () => {
  it('returns original array when shorter than maxLen', () => {
    expect(downsample([1, 2, 3], 10)).toEqual([1, 2, 3]);
  });

  it('reduces array length while preserving last element', () => {
    const arr = Array.from({ length: 100 }, (_, i) => i);
    const out = downsample(arr, 10);
    expect(out.length).toBeLessThanOrEqual(11);
    expect(out[out.length - 1]).toBe(99);
  });
});

describe('alignToRefLength', () => {
  it('aligns a secondary series to reference length', () => {
    const other: [number, number][] = [[1, 100], [2, 200], [3, 300]];
    expect(alignToRefLength(3, other)).toEqual([100, 200, 300]);
  });

  it('returns zeros when other series is empty', () => {
    expect(alignToRefLength(4, [])).toEqual([0, 0, 0, 0]);
  });
});

describe('maxDrawdownFromPrices', () => {
  it('returns 0 for fewer than 2 prices', () => {
    expect(maxDrawdownFromPrices([])).toBe(0);
    expect(maxDrawdownFromPrices([100])).toBe(0);
  });

  it('computes peak-to-trough drawdown as positive percent', () => {
    // peak 110, trough 90 → (110-90)/110 ≈ 18.18%
    expect(maxDrawdownFromPrices([100, 110, 90, 95])).toBeCloseTo(18.18, 1);
  });

  it('returns 0 for monotonically rising prices', () => {
    expect(maxDrawdownFromPrices([100, 101, 102, 103])).toBe(0);
  });
});

describe('annualizedRealizedVol', () => {
  it('returns 0 for short or constant series', () => {
    expect(annualizedRealizedVol([])).toBe(0);
    expect(annualizedRealizedVol([100])).toBe(0);
    expect(annualizedRealizedVol([100, 100, 100, 100])).toBe(0);
  });

  it('returns positive vol for varying prices', () => {
    const vol = annualizedRealizedVol([100, 102, 98, 101, 99, 103]);
    expect(vol).toBeGreaterThan(0);
  });
});

describe('rollingCorrelations', () => {
  it('returns empty array when series shorter than window', () => {
    expect(rollingCorrelations([1, 2, 3], [1, 2, 3], 5)).toEqual([]);
    expect(rollingCorrelations([1, 2], [1, 2], 3)).toEqual([]);
  });

  it('returns one point when series length equals window', () => {
    expect(rollingCorrelations([1, 2], [1, 2], 2)).toEqual([1]);
  });

  it('returns one correlation per sliding window', () => {
    const a = [1, 2, 3, 4, 5, 6];
    const b = [1, 2, 3, 4, 5, 6];
    const rolls = rollingCorrelations(a, b, 3);
    expect(rolls).toHaveLength(4); // i=3,4,5,6 → 4 windows
    rolls.forEach((r) => expect(r).toBeCloseTo(1, 5));
  });

  it('handles constant series within window (zero denominator → 0)', () => {
    const a = [5, 5, 5, 5, 5];
    const b = [1, 2, 3, 4, 5];
    const rolls = rollingCorrelations(a, b, 3);
    expect(rolls.length).toBeGreaterThan(0);
    rolls.forEach((r) => expect(r).toBe(0));
  });
});

describe('classifyRegime', () => {
  it('maps score bands to regime labels', () => {
    expect(classifyRegime(80)).toBe('Strong gold proxy');
    expect(classifyRegime(55)).toBe('Moderate gold tracking');
    expect(classifyRegime(30)).toBe('Crypto-beta dominant');
  });
});

describe('regime gate (arb)', () => {
  const strong: FidelityScore = {
    score: 78,
    corrToGold: 0.92,
    corrToBtc: 0.35,
    corrToEth: 0.3,
    realizedVol: 10,
    maxDrawdown: 4,
    regimeLabel: 'Strong gold proxy',
  };
  const weak: FidelityScore = {
    score: 32,
    corrToGold: 0.4,
    corrToBtc: 0.75,
    corrToEth: 0.6,
    realizedVol: 22,
    maxDrawdown: 12,
    regimeLabel: 'Crypto-beta dominant',
  };

  it('detects crypto-like divergence', () => {
    expect(isCryptoLikeDivergence(strong)).toBe(false);
    expect(isCryptoLikeDivergence(weak)).toBe(true);
  });

  it('allows arb when avg fidelity is high', () => {
    const gate = evaluateArbRegimeGate(strong, strong);
    expect(gate.allowed).toBe(true);
    expect(gate.sizeMultiplier).toBe(1);
  });

  it('allows arb on divergence override when fidelity low', () => {
    const gate = evaluateArbRegimeGate(weak, weak, {
      ...DEFAULT_REGIME_GATE_CONFIG,
      allowDivergenceOverride: true,
    });
    expect(gate.allowed).toBe(true);
    expect(gate.isCryptoLikeDivergence).toBe(true);
  });

  it('blocks arb when fidelity low and override disabled', () => {
    const gate = evaluateArbRegimeGate(weak, weak, {
      ...DEFAULT_REGIME_GATE_CONFIG,
      allowDivergenceOverride: false,
    });
    expect(gate.allowed).toBe(false);
    expect(gate.sizeMultiplier).toBe(0);
  });

  it('scales size between min and full fidelity', () => {
    const mid: FidelityScore = { ...strong, score: 57, regimeLabel: 'Moderate gold tracking' };
    const gate = evaluateArbRegimeGate(mid, mid);
    expect(gate.sizeMultiplier).toBeGreaterThan(0.35);
    expect(gate.sizeMultiplier).toBeLessThan(1);
  });
});

describe('computeFidelityScores', () => {
  const rising = [100, 101, 102, 103, 104, 105];

  it('returns zeroed scores when fewer than 2 data points', () => {
    const { paxg, xaut, longCorrelations } = computeFidelityScores([100], [100], [100], [50], [30]);
    expect(paxg.score).toBe(0);
    expect(xaut.score).toBe(0);
    expect(paxg.regimeLabel).toBe('Insufficient data');
    expect(longCorrelations.matrix[0][0]).toBe(0);
  });

  it('scores gold-proxy tokens higher when correlated with gold vs BTC', () => {
    const gold = rising;
    const paxg = [...rising];
    const xaut = [...rising];
    const btc = [...rising].reverse(); // inversely related → lower corr to paxg than gold
    const eth = rising.map((_, i) => 30 + (i % 2 === 0 ? i : -i));

    const { paxg: paxgScore, xaut: xautScore } = computeFidelityScores(gold, paxg, xaut, btc, eth);

    expect(paxgScore.corrToGold).toBeGreaterThan(paxgScore.corrToBtc);
    expect(paxgScore.score).toBeGreaterThan(50);
    expect(xautScore.score).toBeGreaterThan(50);
    expect(paxgScore.regimeLabel).toBe('Strong gold proxy');
  });

  it('builds a 5×5 correlation matrix with diagonal 1', () => {
    const gold = rising;
    const paxg = rising;
    const xaut = rising;
    const btc = rising.map((v) => v * 0.5);
    const eth = rising.map((v) => v * 0.3);

    const { longCorrelations } = computeFidelityScores(gold, paxg, xaut, btc, eth);

    expect(longCorrelations.assets).toEqual(['Gold', 'PAXG', 'XAUT', 'BTC', 'ETH']);
    expect(longCorrelations.matrix).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect(longCorrelations.matrix[i][i]).toBe(1);
    }
  });

  it('includes realized vol and max drawdown in fidelity scores', () => {
    const volatile = [100, 110, 90, 105, 95, 108];
    const { paxg } = computeFidelityScores(volatile, volatile, volatile, volatile, volatile);
    expect(paxg.realizedVol).toBeGreaterThan(0);
    expect(paxg.maxDrawdown).toBeGreaterThan(0);
  });
});
