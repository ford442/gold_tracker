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
  const { mode, toggle: toggleTheme } = useThemeStore();
  const initAuth = useAuthStore((s) => s.init);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    const root = document.documentElement;
    if (mode === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
  }, [mode]);

  const { refetch } = useGoldPrices();

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key.toLowerCase()) {
        case 'd':
          toggleTheme();
          break;
        case 'r':
          refetch();
          break;
        case 's':
          setIsSettingsOpen((prev) => !prev);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleTheme, refetch]);

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'var(--color-bg)', 
      transition: 'background-color 0.2s ease' 
    }}>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* Header with gold gradient accent */}
      <header style={{
        background: 'var(--color-surface)',
        backgroundImage: 'var(--gradient-gold)',
        borderBottom: '1px solid var(--color-border)',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: 'var(--shadow-md)',
      }} role="banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.6rem' }} role="img" aria-label="Gold medal">🥇</span>
          <div>
            <div style={{ 
              fontWeight: 800, 
              fontSize: '1.15rem', 
              color: 'var(--color-gold)', 
              letterSpacing: '-0.02em' 
            }}>
              GoldTrackr
            </div>
            <div style={{ 
              fontSize: '0.7rem', 
              color: 'var(--color-muted)', 
              letterSpacing: '0.08em', 
              marginTop: '-2px',
              fontWeight: 600
            }}>
              REAL-TIME GOLD & CRYPTO
            </div>
          </div>
        </div>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '16px' }} aria-label="Main navigation">
          <button
            onClick={() => setIsSettingsOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-muted)',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-gold)';
              e.currentTarget.style.color = 'var(--color-text)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border)';
              e.currentTarget.style.color = 'var(--color-muted)';
            }}
            aria-label="Open settings"
          >
            <span>⚙️</span> Settings
          </button>
          <DarkModeToggle />
        </nav>
      </header>

      {/* Main content with improved spacing */}
      <main 
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 max-w-[1400px] mx-auto pb-20" 
        role="main"
        style={{ paddingTop: '32px' }}
      >
        {/* Dashboard - full width */}
        <div className="col-span-1 lg:col-span-12">
          <Dashboard />
        </div>

        {/* Section divider */}
        <div className="col-span-1 lg:col-span-12 section-divider" />

        {/* Trade Suggestions - full width (Priority) */}
        <div className="col-span-1 lg:col-span-12">
          <TradeSuggestionsPanel />
        </div>

        {/* Section divider */}
        <div className="col-span-1 lg:col-span-12 section-divider" />

        {/* Trade Replay & Projections - full width */}
        <div className="col-span-1 lg:col-span-12">
          <TradeReplayChart />
        </div>

        {/* Section divider */}
        <div className="col-span-1 lg:col-span-12 section-divider" />

        {/* Performance Comparison Chart - full width */}
        <div className="col-span-1 lg:col-span-12">
          <PerformanceComparisonChart />
        </div>

        {/* Section divider */}
        <div className="col-span-1 lg:col-span-12 section-divider" />

        {/* Global Arbitrage Monitor - full width */}
        <div className="col-span-1 lg:col-span-12">
          <GlobalArbitrageMonitor />
        </div>

        {/* Section divider */}
        <div className="col-span-1 lg:col-span-12 section-divider" />

        {/* Correlation + Alerts */}
        <div className="col-span-1 lg:col-span-7">
          <CorrelationMatrix />
        </div>
        <div className="col-span-1 lg:col-span-5">
          <ArbitrageAlerts />
        </div>

        {/* Section divider */}
        <div className="col-span-1 lg:col-span-12 section-divider" />

        {/* Portfolio - full width */}
        <div className="col-span-1 lg:col-span-12">
          <PortfolioTracker />
        </div>

        {/* Section divider */}
        <div className="col-span-1 lg:col-span-12 section-divider" />

        {/* Strategy Engine & Back-tester */}
        <div className="col-span-1 lg:col-span-12">
          <StrategyDashboard />
        </div>

        {/* Section divider */}
        <div className="col-span-1 lg:col-span-12 section-divider" />

        {/* News feed */}
        <div className="col-span-1 lg:col-span-12">
          <NewsFeed />
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--color-border)',
        padding: '32px 24px',
        textAlign: 'center',
        color: 'var(--color-muted)',
        fontSize: '0.8rem',
        background: 'var(--color-surface)'
      }} role="contentinfo">
        <div style={{ marginBottom: '8px' }}>
          Data: CoinGecko · MetalPrice API · Kitco RSS · Prices auto-refresh every 60s
        </div>
        <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
          Not financial advice · Keyboard shortcuts: D (dark mode), R (refresh), S (settings)
        </div>
      </footer>
    </div>
  );
}

export default App;
