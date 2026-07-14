import { lazy, Suspense, useCallback, useEffect, useState, type LazyExoticComponent, type JSX } from 'react';
import { DarkModeToggle } from '@components/DarkModeToggle';
import { AppNav } from '@components/AppNav';
import { OfflineBanner } from '@components/OfflineBanner';
import { SectionFallback } from '@components/SectionFallback';
import { ModalSkeleton } from '@components/LoadingSkeleton';
import { useGoldPrices } from '@/hooks/useGoldPrices';
import { useAppSection } from '@/hooks/useAppSection';
import { useThemeStore } from '@/store/themeStore';
import {
  APP_SECTIONS,
  adjacentSection,
  type AppSection,
} from '@lib/appSections';
import { lazyNamed } from '@lib/lazyNamed';

const SettingsModal = lazyNamed(
  () => import('@components/SettingsModal'),
  'SettingsModal',
);

const OverviewSection = lazy(() => import('@components/sections/OverviewSection'));
const AnalyticsSection = lazy(() => import('@components/sections/AnalyticsSection'));
const PortfolioSection = lazy(() => import('@components/sections/PortfolioSection'));
const StrategiesSection = lazy(() => import('@components/sections/StrategiesSection'));
const MarketsSection = lazy(() => import('@components/sections/MarketsSection'));

const SECTION_VIEWS: Record<AppSection, LazyExoticComponent<() => JSX.Element>> = {
  overview: OverviewSection,
  analytics: AnalyticsSection,
  portfolio: PortfolioSection,
  strategies: StrategiesSection,
  markets: MarketsSection,
};

function ActiveSection({ section }: { section: AppSection }) {
  const View = SECTION_VIEWS[section];
  return <View />;
}

function App() {
  const { mode, toggle: toggleTheme } = useThemeStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsMounted, setSettingsMounted] = useState(false);
  const { section, setSection } = useAppSection();

  const openSettings = useCallback(() => {
    setSettingsMounted(true);
    setIsSettingsOpen(true);
  }, []);

  const toggleSettings = useCallback(() => {
    setSettingsMounted(true);
    setIsSettingsOpen((prev) => !prev);
  }, []);

  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);

  useEffect(() => {
    const root = document.documentElement;
    if (mode === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
  }, [mode]);

  const { refetch } = useGoldPrices();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const key = e.key.toLowerCase();

      if (key === 'd') {
        toggleTheme();
        return;
      }
      if (key === 'r') {
        refetch();
        return;
      }
      if (key === 's') {
        toggleSettings();
        return;
      }

      const sectionShortcut = APP_SECTIONS.find((s) => s.shortcut === key);
      if (sectionShortcut) {
        setSection(sectionShortcut.id);
        return;
      }

      if (e.key === 'ArrowLeft') {
        setSection(adjacentSection(section, -1));
        return;
      }
      if (e.key === 'ArrowRight') {
        setSection(adjacentSection(section, 1));
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleTheme, refetch, section, setSection, toggleSettings]);

  return (
    <div style={{
      minHeight: '100vh',
      position: 'relative',
      transition: 'background-color 0.3s ease',
    }}>
      <div className="app-bg" />
      <div className="app-noise" />

      {settingsMounted && (
        <Suspense fallback={isSettingsOpen ? <ModalSkeleton /> : null}>
          <SettingsModal isOpen={isSettingsOpen} onClose={closeSettings} />
        </Suspense>
      )}

      <header className="app-header" role="banner">
        <div className="app-header-brand">
          <div className="app-header-logo">🥇</div>
          <div>
            <div className="app-header-title">GoldTrackr</div>
            <div className="app-header-subtitle">Real-Time Gold & Crypto</div>
          </div>
        </div>

        <AppNav section={section} onSelect={setSection} />

        <nav className="app-header-actions" aria-label="App actions">
          <button
            type="button"
            className="app-header-settings-btn"
            onClick={openSettings}
            aria-label="Open settings"
          >
            <span aria-hidden="true">⚙️</span>
            <span className="app-header-settings-label">Settings</span>
          </button>
          <DarkModeToggle />
        </nav>
      </header>

      <OfflineBanner />

      <main
        className="grid grid-cols-1 gap-6 p-5 sm:p-6 max-w-[1440px] mx-auto app-main-padded"
        role="main"
        style={{ paddingTop: '28px', position: 'relative', zIndex: 2 }}
        id={section}
        aria-label={`${APP_SECTIONS.find((s) => s.id === section)?.label ?? 'App'} section`}
      >
        <Suspense fallback={<SectionFallback />}>
          <ActiveSection section={section} />
        </Suspense>
      </main>

      <footer className="app-footer" role="contentinfo">
        <div style={{ marginBottom: '6px', letterSpacing: '0.02em' }}>
          Data: CoinGecko · MetalPrice API · News (mock) · Auto-refresh every 60s
        </div>
        <div style={{ fontSize: '0.68rem', opacity: 0.6 }}>
          Not financial advice · Keys: 1–5 sections · ← → navigate · D theme · R refresh · S settings
        </div>
      </footer>
    </div>
  );
}

export default App;
