import { usePriceStore } from '../store/priceStore';
import { PriceCard } from './PriceCard';
import { GoldSpotCard } from './GoldSpotCard';

const ORDERED_IDS = ['pax-gold', 'tether-gold', 'bitcoin', 'ethereum'];

export function Dashboard() {
  const { prices, goldSpot, isLoading, lastUpdated } = usePriceStore();

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-text)' }}>
          📊 Live Prices
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isLoading && (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-gold)', animation: 'pulse 1s infinite' }} />
              Updating...
            </span>
          )}
          {lastUpdated && !isLoading && (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-muted)' }}>
              Updated {new Date(lastUpdated).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '14px',
      }}>
        {goldSpot && <GoldSpotCard data={goldSpot} />}
        {ORDERED_IDS.map((id) =>
          prices[id] ? (
            <PriceCard key={id} data={prices[id]} goldPrice={goldSpot?.price} />
          ) : null
        )}
        {!goldSpot && ORDERED_IDS.every(id => !prices[id]) && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--color-muted)', fontSize: '0.9rem' }}>
            {isLoading ? '⏳ Loading prices...' : '⚠️ No price data available. Check your API keys.'}
          </div>
        )}
      </div>
    </section>
  );
}
