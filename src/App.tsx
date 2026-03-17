import { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { CorrelationMatrix } from './components/CorrelationMatrix';
import { ArbitrageAlerts } from './components/ArbitrageAlerts';
import { PortfolioTracker } from './components/PortfolioTracker';
import { NewsFeed } from './components/NewsFeed';
import { DarkModeToggle } from './components/DarkModeToggle';
import { SettingsModal } from './components/SettingsModal';
import { TradeSuggestionsPanel } from './components/TradeSuggestionsPanel';
import { PerformanceComparisonChart } from './components/PerformanceComparisonChart';
import { GlobalArbitrageMonitor } from './components/GlobalArbitrageMonitor';
import { TradeReplayChart } from './components/TradeReplayChart';
import { StrategyDashboard } from './components/StrategyDashboard';
import { useGoldPrices } from './hooks/useGoldPrices';
import { useThemeStore } from './store/themeStore';
import { useAuthStore } from './store/useAuthStore';

function App() {
  const { mode } = useThemeStore();
  const initAuth = useAuthStore((s) => s.init);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Initialize auth on mount
  useEffect(() => {
    initAuth();
  }, [initAuth]);

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

      {/* Header with gold gradient accent */}
      <header style={{
        background: 'var(--color-surface)',
        backgroundImage: 'var(--gradient-gold)',
        borderBottom: '1px solid var(--color-border)',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: 'var(--shadow-md)',
      }} role="banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '1.4rem' }} role="img" aria-label="Gold medal">🥇</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--color-gold)', letterSpacing: '-0.02em' }}>
              GoldTrackr
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--color-muted)', letterSpacing: '0.05em', marginTop: '-2px' }}>
              REAL-TIME GOLD &amp; CRYPTO
            </div>
          </div>
        </div>
        <nav className="flex items-center gap-4" aria-label="Main navigation">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            style={{
              color: 'var(--color-muted)',
              minHeight: '44px',
              minWidth: '44px',
            }}
            aria-label="Open settings"
          >
            <span>⚙️</span> Settings
          </button>
          <DarkModeToggle />
        </nav>
      </header>

      {/* Main content */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 max-w-[1400px] mx-auto pb-20" role="main">
        {/* Dashboard - full width */}
        <div className="col-span-1 lg:col-span-12">
          <Dashboard />
        </div>

        {/* Trade Suggestions - full width (Priority) */}
        <div className="col-span-1 lg:col-span-12">
          <TradeSuggestionsPanel />
        </div>

        {/* Trade Replay & Projections - full width (NEW) */}
        <div className="col-span-1 lg:col-span-12">
          <TradeReplayChart />
        </div>

        {/* Performance Comparison Chart - full width */}
        <div className="col-span-1 lg:col-span-12">
          <PerformanceComparisonChart />
        </div>

        {/* Global Arbitrage Monitor - full width */}
        <div className="col-span-1 lg:col-span-12">
          <GlobalArbitrageMonitor />
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

        {/* Strategy Engine & Back-tester */}
        <div className="col-span-1 lg:col-span-12">
          <StrategyDashboard />
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
      }} role="contentinfo">
        Data: CoinGecko · MetalPrice API · Kitco RSS · Prices auto-refresh every 60s · Not financial advice
      </footer>
    </div>
  );
}

export default App;
