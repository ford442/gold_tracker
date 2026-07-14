import { LazyPanel } from '@components/LazyPanel';
import { lazyNamed } from '@lib/lazyNamed';

const CorrelationMatrix = lazyNamed(
  () => import('@components/CorrelationMatrix'),
  'CorrelationMatrix',
);
const GoldComparisonTools = lazyNamed(
  () => import('@components/GoldComparisonTools'),
  'GoldComparisonTools',
);
const FiscalYearChart = lazyNamed(
  () => import('@components/FiscalYearChart'),
  'FiscalYearChart',
);
const PerformanceComparisonChart = lazyNamed(
  () => import('@components/PerformanceComparisonChart'),
  'PerformanceComparisonChart',
);

export default function AnalyticsSection() {
  return (
    <div className="panel-stack">
      <div>
        <LazyPanel component={CorrelationMatrix} fallback="chart" />
      </div>

      <div className="section-divider" />

      <div>
        <LazyPanel component={GoldComparisonTools} fallback="chart" />
      </div>

      <div className="section-divider" />

      <div>
        <LazyPanel component={FiscalYearChart} fallback="chart" />
      </div>

      <div className="section-divider" />

      <div>
        <LazyPanel component={PerformanceComparisonChart} fallback="chart" />
      </div>
    </div>
  );
}
