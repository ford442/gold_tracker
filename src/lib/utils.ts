import type { SparklinePoint } from '../types';

export function formatPrice(price: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(price);
}

export function formatPercent(pct: number, showSign = true): string {
  const sign = showSign && pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

export function formatNumber(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toFixed(0)}`;
}

export function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/**
 * Calculate Pearson correlation coefficient between two series.
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;

  const xs = x.slice(0, n);
  const ys = y.slice(0, n);

  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }

  const denom = Math.sqrt(dx2 * dy2);
  return denom === 0 ? 0 : Math.max(-1, Math.min(1, num / denom));
}

/**
 * Compute spread percentage between two prices.
 */
export function computeSpread(price1: number, price2: number): number {
  if (price1 === 0) return 0;
  return ((price2 - price1) / price1) * 100;
}

/**
 * Get sparkline price array from SparklinePoint[] for a given number of points.
 */
export function sparklinePrices(points: SparklinePoint[], count = 24): number[] {
  const step = Math.max(1, Math.floor(points.length / count));
  return points.filter((_, i) => i % step === 0).slice(-count).map((p) => p.price);
}

/**
 * Compute correlation color: red=-1, white=0, blue=+1
 */
export function correlationColor(value: number): string {
  if (value > 0) {
    // Interpolate from neutral gray (192,192,192) toward blue (66,153,225)
    const r = Math.round(192 - value * 126);
    const g = Math.round(192 - value * 39);
    const b = Math.round(192 + value * 33);
    return `rgb(${r},${g},${b})`;
  } else {
    const abs = Math.abs(value);
    return `rgb(${Math.round(255 * abs)},${Math.round(94 * (1 - abs))},${Math.round(125 * (1 - abs))})`;
  }
}
