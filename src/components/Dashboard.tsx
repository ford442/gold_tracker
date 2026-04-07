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
    <section aria-label="Live Prices Dashboard" style={{ marginBottom: 'var(--space-2xl)' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 'var(--space-lg)',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <h2 style={{ 
          margin: 0, 
          fontSize: 'var(--font-xl)', 
          fontWeight: 700, 
          color: 'var(--color-text)',
          letterSpacing: '-0.02em'
        }}>
          📊 Live Prices
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Enhanced Live indicator */}
          {!isLoading && hasData && (
            <span style={{
              fontSize: 'var(--font-xs)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '999px',
              background: statusInfo.bg,
              color: statusInfo.color,
              fontWeight: 600,
            }}>
              <span 
                className={statusInfo.dotClass}
                style={{
                  display: 'inline-block', 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%',
                  background: 'currentColor',
                }} 
                aria-hidden="true" 
              />
              {statusInfo.label}
            </span>
          )}
          
          {/* Last updated timestamp */}
          {lastUpdated && !isLoading && (
            <span style={{ 
              fontSize: 'var(--font-xs)', 
              color: 'var(--color-muted)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: '2px'
            }}>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                Updated: {new Date(lastUpdated).toLocaleTimeString()}
              </span>
            </span>
          )}
          
          {/* Countdown with progress bar */}
          {lastUpdated && !isLoading && (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'flex-end',
              gap: '4px',
              minWidth: '80px'
            }}>
              <span style={{ 
                fontSize: 'var(--font-xs)', 
                color: 'var(--color-muted)', 
                fontVariantNumeric: 'tabular-nums',
                fontWeight: 500
              }}>
                {countdown}s
              </span>
              <div className="progress-bar" style={{ width: '60px' }}>
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
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
                  width: '8px', 
                  height: '8px', 
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

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 'var(--space-lg)',
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
          <div style={{
            gridColumn: '1/-1', 
            textAlign: 'center', 
            padding: 'var(--space-2xl)',
            color: 'var(--color-muted)', 
            fontSize: 'var(--font-base)',
            background: 'var(--color-surface)', 
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚠️</div>
            <div style={{ fontWeight: 500 }}>No price data available</div>
            <div style={{ fontSize: 'var(--font-sm)', marginTop: '8px' }}>
              Check your API keys or wait for the next refresh
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
