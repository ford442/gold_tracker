import { useState } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { usePriceStore } from '../store/priceStore';
import { formatPrice, formatPercent } from '../lib/utils';
import type { MetalSpot } from '../types';
import { CardSkeleton } from './LoadingSkeleton';

// Metal icon mapping
const METAL_ICONS: Record<string, string> = {
  silver:    '🥈',
  platinum:  '⬜',
  palladium: '🔘',
};

// Accent colors per metal for charts / badges
const METAL_COLORS: Record<string, string> = {
  gold:      '#f0c845',
  silver:    '#94a3b8',
  platinum:  '#7dd3fc',
  palladium: '#a78bfa',
};

interface MetalCardProps {
  metal: MetalSpot;
}

function MetalCard({ metal }: MetalCardProps) {
  const isPositive24h = metal.change24h >= 0;
  const isPositive7d  = metal.change7d >= 0;
  const sparkData = metal.sparkline.slice(-24).map((p) => ({ price: p.price }));
  const color = METAL_COLORS[metal.id] ?? 'var(--color-muted)';

  return (
    <div
      className="card-hover glass-card"
      style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        cursor: 'default',
        position: 'relative',
        overflow: 'hidden',
      }}
      role="article"
      aria-label={`${metal.name} spot price card`}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '120px',
          height: '120px',
          background: `radial-gradient(circle at top right, ${color}18 0%, transparent 65%)`,
          pointerEvents: 'none',
          zIndex: 0,
        }}
        aria-hidden="true"
      />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              fontSize: '1.2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '38px',
              height: '38px',
              background: `linear-gradient(135deg, ${color}28, ${color}0a)`,
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${color}35`,
            }}
            aria-hidden="true"
          >
            {METAL_ICONS[metal.id] ?? '🔶'}
          </span>
          <div>
            <span style={{ fontSize: 'var(--font-sm)', color, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {metal.symbol} / {metal.name}
            </span>
            <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--color-muted)', marginTop: '2px', fontWeight: 500, letterSpacing: '0.04em' }}>
              {metal.unit}
            </div>
          </div>
        </div>
        <span className="badge badge-gold" style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Reference
        </span>
      </div>

      {/* Price */}
      <div style={{
        fontSize: 'var(--font-2xl)',
        fontWeight: 800,
        color,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.03em',
        textShadow: `0 0 24px ${color}20`,
        position: 'relative',
        zIndex: 2,
      }}>
        {formatPrice(metal.price)}
      </div>

      {/* Change chips */}
      <div style={{ display: 'flex', gap: '8px', fontSize: 'var(--font-sm)', position: 'relative', zIndex: 2, flexWrap: 'wrap' }}>
        <span className={`change-chip ${isPositive24h ? 'change-chip-green' : 'change-chip-red'}`}>
          {isPositive24h ? '↑' : '↓'} 24h {formatPercent(metal.change24h)}
        </span>
        <span className={`change-chip ${isPositive7d ? 'change-chip-green' : 'change-chip-red'}`}>
          {isPositive7d ? '↑' : '↓'} 7d {formatPercent(metal.change7d)}
        </span>
      </div>

      {/* Sparkline */}
      {sparkData.length > 1 && (
        <div style={{ height: '52px', position: 'relative', zIndex: 2, opacity: 0.7 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`metal-grad-${metal.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="price"
                stroke={color}
                strokeWidth={1.5}
                fill={`url(#metal-grad-${metal.id})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// Build a normalized comparison dataset from sparklines
function buildComparisonData(
  goldSparkline: Array<{ price: number }>,
  metals: MetalSpot[],
  selectedIds: string[],
): Array<Record<string, number | string>> {
  const len = goldSparkline.length;
  if (len === 0) return [];

  const goldBase = goldSparkline[0].price;
  if (!goldBase) return [];

  const rows = goldSparkline.map((pt, i) => {
    const row: Record<string, number | string> = {
      tick: i,
      Gold: Math.round(((pt.price - goldBase) / goldBase) * 1000) / 10,
    };
    for (const m of metals) {
      if (!selectedIds.includes(m.id)) continue;
      const spark = m.sparkline.slice(-len);
      if (spark.length === 0) continue;
      const base = spark[0].price;
      if (!base) continue;
      const p = spark[i]?.price ?? spark[spark.length - 1].price;
      row[m.name] = Math.round(((p - base) / base) * 1000) / 10;
    }
    return row;
  });

  return rows;
}

export function PreciousMetalsPanel() {
  const { goldSpot, otherMetals, isLoading } = usePriceStore();

  // Which metals are toggled on for the comparison chart
  const [selectedIds, setSelectedIds] = useState<string[]>(['silver', 'platinum', 'palladium']);

  const toggleMetal = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const goldPrice = goldSpot?.price ?? null;

  // Build comparison chart data from sparklines
  const goldSpark = goldSpot ? goldSpot.sparkline.slice(-24).map((p) => ({ price: p.price })) : [];
  const compData = buildComparisonData(goldSpark, otherMetals, selectedIds);

  // Lines to render on the comparison chart
  const chartLines: Array<{ key: string; color: string }> = [
    { key: 'Gold', color: METAL_COLORS.gold },
    ...otherMetals
      .filter((m) => selectedIds.includes(m.id))
      .map((m) => ({ key: m.name, color: METAL_COLORS[m.id] ?? 'var(--color-muted)' })),
  ];

  const hasData = goldSpot || otherMetals.length > 0;

  return (
    <section aria-label="Precious Metals Comparison">
      {/* Section heading */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--space-lg)',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <h2 className="section-heading">
          <span className="heading-icon">🏅</span>
          Precious Metals
        </h2>
        <span className="badge badge-gold" style={{ fontSize: '0.65rem', letterSpacing: '0.06em' }}>
          Silver · Platinum · Palladium
        </span>
      </div>

      {/* Metal price cards */}
      <div
        className="reflection-zone"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 'var(--space-md)',
          marginBottom: 'var(--space-xl)',
        }}
      >
        {isLoading && !hasData ? (
          Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          otherMetals.map((metal) => (
            <MetalCard key={metal.id} metal={metal} />
          ))
        )}
      </div>

      {/* Comparison chart */}
      {hasData && (
        <div className="glass-card" style={{ padding: 'var(--space-lg)' }}>
          {/* Chart header + toggles */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '10px',
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-base)', color: 'var(--color-text)' }}>
                24h Relative Performance
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', marginTop: '2px' }}>
                Normalized % return vs 24 hours ago
              </div>
            </div>

            {/* Metal toggle pills */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {otherMetals.map((m) => {
                const active = selectedIds.includes(m.id);
                const color = METAL_COLORS[m.id] ?? 'var(--color-muted)';
                return (
                  <button
                    key={m.id}
                    onClick={() => toggleMetal(m.id)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '999px',
                      border: `1px solid ${active ? color : 'var(--color-border)'}`,
                      background: active ? `${color}18` : 'transparent',
                      color: active ? color : 'var(--color-muted)',
                      fontSize: 'var(--font-xs)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                      letterSpacing: '0.04em',
                    }}
                    aria-pressed={active}
                    aria-label={`Toggle ${m.name} on chart`}
                  >
                    {METAL_ICONS[m.id]} {m.symbol}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chart */}
          <div style={{ height: '260px', width: '100%' }} role="img" aria-label="24-hour relative performance comparison chart for precious metals">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={compData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="tick" hide />
                <YAxis
                  stroke="var(--color-muted)"
                  tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
                  tickFormatter={(v) => `${v}%`}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-text)',
                  }}
                  formatter={(value) => [`${Number(value) >= 0 ? '+' : ''}${value}%`, '']}
                />
                <Legend wrapperStyle={{ color: 'var(--color-text)', paddingTop: '16px' }} />
                {chartLines.map((l) => (
                  <Line
                    key={l.key}
                    type="monotone"
                    dataKey={l.key}
                    stroke={l.color}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, stroke: l.color, strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Comparison table */}
          <div style={{ marginTop: '20px', overflowX: 'auto' }}>
            <table
              className="table-zebra"
              style={{ width: '100%', fontSize: 'var(--font-sm)', borderCollapse: 'collapse' }}
              aria-label="Precious metals price comparison table"
            >
              <thead>
                <tr style={{ color: 'var(--color-muted)', fontSize: 'var(--font-xs)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <th style={{ textAlign: 'left',  padding: '8px 10px', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>Metal</th>
                  <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>Price</th>
                  <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>24h</th>
                  <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>7d</th>
                  <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>Gold Ratio</th>
                </tr>
              </thead>
              <tbody>
                {/* Gold row */}
                {goldSpot && (
                  <tr>
                    <td style={{ padding: '9px 10px', fontWeight: 600, color: 'var(--color-gold)' }}>
                      🥇 Gold (XAU)
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--color-text)' }}>
                      {formatPrice(goldSpot.price)}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                      <span className={`change-chip ${goldSpot.change24h >= 0 ? 'change-chip-green' : 'change-chip-red'}`}>
                        {goldSpot.change24h >= 0 ? '+' : ''}{formatPercent(goldSpot.change24h)}
                      </span>
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                      <span className={`change-chip ${goldSpot.change7d >= 0 ? 'change-chip-green' : 'change-chip-red'}`}>
                        {goldSpot.change7d >= 0 ? '+' : ''}{formatPercent(goldSpot.change7d)}
                      </span>
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--color-muted)', fontSize: 'var(--font-xs)' }}>
                      —
                    </td>
                  </tr>
                )}

                {/* Other metals rows */}
                {otherMetals.map((m) => {
                  const ratio = goldPrice ? goldPrice / m.price : null;
                  const color = METAL_COLORS[m.id] ?? 'var(--color-muted)';
                  return (
                    <tr key={m.id}>
                      <td style={{ padding: '9px 10px', fontWeight: 600, color }}>
                        {METAL_ICONS[m.id]} {m.name} ({m.symbol})
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--color-text)' }}>
                        {formatPrice(m.price)}
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                        <span className={`change-chip ${m.change24h >= 0 ? 'change-chip-green' : 'change-chip-red'}`}>
                          {m.change24h >= 0 ? '+' : ''}{formatPercent(m.change24h)}
                        </span>
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                        <span className={`change-chip ${m.change7d >= 0 ? 'change-chip-green' : 'change-chip-red'}`}>
                          {m.change7d >= 0 ? '+' : ''}{formatPercent(m.change7d)}
                        </span>
                      </td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: 'var(--color-muted)', fontVariantNumeric: 'tabular-nums', fontSize: 'var(--font-xs)' }}>
                        {ratio !== null ? `1:${ratio.toFixed(1)}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
