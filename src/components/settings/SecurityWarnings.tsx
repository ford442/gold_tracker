interface SecurityWarningsProps {
  dismissed: boolean;
  onDismiss: () => void;
  isSignedIn: boolean;
}

export function SecurityWarnings({ dismissed, onDismiss, isSignedIn }: SecurityWarningsProps) {
  if (dismissed) return null;

  return (
    <div
      className="mb-6 rounded-lg p-4 border"
      style={{
        background: 'rgba(220,38,38,0.1)',
        borderColor: 'rgba(220,38,38,0.3)',
      }}
    >
      <div className="flex items-start gap-3">
        <span style={{ color: 'var(--color-red)', fontSize: '1.2rem' }}>⚠️</span>
        <div style={{ flex: 1 }}>
          <h3 style={{
            fontSize: '0.85rem',
            fontWeight: 700,
            color: 'var(--color-red)',
            marginBottom: '4px',
          }}>
            Security Warning
          </h3>
          <p style={{
            fontSize: '0.75rem',
            color: 'var(--color-text)',
            lineHeight: 1.5,
          }}>
            {isSignedIn
              ? 'API keys will be AES-encrypted on Supabase. Never stored in browser.'
              : 'API keys stored locally in your browser only. Sign in for secure server storage.'}
            {' '}Ensure your API key has <strong>Trade</strong> permission only (never Withdraw).
            Use &quot;Dry-Run&quot; mode first to test safely.
          </p>
        </div>
        <button
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-muted)',
            fontSize: '1rem',
            padding: '4px',
          }}
          aria-label="Dismiss warning"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
