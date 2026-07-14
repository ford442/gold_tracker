import { useState, Suspense } from 'react';
import { lazyNamed } from '@lib/lazyNamed';
import { ChartSkeleton, TableSkeleton } from './LoadingSkeleton';
import { TABS, type ComparisonTab } from './goldComparison/constants';

const OverlayTab = lazyNamed(
  () => import('./goldComparison/OverlayTab'),
  'OverlayTab',
);
const PremiumsTab = lazyNamed(
  () => import('./goldComparison/PremiumsTab'),
  'PremiumsTab',
);
const CurrenciesTab = lazyNamed(
  () => import('./goldComparison/CurrenciesTab'),
  'CurrenciesTab',
);
const PortfolioTab = lazyNamed(
  () => import('./goldComparison/PortfolioTab'),
  'PortfolioTab',
);
const RegimeLens = lazyNamed(
  () => import('./RegimeLens'),
  'RegimeLens',
);

const CHART_TABS = new Set<ComparisonTab>(['overlay', 'regimes']);

export function GoldComparisonTools() {
  const [activeTab, setActiveTab] = useState<ComparisonTab>('overlay');

  const tabFallback = CHART_TABS.has(activeTab) ? <ChartSkeleton /> : <TableSkeleton />;

  return (
    <section aria-label="Advanced Gold Comparison Tools">
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '8px',
      }}>
        <h2 className="section-heading" style={{ margin: 0 }}>
          <span className="heading-icon">⚖️</span>
          Advanced Gold Comparison Tools
        </h2>
        <span className="badge badge-gold">Multi-Instrument · Multi-Currency</span>
      </div>

      <div
        className="comparison-tablist"
        style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '16px',
          background: 'var(--color-surface2)',
          borderRadius: 'var(--radius-lg)',
          padding: '4px',
          flexWrap: 'wrap',
        }}
        role="tablist"
        aria-label="Comparison tool tabs"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className={`comparison-tab${activeTab === tab.id ? ' active' : ''}`}
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: '1 1 auto',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: activeTab === tab.id
                ? 'linear-gradient(135deg, rgba(240,200,69,0.18), rgba(240,200,69,0.06))'
                : 'transparent',
              borderBottom: activeTab === tab.id
                ? '2px solid var(--color-gold)'
                : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--color-gold)' : 'var(--color-muted)',
              fontSize: 'var(--font-sm)',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.18s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <Suspense fallback={tabFallback}>
        {activeTab === 'overlay' && <OverlayTab />}
        {activeTab === 'premiums' && <PremiumsTab />}
        {activeTab === 'currencies' && <CurrenciesTab />}
        {activeTab === 'portfolio' && <PortfolioTab />}
        {activeTab === 'regimes' && <RegimeLens />}
      </Suspense>
    </section>
  );
}
