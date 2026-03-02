import { LineChart, Line, ResponsiveContainer } from 'recharts';
import type { GoldSpot } from '../types';
import { formatPrice, formatPercent } from '../lib/utils';

interface Props {
  data: GoldSpot;
}

export function GoldSpotCard({ data }: Props) {
  const isPositive = data.change24h >= 0;
  const sparkData = data.sparkline.slice(-24).map((p) => ({ price: p.price }));

  return (
    <div style={{
      background: 'var(--color-surface)',
      backgroundImage: 'var(--gradient-gold)',
      border: '2px solid var(--color-gold)',
      borderRadius: 'var(--radius-lg)',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      boxShadow: 'var(--shadow-md)',
    }} role="article" aria-label="Spot Gold price card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-gold)', fontWeight: 600, letterSpacing: '0.05em' }}>
            XAU / SPOT GOLD
          </span>
          <div style={{ fontSize: 'var(--font-base)', color: 'var(--color-muted)', marginTop: '2px' }}>
            {data.unit}
          </div>
        </div>
        <span style={{ fontSize: '1.2rem' }} role="img" aria-label="Gold medal">🥇</span>
      </div>

      <div style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: 'var(--color-gold)', fontVariantNumeric: 'tabular-nums' }}>
        {formatPrice(data.price)}
      </div>

      <div style={{ display: 'flex', gap: '12px', fontSize: 'var(--font-sm)' }}>
        <span style={{ color: isPositive ? 'var(--color-green)' : 'var(--color-red)' }}>
          {isPositive ? '↑' : '↓'} 24h {formatPercent(data.change24h)}
        </span>
        <span style={{ color: data.change7d >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
          {data.change7d >= 0 ? '↑' : '↓'} 7d {formatPercent(data.change7d)}
        </span>
      </div>

      {sparkData.length > 1 && (
        <div style={{ height: '50px', width: '100%' }} aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <Line
                type="monotone"
                dataKey="price"
                stroke="var(--color-gold)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
