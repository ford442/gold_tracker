import { ChartSkeleton } from './LoadingSkeleton';

export function SectionFallback() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading section"
      className="grid grid-cols-1 gap-6"
    >
      <ChartSkeleton />
      <ChartSkeleton />
    </div>
  );
}
