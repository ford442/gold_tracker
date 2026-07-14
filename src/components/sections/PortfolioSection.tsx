import { LazyPanel } from '@components/LazyPanel';
import { lazyNamed } from '@lib/lazyNamed';

const PortfolioTracker = lazyNamed(
  () => import('@components/PortfolioTracker'),
  'PortfolioTracker',
);

export default function PortfolioSection() {
  return (
    <div className="panel-stack">
      <LazyPanel component={PortfolioTracker} fallback="table" />
    </div>
  );
}
