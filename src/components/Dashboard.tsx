import { usePriceStore } from '../store/priceStore';
import { PriceCard } from './PriceCard';
import { GoldSpotCard } from './GoldSpotCard';
import { CardSkeleton } from './LoadingSkeleton';

const ORDERED_IDS = ['pax-gold', 'tether-gold', 'bitcoin', 'ethereum', 'bitcoin-cash'];

export function Dashboard() {
  const { prices, goldSpot, isLoading, lastUpdated } = usePriceStore();

  const hasData = goldSpot || ORDERED_IDS.some(id => prices[id]);

  return (
    <section aria-label="Live Prices Dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--font-lg)', color: 'var(--color-text)' }}>
          📊 Live Prices
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isLoading && (
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-gold)', animation: 'pulse 1s infinite' }} aria-hidden="true" />
              Updating...
            </span>
          )}
          {lastUpdated && !isLoading && (
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>
              Updated {new Date(lastUpdated).toLocaleTimeString()}
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
