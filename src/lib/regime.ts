// GoldTrackr – Regime & Fidelity Analysis
// Pure TypeScript; no React imports. All fluctuation/regime math lives here.
// Follows the same contract as strategyEngine.ts: deterministic pure functions + JSDoc.

import type { AnalysisHorizon, FidelityScore, RegimeAnalysisResult } from '@/types';
import { pearsonCorrelation } from './utils';

/** Map horizon to CG-friendly params (daily for structural windows). */
export const HORIZON_PARAMS: Record<AnalysisHorizon, { days: string; interval: string; label: string }> = {
  '30d': { days: '30', interval: 'daily', label: '30D' },
  '90d': { days: '90', interval: 'daily', label: '90D' },
  '1y':  { days: '365', interval: 'daily', label: '1Y' },
  'max': { days: 'max', interval: 'daily', label: 'MAX' },
};

/** Simple downsampler for long series (performance + chart density). */
export function downsample<T>(arr: T[], maxLen: number): T[] {
  if (arr.length <= maxLen) return arr;
  const step = Math.max(1, Math.floor(arr.length / maxLen));
  const out: T[] = [];
  for (let i = 0; i < arr.length; i += step) out.push(arr[i]);
  if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1]);
  return out;
}

/**
 * Generate a low-volatility synthetic spot gold price path (model).
 * Anchored so last price === endPrice. Slight positive drift + small noise.
 * Used because MetalPrice only provides latest; real long histories for XAU are not fetched.
 * Callers MUST label results as "synthesized / estimated historical reference".
 */
export function generateSyntheticSpotPrices(
  endPrice: number,
  n: number,
  dailyVol = 0.006,
  drift = 0.00008
): number[] {
  if (n < 1) return [endPrice];
  const prices: number[] = new Array(n);
  let p = endPrice;
  // Walk backward from end so final price is exact
  for (let i = n - 1; i >= 0; i--) {
    prices[i] = p;
    // previous step
    const noise = (Math.random() - 0.5) * 2 * dailyVol;
    p = p / (1 + drift + noise); // invert to go backward
  }
  // Ensure last is exactly endPrice (floating error guard)
  prices[n - 1] = endPrice;
  // Light forward smoothing pass (very small)
  for (let i = 1; i < n; i++) {
    prices[i] = prices[i] * 0.98 + prices[i - 1] * 0.02 + (prices[i] - prices[i - 1]) * 0.02;
  }
  prices[n - 1] = endPrice;
  return prices.map((v) => Math.round(v * 100) / 100);
}

/** Log returns for realized vol (more robust than simple returns for longer windows). */
function logReturns(prices: number[]): number[] {
  const rets: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1];
    if (prev > 0) rets.push(Math.log(prices[i] / prev));
  }
  return rets;
}

/**
 * Annualized realized volatility (sample std dev of log returns, scaled).
 * Assumes ~365 trading periods per year for crypto/gold (conservative; 252 also common).
 */
export function annualizedRealizedVol(prices: number[]): number {
  if (!prices || prices.length < 2) return 0;
  const rets = logReturns(prices);
  if (rets.length < 2) return 0;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  let sumSq = 0;
  for (const r of rets) sumSq += (r - mean) * (r - mean);
  const stdev = Math.sqrt(sumSq / (rets.length - 1));
  const ann = stdev * Math.sqrt(365);
  return Math.round(ann * 10000) / 100; // e.g. 18.45 (%)
}

/**
 * Max drawdown (positive %) over the price series.
 * (peak - trough) / peak within the window.
 */
export function maxDrawdownFromPrices(prices: number[]): number {
  if (!prices || prices.length < 2) return 0;
  let peak = prices[0];
  let worst = 0;
  for (const p of prices) {
    if (p > peak) peak = p;
    const dd = peak > 0 ? ((peak - p) / peak) * 100 : 0;
    if (dd > worst) worst = dd;
  }
  return Math.round(worst * 100) / 100;
}

/** Rolling Pearson using fixed window on price arrays (matches short-term matrix style). */
export function rollingCorrelations(a: number[], b: number[], window = 30): number[] {
  const n = Math.min(a.length, b.length);
  if (n < window) return [];
  const out: number[] = [];
  for (let i = window; i <= n; i++) {
    const sa = a.slice(i - window, i);
    const sb = b.slice(i - window, i);
    out.push(pearsonCorrelation(sa, sb));
  }
  return out;
}

/**
 * Align a secondary [ts, price] series to a reference series length by proportional index.
 * (Sufficient for daily-sampled CG data + our synth spot; nearest-ts is heavier.)
 * Returns a price array of same length as refPrices.
 */
export function alignToRefLength(refLen: number, other: [number, number][]): number[] {
  if (!other.length) return new Array(refLen).fill(0);
  const oPrices = other.map(([, p]) => p);
  const out: number[] = [];
  for (let i = 0; i < refLen; i++) {
    const frac = refLen > 1 ? i / (refLen - 1) : 0;
    const idx = Math.min(oPrices.length - 1, Math.max(0, Math.floor(frac * (oPrices.length - 1))));
    out.push(oPrices[idx]);
  }
  return out;
}

/** Classify regime from the composite fidelity score. */
export function classifyRegime(score: number): string {
  if (score >= 70) return 'Strong gold proxy';
  if (score >= 45) return 'Moderate gold tracking';
  return 'Crypto-beta dominant';
}

// ─── Regime gates (strategy + suggestions) ───────────────────────────────────

/** User-configurable thresholds for PAXG/XAUT arb gating. */
export interface RegimeGateConfig {
  /** Minimum avg fidelity to allow arb without divergence override. */
  minFidelityScore: number;
  /** Avg fidelity at which full trade size is used. */
  fullSizeFidelityScore: number;
  /** Floor on size multiplier when allowed but fidelity is low. */
  minSizeMultiplier: number;
  /** corr(BTC) − corr(Gold) above this ⇒ crypto-like divergence. */
  cryptoDivergenceDelta: number;
  /** Allow arb when divergence detected even if fidelity below min. */
  allowDivergenceOverride: boolean;
}

export const DEFAULT_REGIME_GATE_CONFIG: RegimeGateConfig = {
  minFidelityScore: 45,
  fullSizeFidelityScore: 70,
  minSizeMultiplier: 0.35,
  cryptoDivergenceDelta: 0.12,
  allowDivergenceOverride: true,
};

export interface RegimeGateResult {
  allowed: boolean;
  sizeMultiplier: number;
  regimeTag: string;
  reason: string;
  avgScore: number;
  isCryptoLikeDivergence: boolean;
  paxg: FidelityScore;
  xaut: FidelityScore;
}

/**
 * True when token behaves more like crypto than spot gold:
 * low composite score OR BTC correlation materially exceeds gold correlation.
 */
export function isCryptoLikeDivergence(score: FidelityScore, delta = 0.12): boolean {
  if (score.score < 45) return true;
  return score.corrToBtc - score.corrToGold >= delta;
}

/** Map avg fidelity (+ optional divergence boost) → [minSize, 1] multiplier. */
export function computeRegimeSizeMultiplier(
  avgScore: number,
  divergence: boolean,
  config: RegimeGateConfig,
): number {
  const { minFidelityScore, fullSizeFidelityScore, minSizeMultiplier } = config;
  if (avgScore >= fullSizeFidelityScore) return 1;
  if (avgScore <= minFidelityScore) {
    return divergence ? Math.max(minSizeMultiplier, 0.5) : minSizeMultiplier;
  }
  const t = (avgScore - minFidelityScore) / (fullSizeFidelityScore - minFidelityScore);
  return minSizeMultiplier + t * (1 - minSizeMultiplier);
}

/**
 * Gate PAXG/XAUT arb entries by structural fidelity regime.
 * Exits are always allowed — this only sizes/blocks new entries.
 */
export function evaluateArbRegimeGate(
  paxg: FidelityScore,
  xaut: FidelityScore,
  config: RegimeGateConfig = DEFAULT_REGIME_GATE_CONFIG,
): RegimeGateResult {
  const avgScore = (paxg.score + xaut.score) / 2;
  const divergence =
    isCryptoLikeDivergence(paxg, config.cryptoDivergenceDelta) ||
    isCryptoLikeDivergence(xaut, config.cryptoDivergenceDelta);
  const highFidelity = avgScore >= config.minFidelityScore;
  const allowed = highFidelity || (config.allowDivergenceOverride && divergence);

  let regimeTag: string;
  if (highFidelity && divergence) regimeTag = 'Gold proxy + divergence';
  else if (highFidelity) regimeTag = paxg.regimeLabel === xaut.regimeLabel ? paxg.regimeLabel : 'Mixed gold tracking';
  else if (divergence) regimeTag = 'Crypto-beta divergence';
  else regimeTag = 'Low fidelity — gated';

  const sizeMultiplier = allowed ? computeRegimeSizeMultiplier(avgScore, divergence, config) : 0;
  const reason = allowed
    ? `Regime OK — avg fidelity ${avgScore.toFixed(0)} (${regimeTag}), ${Math.round(sizeMultiplier * 100)}% size`
    : `Regime gate: avg fidelity ${avgScore.toFixed(0)} below ${config.minFidelityScore} — no divergence override`;

  return {
    allowed,
    sizeMultiplier,
    regimeTag,
    reason,
    avgScore,
    isCryptoLikeDivergence: divergence,
    paxg,
    xaut,
  };
}

/** Short tag for suggestion cards (includes synthesized-spot disclaimer when applicable). */
export function formatRegimeTagForUi(
  gate: RegimeGateResult,
  isEstimatedSpot = true,
): { tag: string; reason: string; disclaimer: string } {
  const disclaimer = isEstimatedSpot
    ? 'Fidelity from sparklines · spot gold path is synthesized/estimated — not financial advice.'
    : 'Fidelity from sparklines — not financial advice.';
  return {
    tag: gate.regimeTag,
    reason: gate.reason,
    disclaimer,
  };
}

/**
 * Core entry point: given aligned price arrays (same length, chronological),
 * compute FidelityScores for PAXG and XAUT using the 50 + 50*(corrGold - corrBtc) formula.
 * Also returns the 5x5 long correlation matrix for the horizon (Gold/PAXG/XAUT/BTC/ETH).
 */
export function computeFidelityScores(
  gold: number[],
  paxg: number[],
  xaut: number[],
  btc: number[],
  eth: number[]
): { paxg: FidelityScore; xaut: FidelityScore; longCorrelations: { assets: string[]; matrix: number[][] } } {
  const minLen = Math.min(gold.length, paxg.length, xaut.length, btc.length, eth.length);
  if (minLen < 2) {
    const zero: FidelityScore = { score: 0, corrToGold: 0, corrToBtc: 0, corrToEth: 0, realizedVol: 0, maxDrawdown: 0, regimeLabel: 'Insufficient data' };
    return {
      paxg: zero,
      xaut: zero,
      longCorrelations: {
        assets: ['Gold', 'PAXG', 'XAUT', 'BTC', 'ETH'],
        matrix: Array.from({ length: 5 }, () => Array(5).fill(0)),
      },
    };
  }

  const g = gold.slice(-minLen);
  const p = paxg.slice(-minLen);
  const x = xaut.slice(-minLen);
  const b = btc.slice(-minLen);
  const e = eth.slice(-minLen);

  const paxgGold = pearsonCorrelation(g, p);
  const paxgBtc = pearsonCorrelation(b, p);
  const paxgEth = pearsonCorrelation(e, p);
  const paxgVol = annualizedRealizedVol(p);
  const paxgDD = maxDrawdownFromPrices(p);
  const paxgScore = Math.max(0, Math.min(100, Math.round(50 + 50 * (paxgGold - paxgBtc))));
  const paxgRegime = classifyRegime(paxgScore);

  const xautGold = pearsonCorrelation(g, x);
  const xautBtc = pearsonCorrelation(b, x);
  const xautEth = pearsonCorrelation(e, x);
  const xautVol = annualizedRealizedVol(x);
  const xautDD = maxDrawdownFromPrices(x);
  const xautScore = Math.max(0, Math.min(100, Math.round(50 + 50 * (xautGold - xautBtc))));
  const xautRegime = classifyRegime(xautScore);

  // 5-asset matrix (rows/cols: Gold, PAXG, XAUT, BTC, ETH) — diagonal 1
  const keys = [g, p, x, b, e];
  const matrix: number[][] = keys.map((a, i) =>
    keys.map((b, j) => (i === j ? 1 : pearsonCorrelation(a, b)))
  );

  return {
    paxg: {
      score: paxgScore,
      corrToGold: Math.round(paxgGold * 1000) / 1000,
      corrToBtc: Math.round(paxgBtc * 1000) / 1000,
      corrToEth: Math.round(paxgEth * 1000) / 1000,
      realizedVol: paxgVol,
      maxDrawdown: paxgDD,
      regimeLabel: paxgRegime,
    },
    xaut: {
      score: xautScore,
      corrToGold: Math.round(xautGold * 1000) / 1000,
      corrToBtc: Math.round(xautBtc * 1000) / 1000,
      corrToEth: Math.round(xautEth * 1000) / 1000,
      realizedVol: xautVol,
      maxDrawdown: xautDD,
      regimeLabel: xautRegime,
    },
    longCorrelations: {
      assets: ['Gold', 'PAXG', 'XAUT', 'BTC', 'ETH'],
      matrix,
    },
  };
}

/** Convenience: build a minimal result with warnings for fallback paths. */
export function makeFallbackResult(
  horizon: AnalysisHorizon,
  paxgPrices: number[],
  xautPrices: number[],
  endSpot: number,
  warnings: string[]
): RegimeAnalysisResult {
  const n = Math.max(2, Math.min(paxgPrices.length, xautPrices.length));
  const g = generateSyntheticSpotPrices(endSpot, n);
  const p = paxgPrices.slice(-n);
  const x = xautPrices.slice(-n);
  const b = p.map((v, i) => v * (0.9 + 0.2 * Math.sin(i / 7))); // fake BTC-like for fallback
  const e = p.map((v, i) => v * (0.85 + 0.3 * Math.sin(i / 5)));
  const { paxg, xaut, longCorrelations } = computeFidelityScores(g, p, x, b, e);
  // rolling not meaningful in fallback
  return {
    horizon,
    paxg,
    xaut,
    longCorrelations,
    dataPoints: n,
    isEstimatedSpot: true,
    warnings,
  };
}
