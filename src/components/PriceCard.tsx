import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import type { PriceData } from '../types';
import { formatPrice, formatPercent } from '../lib/utils';

interface Props {
  data: PriceData;
  goldPrice?: number; // for premium/discount calculation
}

// Asset icons mapping
const ASSET_ICONS: Record<string, string> = {
  'pax-gold': '🪙',
  'tether-gold': '🟡',
  'bitcoin': '₿',
  'ethereum': 'Ξ',
  'bitcoin-cash': 'BCH',
};

export function PriceCard({ data, goldPrice }: Props) {
  const isPositive24h = data.change24h >= 0;
  const isPositive7d = data.change7d >= 0;
  const isGoldToken = data.id === 'pax-gold' || data.id === 'tether-gold';
  const premium = isGoldToken && goldPrice ? ((data.price - goldPrice) / goldPrice) * 100 : null;

  const sparkData = data.sparkline.slice(-24).map((p) => ({ price: p.price }));
  const icon = ASSET_ICONS[data.id] || '💎';

  return (
    <div 
      className="card-hover"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: 'var(--shadow-sm)',
        cursor: 'default',
      }} 
      role="article" 
      aria-label={`${data.name} price card`}
    >
      {/* Header with icon */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span 
            style={{ 
              fontSize: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              background: 'var(--color-surface2)',
              borderRadius: 'var(--radius-md)',
            }}
            aria-hidden="true"
          >
            {icon}
          </span>
          <div>
            <span style={{ 
              fontSize: 'var(--font-sm)', 
              color: 'var(--color-text)', 
              fontWeight: 700, 
              letterSpacing: '0.02em' 
            }}>
              {data.symbol}
            </span>
            <div style={{ 
              fontSize: 'var(--font-xs)', 
              color: 'var(--color-muted)', 
              marginTop: '2px',
              fontWeight: 500
            }}>
              {data.name}
            </div>
          </div>
        </div>
        {premium !== null && (
          <span className={`badge ${premium >= 0 ? 'badge-green' : 'badge-red'}`}>
            {premium >= 0 ? '↑ +' : '↓ '}{premium.toFixed(2)}% vs spot
          </span>
        )}
      </div>

      {/* Price with larger font */}
      <div style={{ 
        fontSize: '1.6rem', 
        fontWeight: 700, 
        color: 'var(--color-text)', 
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.02em'
      }}>
        {formatPrice(data.price)}
      </div>

      {/* Changes - arrows + signs with background tint */}
      <div style={{ display: 'flex', gap: '8px', fontSize: 'var(--font-sm)' }}>
        <span style={{
          color: isPositive24h ? 'var(--color-green)' : 'var(--color-red)',
          background: isPositive24h ? 'var(--color-green-dim)' : 'var(--color-red-dim)',
          padding: '4px 8px',
          borderRadius: 'var(--radius-sm)',
          fontWeight: 600,
          fontSize: 'var(--font-xs)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          {isPositive24h ? '↑' : '↓'} 24h {formatPercent(data.change24h)}
        </span>
        <span style={{
          color: isPositive7d ? 'var(--color-green)' : 'var(--color-red)',
          background: isPositive7d ? 'var(--color-green-dim)' : 'var(--color-red-dim)',
          padding: '4px 8px',
          borderRadius: 'var(--radius-sm)',
          fontWeight: 600,
          fontSize: 'var(--font-xs)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          {isPositive7d ? '↑' : '↓'} 7d {formatPercent(data.change7d)}
        </span>
      </div>

      {/* Sparkline with gradient fill */}
      {sparkData.length > 1 && (
        <div style={{ height: '50px', width: '100%', marginTop: '4px' }} aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData}>
              <defs>
                <linearGradient id={`gradient-${data.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop 
                    offset="5%" 
                    stopColor={isPositive24h ? 'var(--color-green)' : 'var(--color-red)'} 
                    stopOpacity={0.3} 
                  />
                  <stop 
                    offset="95%" 
                    stopColor={isPositive24h ? 'var(--color-green)' : 'var(--color-red)'} 
                    stopOpacity={0} 
                  />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="price"
                stroke={isPositive24h ? 'var(--color-green)' : 'var(--color-red)'}
                strokeWidth={2}
                fill={`url(#gradient-${data.id})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
