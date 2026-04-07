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
      position: 'relative',
      transition: 'background-color 0.3s ease' 
    }}>
      {/* Cinematic background layers */}
      <div className="app-bg" />
      <div className="app-noise" />

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* Premium header with glass treatment */}
      <header style={{
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(16px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.2)',
        borderBottom: '1px solid var(--color-border)',
        padding: '12px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 1px 12px rgba(0,0,0,0.25), inset 0 -1px 0 rgba(255,255,255,0.03)',
      }} role="banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, rgba(240,200,69,0.20), rgba(240,200,69,0.06))',
            border: '1px solid rgba(240,200,69,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.1rem',
          }}>
            🥇
          </div>
          <div>
            <div style={{ 
              fontWeight: 800, 
              fontSize: '1.1rem', 
              color: 'var(--color-gold)', 
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}>
              GoldTrackr
            </div>
            <div style={{ 
              fontSize: '0.62rem', 
              color: 'var(--color-muted)', 
              letterSpacing: '0.10em', 
              fontWeight: 600,
              textTransform: 'uppercase',
            }}>
              Real-Time Gold & Crypto
            </div>
          </div>
        </div>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '10px' }} aria-label="Main navigation">
          <button
            onClick={() => setIsSettingsOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'rgba(255,255,255,0.03)',
              color: 'var(--color-muted)',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.18s ease',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(240,200,69,0.35)';
              e.currentTarget.style.color = 'var(--color-text)';
              e.currentTarget.style.background = 'rgba(240,200,69,0.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border)';
              e.currentTarget.style.color = 'var(--color-muted)';
              e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
            }}
            aria-label="Open settings"
          >
            <span style={{ fontSize: '0.85rem' }}>⚙️</span> Settings
          </button>
          <DarkModeToggle />
        </nav>
      </header>

      {/* Main content */}
      <main 
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-5 sm:p-6 max-w-[1440px] mx-auto pb-20" 
        role="main"
        style={{ paddingTop: '28px', position: 'relative', zIndex: 2 }}
      >
        {/* Dashboard — hero zone */}
        <div className="col-span-1 lg:col-span-12">
          <Dashboard />
        </div>

        <div className="col-span-1 lg:col-span-12 section-divider" />

        <div className="col-span-1 lg:col-span-12">
          <TradeSuggestionsPanel />
        </div>

        <div className="col-span-1 lg:col-span-12 section-divider" />

        <div className="col-span-1 lg:col-span-12">
          <TradeReplayChart />
        </div>

        <div className="col-span-1 lg:col-span-12 section-divider" />

        <div className="col-span-1 lg:col-span-12">
          <PerformanceComparisonChart />
        </div>

        <div className="col-span-1 lg:col-span-12 section-divider" />

        <div className="col-span-1 lg:col-span-12">
          <GlobalArbitrageMonitor />
        </div>

        <div className="col-span-1 lg:col-span-12 section-divider" />

        <div className="col-span-1 lg:col-span-7">
          <CorrelationMatrix />
        </div>
        <div className="col-span-1 lg:col-span-5">
          <ArbitrageAlerts />
        </div>

        <div className="col-span-1 lg:col-span-12 section-divider" />

        <div className="col-span-1 lg:col-span-12">
          <PortfolioTracker />
        </div>

        <div className="col-span-1 lg:col-span-12 section-divider" />

        <div className="col-span-1 lg:col-span-12">
          <StrategyDashboard />
        </div>

        <div className="col-span-1 lg:col-span-12 section-divider" />

        <div className="col-span-1 lg:col-span-12">
          <NewsFeed />
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--color-border)',
        padding: '28px 24px',
        textAlign: 'center',
        color: 'var(--color-muted)',
        fontSize: '0.75rem',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        position: 'relative',
        zIndex: 2,
      }} role="contentinfo">
        <div style={{ marginBottom: '6px', letterSpacing: '0.02em' }}>
          Data: CoinGecko · MetalPrice API · Kitco RSS · Auto-refresh every 60s
        </div>
        <div style={{ fontSize: '0.68rem', opacity: 0.6 }}>
          Not financial advice · Keyboard shortcuts: D (dark mode), R (refresh), S (settings)
        </div>
      </footer>
    </div>
  );
}

export default App;
