import { useState, useEffect } from 'react';
import { usePriceStore } from '../store/priceStore';
import { PriceCard } from './PriceCard';
import { GoldSpotCard } from './GoldSpotCard';
import { CardSkeleton } from './LoadingSkeleton';

const ORDERED_IDS = ['pax-gold', 'tether-gold', 'bitcoin', 'ethereum', 'bitcoin-cash'];
const POLL_INTERVAL = 60; // seconds

export function Dashboard() {
  const { prices, goldSpot, isLoading, lastUpdated, isMockData, error } = usePriceStore();
  const [countdown, setCountdown] = useState(POLL_INTERVAL);

  useEffect(() => {
    const tick = setInterval(() => {
      if (lastUpdated) {
        const elapsed = Math.floor((Date.now() - lastUpdated) / 1000);
        setCountdown(Math.max(0, POLL_INTERVAL - elapsed));
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  const hasData = goldSpot || ORDERED_IDS.some(id => prices[id]);

  return (
    <section aria-label="Live Prices Dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--font-lg)', color: 'var(--color-text)' }}>
          📊 Live Prices
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Data source indicator */}
          {!isLoading && hasData && (
            <span style={{
              fontSize: 'var(--font-xs)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '999px',
              background: isMockData || error
                ? 'rgba(239,68,68,0.1)'
                : lastUpdated && (Date.now() - lastUpdated > 120000)
                ? 'rgba(234,179,8,0.1)'
                : 'rgba(34,197,94,0.1)',
              color: isMockData || error
                ? 'var(--color-red)'
                : lastUpdated && (Date.now() - lastUpdated > 120000)
                ? 'var(--color-gold)'
                : 'var(--color-green)',
            }}>
              <span style={{
                display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%',
                background: 'currentColor',
              }} aria-hidden="true" />
              {isMockData || error ? 'Simulated' : lastUpdated && (Date.now() - lastUpdated > 120000) ? 'Stale' : 'Live'}
            </span>
          )}
          {isLoading && (
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-gold)', animation: 'pulse 1s infinite' }} aria-hidden="true" />
              Updating...
            </span>
          )}
          {lastUpdated && !isLoading && (
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', fontVariantNumeric: 'tabular-nums' }}>
              Next refresh: {countdown}s
            </span>
          )}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
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
          <div style={{
            gridColumn: '1/-1', textAlign: 'center', padding: 'var(--space-xl)',
            color: 'var(--color-muted)', fontSize: 'var(--font-base)',
            background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⚠️</div>
            No price data available. Check your API keys or wait for the next refresh.
          </div>
        )}
      </div>
    </section>
  );
}
