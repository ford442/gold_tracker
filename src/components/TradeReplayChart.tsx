import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, ReferenceLine, ReferenceDot,
} from 'recharts';
import { usePriceStore } from '../store/priceStore';
import type { ChartRange, ScenarioMode, SparklinePoint } from '../types';

const RANGES: ChartRange[] = ['1D', '1W', '1M', '3M', '1Y', 'MAX'];
const SCENARIOS: { value: ScenarioMode; label: string }[] = [
  { value: 'realized', label: 'Realized' },
  { value: 'forecast', label: 'Forecast' },
  { value: 'both', label: 'Both' },
];

const AVAILABLE_ASSETS = [
  { id: 'pax-gold',     label: 'PAXG' },
  { id: 'tether-gold',  label: 'XAUT' },
  { id: 'bitcoin',      label: 'BTC' },
  { id: 'ethereum',     label: 'ETH' },
  { id: 'bitcoin-cash', label: 'BCH' },
];

const RANGE_PARAMS: Record<ChartRange, { days: string; interval: string }> = {
  '1D':          { days: '1',   interval: 'hourly' },
  '1W':          { days: '7',   interval: 'hourly' },
  '1M':          { days: '30',  interval: 'daily'  },
  '3M':          { days: '90',  interval: 'daily'  },
  '1Y':          { days: '365', interval: 'daily'  },
  'MAX':         { days: 'max', interval: 'daily'  },
  'SINCE_TRADE': { days: '7',   interval: 'hourly' },
};

interface ChartDataPoint {
  time: string;
  price: number;
  benchmark?: number;
  forecastBase?: number;
  forecastLow?: number;
  forecastHigh?: number;
  event?: 'buy' | 'sell';
  eventNote?: string;
  eventPrice?: number;
}

/** Generate mock trade replay data from live sparkline data */
function generateReplayData(
  sparkline: SparklinePoint[],
  range: ChartRange,
): { data: ChartDataPoint[]; trades: ChartDataPoint[] } {
  if (!sparkline || sparkline.length < 2) return { data: [], trades: [] };

  // For historical fetches we already have the exact window; just use all points.
  const pts = sparkline;

  const data: ChartDataPoint[] = pts.map((p, i) => {
    const t = new Date(p.time);
    const label = range === '1D' || range === '1W'
      ? (range === '1D'
          ? t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : t.toLocaleDateString([], { month: 'short', day: 'numeric' }))
      : t.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return {
      time: label,
      price: Math.round(p.price * 100) / 100,
      benchmark: Math.round((p.price * (1 + Math.sin(i * 0.3) * 0.002)) * 100) / 100,
    };
  });

  // Add mock trades at interesting points
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

/** Generate forecast projection based on last data points */
function addProjections(data: ChartDataPoint[]): ChartDataPoint[] {
  if (data.length < 2) return data;
  const last = data[data.length - 1];
  const prevPrice = data[data.length - 2].price;
  const trend = last.price - prevPrice;
  const result = [...data];

  for (let i = 1; i <= 5; i++) {
    const base = Math.round((last.price + trend * i) * 100) / 100;
    result.push({
      time: `+${i}d`,
      price: NaN, // no realized price in forecast zone
      forecastBase: base,
      forecastLow: Math.round((base - Math.abs(trend) * i * 0.5) * 100) / 100,
      forecastHigh: Math.round((base + Math.abs(trend) * i * 0.5) * 100) / 100,
    });
  }
  return result;
}

export function TradeReplayChart() {
  const { prices, goldSpot } = usePriceStore();
  const [range, setRange] = useState<ChartRange>('1W');
  const [scenario, setScenario] = useState<ScenarioMode>('both');
  const [showBaseline, setShowBaseline] = useState(true);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('pax-gold');
  const [historicalData, setHistoricalData] = useState<SparklinePoint[] | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Fetch historical data from CoinGecko whenever asset or range changes
  useEffect(() => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const { days, interval } = RANGE_PARAMS[range];
    const apiKey = import.meta.env.VITE_COINGECKO_API_KEY as string | undefined;
    const headers: HeadersInit = apiKey ? { 'x-cg-demo-api-key': apiKey } : {};

    setIsLoadingHistory(true);
    setHistoricalData(null);

    fetch(
      `https://api.coingecko.com/api/v3/coins/${selectedAssetId}/market_chart?vs_currency=usd&days=${days}&interval=${interval}`,
      { signal: controller.signal, headers },
    )
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: { prices: [number, number][] }) => {
        const pts: SparklinePoint[] = json.prices.map(([time, price]) => ({ time, price }));
        setHistoricalData(pts);
        setIsLoadingHistory(false);
      })
      .catch(err => {
        if (err instanceof Error && err.name === 'AbortError') return;
        // Fall back to store sparkline silently
        setIsLoadingHistory(false);
      });

    return () => controller.abort();
  }, [selectedAssetId, range]);

  // Fallback sparkline from store
  const localSparkline = useMemo(
    () => prices[selectedAssetId]?.sparkline ?? goldSpot?.sparkline ?? [],
    [prices, selectedAssetId, goldSpot?.sparkline],
  );

  const sparkline = historicalData ?? localSparkline;

  const { chartData, trades, entryPrice, stats } = useMemo(() => {
    const { data, trades } = generateReplayData(sparkline, range);

    const withForecast = scenario !== 'realized' ? addProjections(data) : data;
    const displayData = scenario === 'forecast'
      ? withForecast.filter(d => d.forecastBase !== undefined || d.event)
      : withForecast;

    const entry = trades.find(t => t.event === 'buy')?.price ?? (data[0]?.price ?? 0);
    const lastPrice = data[data.length - 1]?.price ?? entry;
    const pnl = lastPrice - entry;
    const pnlPct = entry > 0 ? (pnl / entry) * 100 : 0;
    const allPrices = data.map(d => d.price).filter(Boolean);

    let runningPeak = entry;
    let worstDD = 0;
    for (const p of allPrices) {
      if (p > runningPeak) runningPeak = p;
      const dd = runningPeak > 0 ? ((p - runningPeak) / runningPeak) * 100 : 0;
      if (dd < worstDD) worstDD = dd;
    }
    const maxPrice = Math.max(...allPrices);

    return {
      chartData: displayData,
      trades,
      entryPrice: entry,
      stats: {
        sinceEntry: pnlPct,
        maxDD: worstDD,
        current: lastPrice,
        high: maxPrice,
      },
    };
  }, [sparkline, range, scenario]);

  const handleRangeChange = useCallback((r: ChartRange) => setRange(r), []);

  const selectedAssetLabel = AVAILABLE_ASSETS.find(a => a.id === selectedAssetId)?.label ?? 'PAXG';

  if (!isLoadingHistory && sparkline.length < 2) {
    return (
      <section aria-label="Trade Replay and Projections">
        <div className="glass-card" style={{
          padding: 'var(--space-xl)',
          textAlign: 'center',
          color: 'var(--color-muted)',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📊</div>
          <div style={{ fontSize: 'var(--font-base)' }}>
            Waiting for price data to build trade replay chart...
          </div>
          <div style={{ fontSize: 'var(--font-xs)', marginTop: '4px' }}>
            Data refreshes every 60 seconds
          </div>
        </div>
      </section>
    );
  }

  const isMobile = containerWidth > 0 && containerWidth < 640;

  return (
    <section aria-label="Trade Replay and Projections">
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '16px', flexWrap: 'wrap', gap: '8px',
      }}>
        <h2 className="section-heading">
          <span className="heading-icon">📈</span> Trade Replay &amp; Projections
        </h2>

        {/* Asset selector dropdown */}
        <select
          value={selectedAssetId}
          onChange={(e) => setSelectedAssetId(e.target.value)}
          aria-label="Select asset to focus"
          style={{
            background: 'var(--color-surface2)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '6px 12px',
            fontSize: 'var(--font-sm)',
            fontWeight: 600,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {AVAILABLE_ASSETS.map(asset => (
            <option key={asset.id} value={asset.id}>
              {asset.label} / Spot Gold
            </option>
          ))}
        </select>
      </div>

      <div ref={containerRef} className="glass-card" style={{
        padding: 'var(--space-lg)',
      }}>
        {/* Controls row */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '8px',
          marginBottom: '16px', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {/* Range pills */}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }} role="group" aria-label="Time range">
            {RANGES.map(r => (
              <button
                key={r}
                className={`range-pill${range === r ? ' active' : ''}`}
                aria-pressed={range === r}
                onClick={() => handleRangeChange(r)}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Scenario toggle */}
          <div style={{ display: 'flex', gap: '4px' }} role="group" aria-label="Scenario mode">
            {SCENARIOS.map(s => (
              <button
                key={s.value}
                className={`range-pill${scenario === s.value ? ' active' : ''}`}
                aria-pressed={scenario === s.value}
                onClick={() => setScenario(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Baseline toggle */}
          <label style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: 'var(--font-xs)', color: 'var(--color-muted)', cursor: 'pointer',
            minHeight: '44px',
          }}>
            <input
              type="checkbox"
              checked={showBaseline}
              onChange={(e) => setShowBaseline(e.target.checked)}
              aria-label="Show entry baseline"
              style={{ accentColor: 'var(--color-accent)', width: '16px', height: '16px' }}
            />
            Entry baseline
          </label>
        </div>

        {/* Chart */}
        <div
          style={{ width: '100%', height: isMobile ? 240 : 340, position: 'relative' }}
          role="img"
          aria-label={`Trade replay price chart for ${selectedAssetLabel} with buy and sell markers`}
        >
          {isLoadingHistory && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: 'var(--color-surface)', opacity: 0.7,
              borderRadius: 'var(--radius-md)', zIndex: 10,
              fontSize: 'var(--font-sm)', color: 'var(--color-muted)',
            }}>
              Loading {selectedAssetLabel} data…
            </div>
          )}
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: isMobile ? -10 : 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="time"
                stroke="var(--color-muted)"
                tick={{ fill: 'var(--color-muted)', fontSize: 10 }}
                tickMargin={8}
                interval={isMobile ? Math.max(1, Math.ceil(chartData.length / 5)) : 'preserveStartEnd'}
              />
              <YAxis
                stroke="var(--color-muted)"
                tick={{ fill: 'var(--color-muted)', fontSize: 10 }}
                tickFormatter={(v) => `$${Number(v).toFixed(0)}`}
                domain={['auto', 'auto']}
                width={isMobile ? 45 : 60}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-surface2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text)',
                  fontSize: '0.75rem',
                }}
                formatter={(value?: number, name?: string) => {
                  const v = value ?? 0;
                  if (isNaN(v)) return ['-', name ?? ''];
                  const label = name === 'price' ? 'Price' : name === 'benchmark' ? 'Benchmark' : (name ?? '');
                  const pctVsEntry = entryPrice > 0 ? ((v - entryPrice) / entryPrice * 100).toFixed(2) : '0';
                  return [`$${v.toFixed(2)} (${Number(pctVsEntry) >= 0 ? '+' : ''}${pctVsEntry}% vs entry)`, label];
                }}
              />

              {/* Entry baseline */}
              {showBaseline && entryPrice > 0 && (
                <ReferenceLine
                  y={entryPrice}
                  stroke="var(--color-gold)"
                  strokeDasharray="6 4"
                  strokeOpacity={0.6}
                  label={{
                    value: `Entry $${entryPrice.toFixed(0)}`,
                    fill: 'var(--color-gold)',
                    fontSize: 10,
                    position: 'right',
                  }}
                />
              )}

              {/* Forecast cone area */}
              {scenario !== 'realized' && (
                <Area
                  type="monotone"
                  dataKey="forecastHigh"
                  stroke="none"
                  fill="var(--color-accent)"
                  fillOpacity={0.08}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )}
              {scenario !== 'realized' && (
                <Area
                  type="monotone"
                  dataKey="forecastLow"
                  stroke="none"
                  fill="var(--color-accent)"
                  fillOpacity={0.05}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )}

              {/* Benchmark line */}
              <Line
                type="monotone"
                dataKey="benchmark"
                stroke="var(--color-muted)"
                strokeWidth={1}
                strokeDasharray="4 4"
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />

              {/* Forecast lines */}
              {scenario !== 'realized' && (
                <Line
                  type="monotone"
                  dataKey="forecastBase"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )}

              {/* Price line */}
              <Line
                type="monotone"
                dataKey="price"
                stroke="var(--color-gold)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, stroke: 'var(--color-gold)', strokeWidth: 2 }}
                connectNulls={false}
              />

              {/* Buy/sell markers */}
              {trades.map((t, i) => (
                <ReferenceDot
                  key={i}
                  x={t.time}
                  y={t.eventPrice ?? t.price}
                  r={7}
                  fill={t.event === 'buy' ? 'var(--color-green)' : 'var(--color-red)'}
                  stroke="#fff"
                  strokeWidth={2}
                  label={{
                    value: t.event === 'buy' ? '▲ BUY' : '▼ SELL',
                    fill: t.event === 'buy' ? 'var(--color-green)' : 'var(--color-red)',
                    fontSize: 9,
                    fontWeight: 700,
                    position: t.event === 'buy' ? 'bottom' : 'top',
                  }}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Stats strip */}
        <div style={{
          marginTop: '16px', paddingTop: '14px',
          borderTop: '1px solid var(--color-border)',
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: '10px',
        }}>
          <div style={{
            background: 'var(--color-surface2)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>Since Entry</div>
            <div style={{
              fontSize: 'var(--font-lg)', fontWeight: 700,
              color: stats.sinceEntry >= 0 ? 'var(--color-green)' : 'var(--color-red)',
            }}>
              {stats.sinceEntry >= 0 ? '↑' : '↓'} {stats.sinceEntry >= 0 ? '+' : ''}{stats.sinceEntry.toFixed(2)}%
            </div>
          </div>
          <div style={{
            background: 'var(--color-surface2)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>Max Drawdown</div>
            <div style={{
              fontSize: 'var(--font-lg)', fontWeight: 700,
              color: 'var(--color-red)',
            }}>
              ↓ {stats.maxDD.toFixed(2)}%
            </div>
          </div>
          <div style={{
            background: 'var(--color-surface2)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>Current</div>
            <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--color-text)' }}>
              ${stats.current.toFixed(2)}
            </div>
          </div>
          <div style={{
            background: 'var(--color-surface2)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>Period High</div>
            <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--color-green)' }}>
              ${stats.high.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Last updated */}
        <div style={{
          marginTop: '10px', fontSize: 'var(--font-xs)', color: 'var(--color-muted)',
          textAlign: 'right',
        }}>
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>
    </section>
  );
}
