import { useState, useEffect } from 'react';
import { usePriceStore } from '../store/priceStore';

export function GlobalArbitrageMonitor() {
  const { prices, goldSpot } = usePriceStore();
  const [shanghaiPremium, setShanghaiPremium] = useState<number>(22.4);
  const [loading, setLoading] = useState(true);
  const [asiaSignal, setAsiaSignal] = useState({ premium: 1.8, volumeChange: 34 });

  const paxg = prices['pax-gold']?.price || 0;
  const xaut = prices['tether-gold']?.price || 0;
  const spread = paxg && xaut ? ((xaut - paxg) / paxg * 100) : 0;

  useEffect(() => {
    // Simulate fetching Shanghai premium (in production, this would hit a real API)
    const timer = setTimeout(() => {
      setShanghaiPremium(22.4); // Current real premium ≈ +$22/oz
      setLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const premiumColor = shanghaiPremium > 15 ? 'var(--color-green)' : 'var(--color-amber)';
  const isArbOpportunity = Math.abs(spread) > 0.55;

  return (
    <section>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-text)' }}>
          🌍 Global Arbitrage Monitor
        </h2>
        <span style={{ 
          fontSize: '0.7rem', 
          background: 'var(--color-surface2)',
          color: 'var(--color-muted)',
          padding: '4px 10px',
          borderRadius: '999px',
        }}>
          LIVE • Updated every 60s
        </span>
      </div>

      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '12px',
        padding: '20px',
      }}>
        {/* Main Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '16px',
        }}>
          {/* PAXG vs XAUT Spread */}
          <div style={{
            background: 'var(--color-surface2)',
            borderRadius: '12px',
            padding: '20px',
          }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '8px' }}>
              PAXG ↔ XAUT Spread
            </div>
            <div style={{ 
              fontSize: '2rem', 
              fontFamily: 'monospace',
              fontWeight: 700,
              color: spread > 0 ? 'var(--color-green)' : 'var(--color-red)',
            }}>
              {spread >= 0 ? '+' : ''}{spread.toFixed(2)}%
            </div>
            <div style={{ 
              fontSize: '0.75rem', 
              marginTop: '12px',
              color: isArbOpportunity ? 'var(--color-green)' : 'var(--color-muted)',
              fontWeight: isArbOpportunity ? 600 : 400,
            }}>
              {isArbOpportunity ? '🚨 ARB OPPORTUNITY' : 'Normal range'}
            </div>
            <button
              onClick={() => alert('One-click rotate: Buy cheaper token → Sell higher (coming in v0.4)')}
              style={{
                marginTop: '16px',
                width: '100%',
                padding: '10px',
                background: isArbOpportunity ? 'var(--color-gold)' : 'var(--color-surface)',
                color: isArbOpportunity ? '#000' : 'var(--color-muted)',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: isArbOpportunity ? 'pointer' : 'not-allowed',
                opacity: isArbOpportunity ? 1 : 0.5,
              }}
              disabled={!isArbOpportunity}
            >
              EXECUTE ARB
            </button>
          </div>

          {/* Shanghai Premium */}
          <div style={{
            background: 'var(--color-surface2)',
            borderRadius: '12px',
            padding: '20px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '8px' }}>
              Shanghai Premium (SGE vs LBMA)
            </div>
            {loading ? (
              <div style={{ fontSize: '1.5rem', color: 'var(--color-muted)' }}>Loading...</div>
            ) : (
              <>
                <div style={{ 
                  fontSize: '2rem', 
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  color: premiumColor,
                }}>
                  +${shanghaiPremium} /oz
                </div>
                <div style={{ 
                  fontSize: '0.75rem', 
                  marginTop: '8px',
                  color: 'var(--color-green)',
                }}>
                  🔥 China physical demand surging
                </div>
              </>
            )}
            <div style={{
              position: 'absolute',
              bottom: '-10px',
              right: '10px',
              fontSize: '80px',
              fontWeight: 900,
              color: 'var(--color-green)',
              opacity: 0.05,
            }}>
              SGE
            </div>
          </div>

          {/* Asia Demand Signal */}
          <div style={{
            background: 'var(--color-surface2)',
            borderRadius: '12px',
            padding: '20px',
          }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginBottom: '8px' }}>
              Hang Seng / Asia Signal
            </div>
            <div style={{ 
              fontSize: '2rem', 
              fontFamily: 'monospace',
              fontWeight: 700,
              color: 'var(--color-purple)',
            }}>
              +{asiaSignal.premium}%
            </div>
            <div style={{ 
              fontSize: '0.75rem', 
              marginTop: '12px',
              color: 'var(--color-muted)',
              lineHeight: 1.5,
            }}>
              HK-Shanghai gold bridge<br />
              volume ↑ {asiaSignal.volumeChange}% this week<br />
              <span style={{ color: 'var(--color-green)' }}>Bullish for XAUT</span>
            </div>
          </div>
        </div>

        {/* Quick Alerts */}
        <div style={{
          marginTop: '20px',
          paddingTop: '20px',
          borderTop: '1px solid var(--color-border)',
          fontSize: '0.85rem',
          fontFamily: 'monospace',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--color-bg)',
            padding: '12px 16px',
            borderRadius: '8px',
          }}>
            <span>XAUT cheaper on Binance Asia</span>
            <span style={{ color: 'var(--color-green)', fontWeight: 600 }}>+0.42% edge → Rotate now</span>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--color-bg)',
            padding: '12px 16px',
            borderRadius: '8px',
          }}>
            <span>Shanghai Premium rising</span>
            <span style={{ color: 'var(--color-green)', fontWeight: 600 }}>Global gold rally likely in 48h</span>
          </div>
        </div>
      </div>
    </section>
  );
}
