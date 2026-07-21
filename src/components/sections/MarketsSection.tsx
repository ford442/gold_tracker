import { LazyPanel } from '@components/LazyPanel';
import { lazyNamed } from '@lib/lazyNamed';

const GlobalArbitrageMonitor = lazyNamed(
  () => import('@components/GlobalArbitrageMonitor'),
  'GlobalArbitrageMonitor',
);
const OrderHistoryPanel = lazyNamed(
  () => import('@components/OrderHistoryPanel'),
  'OrderHistoryPanel',
);
const NewsFeed = lazyNamed(
  () => import('@components/NewsFeed'),
  'NewsFeed',
);

export default function MarketsSection() {
  return (
    <div className="panel-stack">
      <LazyPanel component={GlobalArbitrageMonitor} fallback="table" />

      <div className="section-divider" />

      <LazyPanel component={OrderHistoryPanel} fallback="table" />

      <div className="section-divider" />

      <LazyPanel component={NewsFeed} fallback="card" />
    </div>
  );
}
