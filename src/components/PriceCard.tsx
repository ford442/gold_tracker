import { LineChart, Line, ResponsiveContainer } from 'recharts';
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
      borderRadius: 'var(--radius-lg)',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      boxShadow: 'var(--shadow-sm)',
      transition: 'border-color 0.15s, box-shadow 0.15s',
    }} role="article" aria-label={`${data.name} price card`}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', fontWeight: 600, letterSpacing: '0.05em' }}>
            {data.symbol}
          </span>
          <div style={{ fontSize: 'var(--font-base)', color: 'var(--color-muted)', marginTop: '2px' }}>
            {data.name}
          </div>
        </div>
        {premium !== null && (
          <span className={`badge ${premium >= 0 ? 'badge-green' : 'badge-red'}`}>
            {premium >= 0 ? '↑ +' : '↓ '}{premium.toFixed(2)}% vs spot
          </span>
        )}
      </div>

      {/* Price */}
      <div style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>
        {formatPrice(data.price)}
      </div>

      {/* Changes - arrows + signs for accessibility */}
      <div style={{ display: 'flex', gap: '12px', fontSize: 'var(--font-sm)' }}>
        <span style={{ color: isPositive24h ? 'var(--color-green)' : 'var(--color-red)' }}>
          {isPositive24h ? '↑' : '↓'} 24h {formatPercent(data.change24h)}
        </span>
        <span style={{ color: isPositive7d ? 'var(--color-green)' : 'var(--color-red)' }}>
          {isPositive7d ? '↑' : '↓'} 7d {formatPercent(data.change7d)}
        </span>
      </div>

      {/* Sparkline - responsive */}
      {sparkData.length > 1 && (
        <div style={{ height: '50px', width: '100%' }} aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData}>
              <Line
                type="monotone"
                dataKey="price"
                stroke={isPositive24h ? 'var(--color-green)' : 'var(--color-red)'}
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
