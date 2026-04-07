import { useAlertStore } from '../store/alertStore';
import { useArbitrageAlerts } from '../hooks/useArbitrageAlerts';
import { usePriceStore } from '../store/priceStore';
import { formatPrice, computeSpread } from '../lib/utils';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

function MicroSparkline({ data, color }: { data: { price: number }[]; color: string }) {
  if (data.length < 2) return null;
  return (
    <div style={{ width: '80px', height: '32px' }} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`micro-${color.replace(/[^a-z]/g, '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="price"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#micro-${color.replace(/[^a-z]/g, '')})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ArbitrageAlerts() {
  useArbitrageAlerts();

  const { alerts, dismissAlert, clearAll } = useAlertStore();
  const { prices } = usePriceStore();

  const paxg = prices['pax-gold'];
  const xaut = prices['tether-gold'];
  const activeAlerts = alerts.filter((a) => !a.dismissed);
  const spread = paxg && xaut ? computeSpread(paxg.price, xaut.price) : null;

  const paxgSparkData = paxg?.sparkline?.slice(-12).map(p => ({ price: p.price })) ?? [];
  const xautSparkData = xaut?.sparkline?.slice(-12).map(p => ({ price: p.price })) ?? [];

  return (
    <section aria-label="Arbitrage Alerts" style={{ marginBottom: 'var(--space-2xl)' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 'var(--space-lg)' 
      }}>
        <h2 style={{ 
          margin: 0, 
          fontSize: 'var(--font-xl)', 
          fontWeight: 700, 
          color: 'var(--color-text)',
          letterSpacing: '-0.02em'
        }}>
          🔔 Arbitrage Alerts
        </h2>
        {activeAlerts.length > 0 && (
          <button
            onClick={clearAll}
            aria-label="Clear all alerts"
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-muted)',
              cursor: 'pointer',
              fontSize: 'var(--font-xs)',
              fontWeight: 500
            }}
          >
            Clear all
          </button>
        )}
      </div>

      {/* PAXG vs XAUT live spread with micro-sparklines */}
      {paxg && xaut && (
        <div 
          className="card-hover"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 18px',
            marginBottom: '16px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            alignItems: 'center',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div>
              <div style={{ 
                fontSize: 'var(--font-xs)', 
                color: 'var(--color-muted)',
                fontWeight: 600,
                marginBottom: '2px'
              }}>
                PAXG
              </div>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-base)' }}>
                {formatPrice(paxg.price)}
              </div>
            </div>
            <MicroSparkline data={paxgSparkData} color="var(--color-green)" />
          </div>
          <div style={{ fontSize: '1.3rem', color: 'var(--color-muted)' }}>⇄</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div>
              <div style={{ 
                fontSize: 'var(--font-xs)', 
                color: 'var(--color-muted)',
                fontWeight: 600,
                marginBottom: '2px'
              }}>
                XAUT
              </div>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-base)' }}>
                {formatPrice(xaut.price)}
              </div>
            </div>
            <MicroSparkline data={xautSparkData} color="var(--color-blue)" />
          </div>
          {spread !== null && (
            <div style={{ marginLeft: 'auto' }}>
              <div style={{ 
                fontSize: 'var(--font-xs)', 
                color: 'var(--color-muted)',
                fontWeight: 600,
                marginBottom: '2px'
              }}>
                Spread
              </div>
              <div style={{
                fontWeight: 700,
                fontSize: '1.2rem',
                color: Math.abs(spread) > 0.5 ? 'var(--color-gold)' : 'var(--color-green)',
                fontVariantNumeric: 'tabular-nums'
              }}>
                {spread >= 0 ? '↑ +' : '↓ '}{spread.toFixed(3)}%
              </div>
            </div>
          )}
          {spread !== null && Math.abs(spread) > 0.5 && (
            <span className="badge badge-gold" style={{ fontSize: '0.7rem' }}>
              ⚡ Signal active
            </span>
          )}
        </div>
      )}

      {/* Alert history */}
      {activeAlerts.length === 0 ? (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '32px',
          textAlign: 'center',
          color: 'var(--color-muted)',
          fontSize: 'var(--font-base)',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '10px' }}>✅</div>
          <div style={{ fontWeight: 500 }}>No active alerts</div>
          <div style={{ fontSize: 'var(--font-xs)', marginTop: '6px' }}>
            Spread is within normal range (&lt;0.5%)
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {activeAlerts.map((alert) => (
            <div
              key={alert.id}
              className="card-hover"
              style={{
                background: 'var(--color-surface)',
                border: `1px solid ${alert.type === 'arbitrage' ? 'var(--color-gold)' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '12px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontSize: 'var(--font-base)', 
                  fontWeight: 600, 
                  color: 'var(--color-text)',
                  lineHeight: 1.4
                }}>
                  {alert.type === 'arbitrage' ? '⚡ ' : 'ℹ️ '}
                  {alert.message}
                </div>
                <div style={{ 
                  fontSize: 'var(--font-xs)', 
                  color: 'var(--color-muted)', 
                  marginTop: '6px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px' 
                }}>
                  <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                  {alert.spread && (
                    <span className={`badge ${alert.spread > 0.5 ? 'badge-gold' : 'badge-green'}`}>
                      Spread: {alert.spread >= 0 ? '+' : ''}{alert.spread.toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => dismissAlert(alert.id)}
                aria-label="Dismiss alert"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-muted)',
                  fontSize: '1.1rem',
                  padding: '4px',
                  flexShrink: 0,
                  minWidth: '32px',
                  minHeight: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'color 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-red)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-muted)'}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
