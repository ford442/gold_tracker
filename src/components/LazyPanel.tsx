import { Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { CardSkeleton, ChartSkeleton, TableSkeleton } from './LoadingSkeleton';

export type LazyPanelFallback = 'chart' | 'table' | 'card';

const FALLBACKS: Record<LazyPanelFallback, ComponentType> = {
  chart: ChartSkeleton,
  table: TableSkeleton,
  card: CardSkeleton,
};

interface Props<P extends object> {
  component: LazyExoticComponent<ComponentType<P>>;
  fallback?: LazyPanelFallback;
  props?: P;
}

export function LazyPanel<P extends object>({
  component: Component,
  fallback = 'chart',
  props,
}: Props<P>) {
  const Fallback = FALLBACKS[fallback];
  return (
    <Suspense fallback={<Fallback />}>
      <Component {...(props ?? ({} as P))} />
    </Suspense>
  );
}
