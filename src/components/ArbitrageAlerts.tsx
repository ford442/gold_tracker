import { useAlertStore } from '../store/alertStore';
import { useArbitrageAlerts } from '../hooks/useArbitrageAlerts';
import { usePriceStore } from '../store/priceStore';
import { formatPrice, computeSpread } from '../lib/utils';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

function MicroSparkline({ data, color }: { data: { price: number }[]; color: string }) {
  if (data.length < 2) return null;
  return (
    <div style={{ width: '80px', height: '28px' }} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="price"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ArbitrageAlerts() {
  // Activate alert detection
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
    <section aria-label="Arbitrage Alerts">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--font-lg)', color: 'var(--color-text)' }}>
          🔔 Arbitrage Alerts
        </h2>
        {activeAlerts.length > 0 && (
          <button
            onClick={clearAll}
            aria-label="Clear all alerts"
            style={{
              padding: 'var(--space-xs) 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-muted)',
              cursor: 'pointer',
              fontSize: 'var(--font-xs)',
              minHeight: '44px',
              minWidth: '44px',
            }}
          >
            Clear all
          </button>
        )}
      </div>

      {/* PAXG vs XAUT live spread with micro-sparklines */}
      {paxg && xaut && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '14px 16px',
          marginBottom: '12px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>PAXG</div>
              <div style={{ fontWeight: 700 }}>{formatPrice(paxg.price)}</div>
            </div>
            <MicroSparkline data={paxgSparkData} color="var(--color-green)" />
          </div>
          <div style={{ fontSize: '1.2rem', color: 'var(--color-muted)' }}>⇄</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>XAUT</div>
              <div style={{ fontWeight: 700 }}>{formatPrice(xaut.price)}</div>
            </div>
            <MicroSparkline data={xautSparkData} color="var(--color-blue)" />
          </div>
          {spread !== null && (
            <div style={{ marginLeft: 'auto' }}>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>Spread</div>
              <div style={{
                fontWeight: 700,
                fontSize: '1.1rem',
                color: Math.abs(spread) > 0.5 ? 'var(--color-gold)' : 'var(--color-green)',
              }}>
                {spread >= 0 ? '↑ +' : '↓ '}{spread.toFixed(3)}%
              </div>
            </div>
          )}
          {spread !== null && Math.abs(spread) > 0.5 && (
            <span className="badge badge-gold">⚡ Signal active</span>
          )}
        </div>
      )}

      {/* Alert history */}
      {activeAlerts.length === 0 ? (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          textAlign: 'center',
          color: 'var(--color-muted)',
          fontSize: 'var(--font-base)',
        }}>
          ✅ No active alerts — spread is within normal range (&lt;0.5%)
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {activeAlerts.map((alert) => (
            <div
              key={alert.id}
              style={{
                background: 'var(--color-surface)',
                border: `1px solid ${alert.type === 'arbitrage' ? 'var(--color-gold)' : 'var(--color-border)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '12px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div>
                <div style={{ fontSize: 'var(--font-base)', fontWeight: 600, color: 'var(--color-text)' }}>
                  {alert.type === 'arbitrage' ? '⚡ ' : 'ℹ️ '}
                  {alert.message}
                </div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                  fontSize: '1rem',
                  padding: '2px',
                  flexShrink: 0,
                  minWidth: '44px',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 'var(--radius-sm)',
                }}
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
