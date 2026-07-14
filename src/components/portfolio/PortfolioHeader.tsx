interface Props {
  hasCdpKeys: boolean;
  coinbaseSyncEnabled: boolean;
  cbLoading: boolean;
  cbError: string | null;
  lastSynced: number | null;
  showForm: boolean;
  onSyncClick: () => void;
  onToggleForm: () => void;
}

export function PortfolioHeader({
  hasCdpKeys,
  coinbaseSyncEnabled,
  cbLoading,
  cbError,
  lastSynced,
  showForm,
  onSyncClick,
  onToggleForm,
}: Props) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--space-lg)',
        flexWrap: 'wrap',
        gap: '12px',
      }}
    >
      <h2 className="section-heading">
        <span className="heading-icon">💼</span> Portfolio Tracker
      </h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        {hasCdpKeys && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {cbError && (
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-red)' }} title={cbError}>
                ⚠ Sync failed
              </span>
            )}
            {lastSynced && !cbError && (
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>
                🔄 {new Date(lastSynced).toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={onSyncClick}
              disabled={cbLoading}
              aria-label={coinbaseSyncEnabled ? 'Refresh Coinbase balances' : 'Enable Coinbase sync'}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                background: coinbaseSyncEnabled ? 'var(--color-surface2)' : 'transparent',
                color: 'var(--color-gold)',
                cursor: cbLoading ? 'not-allowed' : 'pointer',
                fontSize: 'var(--font-xs)',
                fontWeight: 600,
                opacity: cbLoading ? 0.6 : 1,
              }}
            >
              {cbLoading ? '⏳ Syncing…' : coinbaseSyncEnabled ? '↺ Coinbase' : '⬇ Sync Coinbase'}
            </button>
          </div>
        )}
        <button
          onClick={onToggleForm}
          aria-label={showForm ? 'Cancel' : 'Add new position'}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: 'var(--color-accent)',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 'var(--font-sm)',
            fontWeight: 600,
          }}
        >
          {showForm ? '✕ Cancel' : '+ Add Position'}
        </button>
      </div>
    </div>
  );
}
