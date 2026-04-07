import { useMemo, useState, useRef, useEffect } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { usePortfolioStore } from '../store/portfolioStore';
import { usePriceStore } from '../store/priceStore';

const AVAILABLE_ASSETS = [
  { id: 'gold', symbol: 'XAU' },
  { id: 'pax-gold', symbol: 'PAXG' },
  { id: 'tether-gold', symbol: 'XAUT' },
  { id: 'bitcoin', symbol: 'BTC' },
  { id: 'ethereum', symbol: 'ETH' },
];

function getCurrentPrice(id: string, prices: Record<string, { price: number }>, goldPrice: number | null): number {
  if (id === 'gold') return goldPrice ?? 0;
  return prices[id]?.price ?? 0;
}

interface PnlPoint {
  label: string;
  cumulative: number;
  drawdown: number;
}

export function PnLOverTimeChart() {
  const { entries } = usePortfolioStore();
  const { prices, goldSpot } = usePriceStore();
  const goldPrice = goldSpot?.price ?? null;
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const { data, maxDD, equityHigh, currentPnl } = useMemo(() => {
    if (entries.length === 0) return { data: [], maxDD: 0, equityHigh: 0, currentPnl: 0 };

    // Build simulated PnL path using sparkline data from portfolio assets
    // We synthesize historical PnL from the sparkline data of held assets
    const steps = 24;
    const points: PnlPoint[] = [];
    let peakPnl = -Infinity;
    let worstDD = 0;

    for (let i = 0; i < steps; i++) {
      let totalPnl = 0;
      for (const entry of entries) {
        const assetId = entry.symbol === 'XAU' ? 'gold'
          : (AVAILABLE_ASSETS.find(a => a.symbol === entry.symbol)?.id ?? '');

        // Get sparkline data for the asset
        let historicalPrice: number;
        if (assetId === 'gold' && goldSpot?.sparkline) {
          const idx = Math.min(i, goldSpot.sparkline.length - 1);
          historicalPrice = goldSpot.sparkline[Math.max(0, goldSpot.sparkline.length - steps + idx)]?.price ?? entry.buyPrice;
        } else if (prices[assetId]?.sparkline) {
          const sp = prices[assetId].sparkline;
          const idx = Math.min(i, sp.length - 1);
          historicalPrice = sp[Math.max(0, sp.length - steps + idx)]?.price ?? entry.buyPrice;
        } else {
          const curPrice = getCurrentPrice(assetId, prices, goldPrice);
          const progress = i / (steps - 1);
          historicalPrice = entry.buyPrice + (curPrice - entry.buyPrice) * progress;
        }

        totalPnl += entry.amount * (historicalPrice - entry.buyPrice);
      }

      if (totalPnl > peakPnl) peakPnl = totalPnl;
      // Drawdown as percentage from peak (always negative or zero)
      const dd = peakPnl > 0 ? ((totalPnl - peakPnl) / peakPnl) * 100 : 0;
      if (dd < worstDD) worstDD = dd;

      const hoursAgo = steps - 1 - i;
      const label = hoursAgo === 0 ? 'Now' : `${hoursAgo}h ago`;
      points.push({
        label,
        cumulative: Math.round(totalPnl * 100) / 100,
        drawdown: Math.min(0, Math.round(dd * 100) / 100),
      });
    }

    return {
      data: points,
      maxDD: worstDD,
      equityHigh: peakPnl,
      currentPnl: points[points.length - 1]?.cumulative ?? 0,
    };
  }, [entries, prices, goldSpot, goldPrice]);

  if (entries.length === 0 || data.length === 0) return null;

  const isMobile = containerWidth > 0 && containerWidth < 640;

  return (
    <div ref={containerRef} className="glass-card" style={{
      padding: 'var(--space-lg)',
      marginBottom: 'var(--space-md)',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '12px', flexWrap: 'wrap', gap: '8px',
      }}>
        <h3 style={{ margin: 0, fontSize: 'var(--font-base)', fontWeight: 700, color: 'var(--color-text)' }}>
          📉 Portfolio P&amp;L Over Time
        </h3>
        <div style={{ display: 'flex', gap: '8px', fontSize: 'var(--font-xs)' }}>
          <span className={`badge ${currentPnl >= 0 ? 'badge-green' : 'badge-red'}`}>
            {currentPnl >= 0 ? '↑' : '↓'} P&L: ${currentPnl.toFixed(2)}
          </span>
          <span className="badge badge-red">
            ↓ Max DD: {maxDD.toFixed(1)}%
          </span>
        </div>
      </div>

      <div style={{ width: '100%', height: isMobile ? 180 : 240 }} role="img" aria-label="Portfolio profit and loss chart showing cumulative returns and drawdown">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: isMobile ? -10 : 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="label"
              stroke="var(--color-muted)"
              tick={{ fill: 'var(--color-muted)', fontSize: 10 }}
              interval={isMobile ? 5 : 2}
            />
            <YAxis
              stroke="var(--color-muted)"
              tick={{ fill: 'var(--color-muted)', fontSize: 10 }}
              tickFormatter={(v) => `$${v}`}
              width={isMobile ? 45 : 55}
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
                if (name === 'drawdown') return [`${v.toFixed(1)}%`, 'Drawdown'];
                return [`$${v.toFixed(2)}`, 'Cumulative P&L'];
              }}
            />

            <ReferenceLine y={0} stroke="var(--color-muted)" strokeDasharray="4 4" strokeOpacity={0.5} />

            {/* Drawdown shading below zero */}
            <Area
              type="monotone"
              dataKey="drawdown"
              stroke="none"
              fill="var(--color-red)"
              fillOpacity={0.1}
              isAnimationActive={false}
            />

            {/* Equity high reference */}
            {equityHigh > 0 && (
              <ReferenceLine
                y={equityHigh}
                stroke="var(--color-green)"
                strokeDasharray="6 4"
                strokeOpacity={0.4}
                label={{
                  value: `High $${equityHigh.toFixed(0)}`,
                  fill: 'var(--color-green)',
                  fontSize: 9,
                  position: 'right',
                }}
              />
            )}

            {/* Cumulative PnL line */}
            <Line
              type="monotone"
              dataKey="cumulative"
              stroke={currentPnl >= 0 ? 'var(--color-green)' : 'var(--color-red)'}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
