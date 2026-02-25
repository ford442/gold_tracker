import { ResponsiveContainer, LineChart, Line, Tooltip } from 'recharts';
import type { PriceData } from '../types';
import { formatPrice, formatPercent } from '../lib/utils';

interface Props {
  data: PriceData;
  goldPrice?: number; // for premium/discount calculation
}

export function PriceCard({ data, goldPrice }: Props) {
  const isPositive24h = data.change24h >= 0;
  const isPositive7d = data.change7d >= 0;
  const isGoldToken = data.id === 'pax-gold' || data.id === 'tether-gold';
  const premium = isGoldToken && goldPrice ? ((data.price - goldPrice) / goldPrice) * 100 : null;

  const sparkData = data.sparkline.slice(-24).map((p) => ({ price: p.price }));

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: '12px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>
            {data.symbol}
          </span>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-muted)', marginTop: '2px' }}>
            {data.name}
          </div>
        </div>
        {premium !== null && (
          <span style={{
            fontSize: '0.7rem',
            padding: '2px 7px',
            borderRadius: '999px',
            background: premium >= 0 ? 'rgba(0,216,164,0.15)' : 'rgba(255,94,125,0.15)',
            color: premium >= 0 ? 'var(--color-green)' : 'var(--color-red)',
            fontWeight: 600,
          }}>
            {premium >= 0 ? '+' : ''}{premium.toFixed(2)}% vs spot
          </span>
        )}
      </div>

      {/* Price */}
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-text)' }}>
        {formatPrice(data.price)}
      </div>

      {/* Changes */}
      <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem' }}>
        <span style={{ color: isPositive24h ? 'var(--color-green)' : 'var(--color-red)' }}>
          24h {formatPercent(data.change24h)}
        </span>
        <span style={{ color: isPositive7d ? 'var(--color-green)' : 'var(--color-red)' }}>
          7d {formatPercent(data.change7d)}
        </span>
      </div>

      {/* Sparkline */}
      {sparkData.length > 1 && (
        <div style={{ height: '50px', width: '100%', minWidth: '100px', minHeight: '50px' }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={50}>
            <LineChart data={sparkData}>
              <Line
                type="monotone"
                dataKey="price"
                stroke={isPositive24h ? 'var(--color-green)' : 'var(--color-red)'}
                strokeWidth={1.5}
                dot={false}
              />
              <Tooltip
                contentStyle={{ display: 'none' }}
                wrapperStyle={{ display: 'none' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
