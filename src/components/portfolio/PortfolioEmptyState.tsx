interface Props {
  hasCdpKeys: boolean;
  onAddPosition: () => void;
  onEnableCoinbaseSync: () => void;
  onAddDemo: () => void;
}

export function PortfolioEmptyState({
  hasCdpKeys,
  onAddPosition,
  onEnableCoinbaseSync,
  onAddDemo,
}: Props) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '2px dashed var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '48px 32px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '3rem', marginBottom: '16px' }}>💼</div>
      <h3
        style={{
          margin: '0 0 8px 0',
          fontSize: 'var(--font-lg)',
          fontWeight: 700,
          color: 'var(--color-text)',
        }}
      >
        No positions yet
      </h3>
      <p
        style={{
          fontSize: 'var(--font-sm)',
          color: 'var(--color-muted)',
          marginBottom: '20px',
          maxWidth: '400px',
          marginLeft: 'auto',
          marginRight: 'auto',
          lineHeight: 1.5,
        }}
      >
        Track your gold and crypto holdings to monitor performance, calculate unrealized P&L, and
        analyze your portfolio allocation.
      </p>

      <div
        style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
          flexWrap: 'wrap',
          marginBottom: '24px',
        }}
      >
        <button
          onClick={onAddPosition}
          style={{
            padding: '10px 20px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: 'var(--color-accent)',
            color: '#fff',
            fontSize: 'var(--font-sm)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ➕ Add Your First Position
        </button>
        {hasCdpKeys && (
          <button
            onClick={onEnableCoinbaseSync}
            style={{
              padding: '10px 20px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-gold)',
              background: 'transparent',
              color: 'var(--color-gold)',
              fontSize: 'var(--font-sm)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ⬇ Import from Coinbase
          </button>
        )}
      </div>

      <div
        style={{
          padding: '16px',
          background: 'var(--color-surface2)',
          borderRadius: 'var(--radius-md)',
          maxWidth: '350px',
          margin: '0 auto',
        }}
      >
        <p
          style={{
            fontSize: 'var(--font-xs)',
            color: 'var(--color-muted)',
            margin: '0 0 10px 0',
          }}
        >
          👋 New here? Try a demo position to see how it works:
        </p>
        <button
          onClick={onAddDemo}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            background: 'transparent',
            color: 'var(--color-muted)',
            fontSize: 'var(--font-xs)',
            cursor: 'pointer',
          }}
        >
          🎯 Add Demo Position (5 PAXG @ $3,200)
        </button>
      </div>
    </div>
  );
}
