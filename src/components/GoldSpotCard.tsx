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
      className="card-hover glass-card-gold"
      style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        cursor: 'default',
      }} 
      role="article" 
      aria-label="Spot Gold price card"
    >
      {/* Gold ambient corner glow */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '140px',
          height: '140px',
          background: 'radial-gradient(circle at top right, rgba(240,200,69,0.10) 0%, transparent 65%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
        aria-hidden="true"
      />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span 
            style={{ 
              fontSize: '1.3rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '38px',
              height: '38px',
              background: 'linear-gradient(135deg, rgba(240,200,69,0.18), rgba(240,200,69,0.06))',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(240,200,69,0.25)',
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
              fontSize: '0.65rem', 
              color: 'var(--color-muted)', 
              marginTop: '2px',
              fontWeight: 500,
              letterSpacing: '0.04em'
            }}>
              {data.unit}
            </div>
          </div>
        </div>
        <span 
          className="badge badge-gold"
          style={{ 
            fontSize: '0.6rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Reference
        </span>
      </div>

      <div style={{ 
        fontSize: 'var(--font-2xl)', 
        fontWeight: 800, 
        color: 'var(--color-gold)', 
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.03em',
        textShadow: '0 0 24px rgba(240,200,69,0.12)',
        position: 'relative',
        zIndex: 2,
      }}>
        {formatPrice(data.price)}
      </div>

      <div style={{ display: 'flex', gap: '8px', fontSize: 'var(--font-sm)', position: 'relative', zIndex: 2 }}>
        <span className={`change-chip ${isPositive ? 'change-chip-green' : 'change-chip-red'}`}>
          {isPositive ? '↑' : '↓'} 24h {formatPercent(data.change24h)}
        </span>
        <span className={`change-chip ${data.change7d >= 0 ? 'change-chip-green' : 'change-chip-red'}`}>
          {data.change7d >= 0 ? '↑' : '↓'} 7d {formatPercent(data.change7d)}
        </span>
      </div>

      {sparkData.length > 1 && (
        <div style={{ height: '52px', width: '100%', marginTop: '2px', position: 'relative', zIndex: 2 }} aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData}>
              <defs>
                <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-gold)" stopOpacity={0.35} />
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
