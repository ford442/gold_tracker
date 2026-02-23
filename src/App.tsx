import { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { CorrelationMatrix } from './components/CorrelationMatrix';
import { ArbitrageAlerts } from './components/ArbitrageAlerts';
import { PortfolioTracker } from './components/PortfolioTracker';
import { NewsFeed } from './components/NewsFeed';
import { DarkModeToggle } from './components/DarkModeToggle';
import { SettingsModal } from './components/SettingsModal';
import { TradeSuggestionsPanel } from './components/TradeSuggestionsPanel';
import { useGoldPrices } from './hooks/useGoldPrices';
import { useThemeStore } from './store/themeStore';

function App() {
  const { mode } = useThemeStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', transition: 'background-color 0.2s' }}>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

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
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
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
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            style={{ color: 'var(--color-muted)' }}
          >
            <span>⚙️</span> Settings
          </button>
          <DarkModeToggle />
        </div>
      </header>

      {/* Main content */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 max-w-[1400px] mx-auto pb-20">
        {/* Dashboard - full width */}
        <div className="col-span-1 lg:col-span-12">
          <Dashboard />
        </div>

        {/* Trade Suggestions - full width (Priority) */}
        <div className="col-span-1 lg:col-span-12">
          <TradeSuggestionsPanel />
        </div>

        {/* Correlation + Alerts */}
        <div className="col-span-1 lg:col-span-7">
          <CorrelationMatrix />
        </div>
        <div className="col-span-1 lg:col-span-5">
          <ArbitrageAlerts />
        </div>

        {/* Portfolio - full width */}
        <div className="col-span-1 lg:col-span-12">
          <PortfolioTracker />
        </div>

        {/* News feed */}
        <div className="col-span-1 lg:col-span-12">
          <NewsFeed />
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--color-border)',
        padding: '24px 20px',
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
