import { useState, useEffect, useMemo } from 'react';
import { usePriceStore } from '../store/priceStore';
import { PriceCard } from './PriceCard';
import { GoldSpotCard } from './GoldSpotCard';
import { CardSkeleton } from './LoadingSkeleton';

const ORDERED_IDS = ['pax-gold', 'tether-gold', 'bitcoin', 'ethereum', 'bitcoin-cash'];
const POLL_INTERVAL = 60; // seconds

export function Dashboard() {
  const { prices, goldSpot, isLoading, lastUpdated, isMockData, error } = usePriceStore();
  const [countdown, setCountdown] = useState(POLL_INTERVAL);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => {
      const currentTime = Date.now();
      setNow(currentTime);
      if (lastUpdated) {
        const elapsed = Math.floor((currentTime - lastUpdated) / 1000);
        setCountdown(Math.max(0, POLL_INTERVAL - elapsed));
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  const hasData = goldSpot || ORDERED_IDS.some(id => prices[id]);
  const progressPercent = (countdown / POLL_INTERVAL) * 100;

  // Determine status color and label
  const statusInfo = useMemo(() => {
    if (isMockData || error) {
      return { 
        color: 'var(--color-red)', 
        bg: 'rgba(220,38,38,0.1)',
        label: 'Simulated',
        dotClass: ''
      };
    }
    if (lastUpdated && (now - lastUpdated > 120000)) {
      return { 
        color: 'var(--color-gold)', 
        bg: 'rgba(217,119,6,0.1)',
        label: 'Stale',
        dotClass: ''
      };
    }
    return { 
      color: 'var(--color-green)', 
      bg: 'rgba(5,150,105,0.1)',
      label: 'Live',
      dotClass: 'live-pulse'
    };
  }, [isMockData, error, lastUpdated, now]);

  return (
    <section aria-label="Live Prices Dashboard" style={{ marginBottom: 'var(--space-xl)' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 'var(--space-lg)',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <h2 className="section-heading">
          <span className="heading-icon">📊</span>
          Live Prices
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Status pill */}
          {!isLoading && hasData && (
            <span style={{
              fontSize: 'var(--font-xs)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '999px',
              background: statusInfo.bg,
              color: statusInfo.color,
              fontWeight: 600,
              border: `1px solid ${statusInfo.color}20`,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}>
              <span 
                className={statusInfo.dotClass}
                style={{
                  display: 'inline-block', 
                  width: '6px', 
                  height: '6px', 
                  borderRadius: '50%',
                  background: 'currentColor',
                  boxShadow: statusInfo.dotClass ? `0 0 6px ${statusInfo.color}` : 'none',
                }} 
                aria-hidden="true" 
              />
              {statusInfo.label}
            </span>
          )}
          
          {/* Timestamp */}
          {lastUpdated && !isLoading && (
            <span style={{ 
              fontSize: 'var(--font-xs)', 
              color: 'var(--color-muted)',
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 500,
              opacity: 0.8,
            }}>
              {new Date(lastUpdated).toLocaleTimeString()}
            </span>
          )}
          
          {/* Countdown */}
          {lastUpdated && !isLoading && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center',
              gap: '8px',
            }}>
              <div className="progress-bar" style={{ width: '48px' }}>
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span style={{ 
                fontSize: '0.65rem', 
                color: 'var(--color-muted)', 
                fontVariantNumeric: 'tabular-nums',
                fontWeight: 500,
                opacity: 0.7,
              }}>
                {countdown}s
              </span>
            </div>
          )}
          
          {isLoading && (
            <span style={{ 
              fontSize: 'var(--font-xs)', 
              color: 'var(--color-muted)', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              fontWeight: 500
            }}>
              <span 
                style={{ 
                  display: 'inline-block', 
                  width: '6px', 
                  height: '6px', 
                  borderRadius: '50%', 
                  background: 'var(--color-gold)',
                  animation: 'pulse 1s infinite' 
                }} 
                aria-hidden="true" 
              />
              Updating...
            </span>
          )}
        </div>
      </div>

      {/* Price cards grid with reflection zone */}
      <div className="reflection-zone" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
        gap: 'var(--space-md)',
      }}>
        {/* Loading skeletons */}
        {!hasData && isLoading && (
          <>
            {Array.from({ length: 5 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </>
        )}

        {goldSpot && <GoldSpotCard data={goldSpot} />}
        {ORDERED_IDS.map((id) =>
          prices[id] ? (
            <PriceCard key={id} data={prices[id]} goldPrice={goldSpot?.price} />
          ) : null
        )}
        {!hasData && !isLoading && (
          <div className="glass-card" style={{
            gridColumn: '1/-1', 
            textAlign: 'center', 
            padding: 'var(--space-2xl)',
            color: 'var(--color-muted)', 
            fontSize: 'var(--font-base)',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px', opacity: 0.7 }}>⚠️</div>
            <div style={{ fontWeight: 500 }}>No price data available</div>
            <div style={{ fontSize: 'var(--font-sm)', marginTop: '8px', opacity: 0.7 }}>
              Check your API keys or wait for the next refresh
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
