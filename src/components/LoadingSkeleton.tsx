interface SkeletonProps {
  width?: string;
  height?: string;
  borderRadius?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ width = '100%', height = '16px', borderRadius, style }: SkeletonProps) {
  return (
    <div
      className="skeleton"
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius: borderRadius ?? 'var(--radius-sm)',
        ...style,
      }}
    />
  );
}

export function ChartSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading chart" className="glass-card" style={{
      padding: 'var(--space-lg)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <Skeleton width="200px" height="20px" />
        <Skeleton width="80px" height="20px" borderRadius="var(--radius-full)" />
      </div>
      <Skeleton width="100%" height="240px" borderRadius="var(--radius-md)" />
      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} width="25%" height="48px" />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading table" className="glass-card" style={{
      padding: '12px',
    }}>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', padding: '8px' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} width={i === 0 ? '120px' : '80px'} height="14px" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: '12px', padding: '10px 8px' }}>
          {Array.from({ length: 5 }).map((_, j) => (
            <Skeleton key={j} width={j === 0 ? '120px' : '80px'} height="16px" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading card" className="glass-card" style={{
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      <Skeleton width="60px" height="12px" />
      <Skeleton width="120px" height="28px" />
      <div style={{ display: 'flex', gap: '12px' }}>
        <Skeleton width="70px" height="14px" />
        <Skeleton width="70px" height="14px" />
      </div>
      <Skeleton width="100%" height="50px" />
    </div>
  );
}
