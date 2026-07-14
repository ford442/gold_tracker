import { LazyPanel } from '@components/LazyPanel';
import { lazyNamed } from '@lib/lazyNamed';

const StrategyDashboard = lazyNamed(
  () => import('@components/StrategyDashboard'),
  'StrategyDashboard',
);
const TradeReplayChart = lazyNamed(
  () => import('@components/TradeReplayChart'),
  'TradeReplayChart',
);

export default function StrategiesSection() {
  return (
    <div className="panel-stack">
      <LazyPanel component={StrategyDashboard} fallback="chart" />

      <div className="section-divider" />

      <LazyPanel component={TradeReplayChart} fallback="chart" />
    </div>
  );
}
