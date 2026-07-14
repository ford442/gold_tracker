import type { ChartRange, SparklinePoint } from '@/types';
import type { ChartDataPoint } from './types';

export function generateReplayData(
  sparkline: SparklinePoint[],
  range: ChartRange,
): { data: ChartDataPoint[]; trades: ChartDataPoint[] } {
  if (!sparkline || sparkline.length < 2) return { data: [], trades: [] };

  const pts = sparkline;

  const data: ChartDataPoint[] = pts.map((p, i) => {
    const t = new Date(p.time);
    const label =
      range === '1D' || range === '1W'
        ? range === '1D'
          ? t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : t.toLocaleDateString([], { month: 'short', day: 'numeric' })
        : t.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return {
      time: label,
      price: Math.round(p.price * 100) / 100,
      benchmark: Math.round(p.price * (1 + Math.sin(i * 0.3) * 0.002) * 100) / 100,
    };
  });

  const trades: ChartDataPoint[] = [];
  if (data.length >= 4) {
    const buyIdx = Math.floor(data.length * 0.2);
    const sellIdx = Math.floor(data.length * 0.75);
    data[buyIdx].event = 'buy';
    data[buyIdx].eventPrice = data[buyIdx].price;
    data[buyIdx].eventNote = 'Entry: market dip signal';
    data[sellIdx].event = 'sell';
    data[sellIdx].eventPrice = data[sellIdx].price;
    data[sellIdx].eventNote = 'Exit: target reached';
    trades.push(data[buyIdx], data[sellIdx]);
  }

  return { data, trades };
}

export function addProjections(data: ChartDataPoint[]): ChartDataPoint[] {
  if (data.length < 2) return data;
  const last = data[data.length - 1];
  const prevPrice = data[data.length - 2].price;
  const trend = last.price - prevPrice;
  const result = [...data];

  for (let i = 1; i <= 5; i++) {
    const base = Math.round((last.price + trend * i) * 100) / 100;
    result.push({
      time: `+${i}d`,
      price: NaN,
      forecastBase: base,
      forecastLow: Math.round((base - Math.abs(trend) * i * 0.5) * 100) / 100,
      forecastHigh: Math.round((base + Math.abs(trend) * i * 0.5) * 100) / 100,
    });
  }
  return result;
}

export function computeReplayStats(data: ChartDataPoint[], trades: ChartDataPoint[]) {
  const entry = trades.find((t) => t.event === 'buy')?.price ?? data[0]?.price ?? 0;
  const lastPrice = data[data.length - 1]?.price ?? entry;
  const pnl = lastPrice - entry;
  const pnlPct = entry > 0 ? (pnl / entry) * 100 : 0;
  const allPrices = data.map((d) => d.price).filter(Boolean);

  let runningPeak = entry;
  let worstDD = 0;
  for (const p of allPrices) {
    if (p > runningPeak) runningPeak = p;
    const dd = runningPeak > 0 ? ((p - runningPeak) / runningPeak) * 100 : 0;
    if (dd < worstDD) worstDD = dd;
  }
  const maxPrice = Math.max(...allPrices);

  return {
    entryPrice: entry,
    stats: {
      sinceEntry: pnlPct,
      maxDD: worstDD,
      current: lastPrice,
      high: maxPrice,
    },
  };
}
