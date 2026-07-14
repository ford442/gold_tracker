import { Dashboard } from '@components/Dashboard';
import { LazyPanel } from '@components/LazyPanel';
import { lazyNamed } from '@lib/lazyNamed';

const PreciousMetalsPanel = lazyNamed(
  () => import('@components/PreciousMetalsPanel'),
  'PreciousMetalsPanel',
);
const TradeSuggestionsPanel = lazyNamed(
  () => import('@components/TradeSuggestionsPanel'),
  'TradeSuggestionsPanel',
);
const ArbitrageAlerts = lazyNamed(
  () => import('@components/ArbitrageAlerts'),
  'ArbitrageAlerts',
);

export default function OverviewSection() {
  return (
    <div className="panel-stack">
      <div>
        <Dashboard />
      </div>

      <div className="section-divider" />

      <div>
        <LazyPanel component={PreciousMetalsPanel} fallback="chart" />
      </div>

      <div className="section-divider" />

      <div>
        <LazyPanel component={TradeSuggestionsPanel} fallback="table" />
      </div>

      <div className="section-divider" />

      <div>
        <LazyPanel component={ArbitrageAlerts} fallback="chart" />
      </div>
    </div>
  );
}
