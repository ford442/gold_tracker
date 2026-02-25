import { ResponsiveContainer, LineChart, Line } from 'recharts';
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
      border: '2px solid var(--color-gold)',
      borderRadius: '12px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-gold)', fontWeight: 600, letterSpacing: '0.05em' }}>
            XAU / SPOT GOLD
          </span>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '2px' }}>
            {data.unit}
          </div>
        </div>
        <span style={{ fontSize: '1.2rem' }}>🥇</span>
      </div>

      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-gold)' }}>
        {formatPrice(data.price)}
      </div>

      <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem' }}>
        <span style={{ color: isPositive ? 'var(--color-green)' : 'var(--color-red)' }}>
          24h {formatPercent(data.change24h)}
        </span>
        <span style={{ color: data.change7d >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
          7d {formatPercent(data.change7d)}
        </span>
      </div>

      {sparkData.length > 1 && (
        <div style={{ height: '50px', width: '100%', minWidth: '100px', minHeight: '50px' }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={50}>
            <LineChart data={sparkData}>
              <Line
                type="monotone"
                dataKey="price"
                stroke="var(--color-gold)"
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
