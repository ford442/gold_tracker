import { useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { CorrelationMatrix } from './components/CorrelationMatrix';
import { ArbitrageAlerts } from './components/ArbitrageAlerts';
import { PortfolioTracker } from './components/PortfolioTracker';
import { NewsFeed } from './components/NewsFeed';
import { DarkModeToggle } from './components/DarkModeToggle';
import { useGoldPrices } from './hooks/useGoldPrices';
import { useThemeStore } from './store/themeStore';

function App() {
  const { mode } = useThemeStore();

  // Apply theme class on mount
  useEffect(() => {
    const root = document.documentElement;
    if (mode === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
  }, [mode]);

  // Start polling prices
  useGoldPrices();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Header */}
      <header style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.4rem' }}>🥇</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--color-gold)', letterSpacing: '-0.02em' }}>
              GoldTrackr
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--color-muted)', letterSpacing: '0.05em', marginTop: '-2px' }}>
              REAL-TIME GOLD & CRYPTO
            </div>
          </div>
        </div>
        <DarkModeToggle />
      </header>

      {/* Main content */}
      <main style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '20px 16px 40px',
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        gap: '20px',
      }}>
        {/* Dashboard - full width */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Dashboard />
        </div>

        {/* Correlation + Alerts */}
        <div style={{ gridColumn: 'span 7' }}>
          <CorrelationMatrix />
        </div>
        <div style={{ gridColumn: 'span 5' }}>
          <ArbitrageAlerts />
        </div>

        {/* Portfolio - full width */}
        <div style={{ gridColumn: '1 / -1' }}>
          <PortfolioTracker />
        </div>

        {/* News feed */}
        <div style={{ gridColumn: '1 / -1' }}>
          <NewsFeed />
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--color-border)',
        padding: '16px 20px',
        textAlign: 'center',
        color: 'var(--color-muted)',
        fontSize: '0.75rem',
      }}>
        Data: CoinGecko · MetalPrice API · Kitco RSS · Prices auto-refresh every 60s · Not financial advice
      </footer>
    </div>
  );
}

export default App;
