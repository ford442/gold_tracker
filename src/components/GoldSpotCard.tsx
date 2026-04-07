import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import type { GoldSpot } from '../types';
import { formatPrice, formatPercent } from '../lib/utils';

interface Props {
  data: GoldSpot;
}

export function GoldSpotCard({ data }: Props) {
  const isPositive = data.change24h >= 0;
  const sparkData = data.sparkline.slice(-24).map((p) => ({ price: p.price }));

  return (
    <div 
      className="card-hover"
      style={{
        background: 'var(--color-surface)',
        backgroundImage: 'var(--gradient-gold)',
        border: '2px solid var(--color-gold)',
        borderRadius: 'var(--radius-lg)',
        padding: '18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: 'var(--shadow-md)',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'default',
      }} 
      role="article" 
      aria-label="Spot Gold price card"
    >
      {/* Gold accent decoration */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '100px',
          height: '100px',
          background: 'radial-gradient(circle at top right, rgba(245,200,66,0.1) 0%, transparent 70%)',
          pointerEvents: 'none'
        }}
        aria-hidden="true"
      />
      
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
              background: 'rgba(245,200,66,0.15)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-gold)'
            }}
            aria-hidden="true"
          >
            🥇
          </span>
          <div>
            <span style={{ 
              fontSize: 'var(--font-sm)', 
              color: 'var(--color-gold)', 
              fontWeight: 700, 
              letterSpacing: '0.05em',
              textTransform: 'uppercase'
            }}>
              XAU / Spot Gold
            </span>
            <div style={{ 
              fontSize: 'var(--font-xs)', 
              color: 'var(--color-muted)', 
              marginTop: '2px',
              fontWeight: 500,
              letterSpacing: '0.03em'
            }}>
              {data.unit}
            </div>
          </div>
        </div>
        <span 
          className="badge badge-gold"
          style={{ 
            fontSize: '0.65rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em'
          }}
        >
          Reference
        </span>
      </div>

      <div style={{ 
        fontSize: '1.7rem', 
        fontWeight: 700, 
        color: 'var(--color-gold)', 
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.02em'
      }}>
        {formatPrice(data.price)}
      </div>

      <div style={{ display: 'flex', gap: '12px', fontSize: 'var(--font-sm)' }}>
        <span style={{ 
          color: isPositive ? 'var(--color-green)' : 'var(--color-red)',
          background: isPositive ? 'var(--color-green-dim)' : 'var(--color-red-dim)',
          padding: '4px 8px',
          borderRadius: 'var(--radius-sm)',
          fontWeight: 600,
          fontSize: 'var(--font-xs)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          {isPositive ? '↑' : '↓'} 24h {formatPercent(data.change24h)}
        </span>
        <span style={{ 
          color: data.change7d >= 0 ? 'var(--color-green)' : 'var(--color-red)',
          background: data.change7d >= 0 ? 'var(--color-green-dim)' : 'var(--color-red-dim)',
          padding: '4px 8px',
          borderRadius: 'var(--radius-sm)',
          fontWeight: 600,
          fontSize: 'var(--font-xs)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          {data.change7d >= 0 ? '↑' : '↓'} 7d {formatPercent(data.change7d)}
        </span>
      </div>

      {sparkData.length > 1 && (
        <div style={{ height: '50px', width: '100%', marginTop: '4px' }} aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData}>
              <defs>
                <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-gold)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--color-gold)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="price"
                stroke="var(--color-gold)"
                strokeWidth={2}
                fill="url(#goldGradient)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
