import { LazyPanel } from '@components/LazyPanel';
import { lazyNamed } from '@lib/lazyNamed';

const PortfolioTracker = lazyNamed(
  () => import('@components/PortfolioTracker'),
  'PortfolioTracker',
);
const PaperLedgerPanel = lazyNamed(
  () => import('@components/PaperLedgerPanel'),
  'PaperLedgerPanel',
);
const OrderHistoryPanel = lazyNamed(
  () => import('@components/OrderHistoryPanel'),
  'OrderHistoryPanel',
);

export default function PortfolioSection() {
  return (
    <div className="panel-stack">
      <LazyPanel component={PortfolioTracker} fallback="table" />

      <div className="section-divider" />

      <LazyPanel component={OrderHistoryPanel} fallback="table" />

      <div className="section-divider" />

      <LazyPanel component={PaperLedgerPanel} fallback="table" />
    </div>
  );
}
