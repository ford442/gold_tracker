import { useAlertStore } from '../store/alertStore';
import { useArbitrageAlerts } from '../hooks/useArbitrageAlerts';
import { usePriceStore } from '../store/priceStore';
import { formatPrice, computeSpread } from '../lib/utils';

export function ArbitrageAlerts() {
  // Activate alert detection
  useArbitrageAlerts();

  const { alerts, dismissAlert, clearAll } = useAlertStore();
  const { prices } = usePriceStore();

  const paxg = prices['pax-gold'];
  const xaut = prices['tether-gold'];
  const activeAlerts = alerts.filter((a) => !a.dismissed);
  const spread = paxg && xaut ? computeSpread(paxg.price, xaut.price) : null;

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-text)' }}>
          🔔 Arbitrage Alerts
        </h2>
        {activeAlerts.length > 0 && (
          <button
            onClick={clearAll}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-muted)',
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
          >
            Clear all
          </button>
        )}
      </div>

      {/* PAXG vs XAUT live spread */}
      {paxg && xaut && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          padding: '14px 16px',
          marginBottom: '12px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>PAXG</div>
            <div style={{ fontWeight: 700 }}>{formatPrice(paxg.price)}</div>
          </div>
          <div style={{ fontSize: '1.2rem', color: 'var(--color-muted)' }}>⇄</div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>XAUT</div>
            <div style={{ fontWeight: 700 }}>{formatPrice(xaut.price)}</div>
          </div>
          {spread !== null && (
            <div style={{ marginLeft: 'auto' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>Spread</div>
              <div style={{
                fontWeight: 700,
                fontSize: '1.1rem',
                color: Math.abs(spread) > 0.5 ? 'var(--color-gold)' : 'var(--color-green)',
              }}>
                {spread >= 0 ? '+' : ''}{spread.toFixed(3)}%
              </div>
            </div>
          )}
          {spread !== null && Math.abs(spread) > 0.5 && (
            <div style={{
              padding: '4px 10px',
              borderRadius: '999px',
              background: 'rgba(245,200,66,0.15)',
              color: 'var(--color-gold)',
              fontSize: '0.75rem',
              fontWeight: 700,
            }}>
              ⚡ Signal active
            </div>
          )}
        </div>
      )}

      {/* Alert history */}
      {activeAlerts.length === 0 ? (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          padding: '24px',
          textAlign: 'center',
          color: 'var(--color-muted)',
          fontSize: '0.875rem',
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
                borderRadius: '10px',
                padding: '12px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text)' }}>
                  {alert.type === 'arbitrage' ? '⚡ ' : 'ℹ️ '}
                  {alert.message}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginTop: '4px' }}>
                  {new Date(alert.timestamp).toLocaleTimeString()}
                  {alert.spread && ` · Spread: ${alert.spread.toFixed(2)}%`}
                </div>
              </div>
              <button
                onClick={() => dismissAlert(alert.id)}
                aria-label="Dismiss"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-muted)',
                  fontSize: '1rem',
                  padding: '2px',
                  flexShrink: 0,
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
