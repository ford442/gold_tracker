interface SecurityWarningsProps {
  dismissed: boolean;
  onDismiss: () => void;
  isSignedIn: boolean;
  hasLocalKeys: boolean;
}

export function SecurityWarnings({ dismissed, onDismiss, isSignedIn, hasLocalKeys }: SecurityWarningsProps) {
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
            Security — read before saving API keys
          </h3>
          <ul style={{
            fontSize: '0.75rem',
            color: 'var(--color-text)',
            lineHeight: 1.55,
            margin: 0,
            paddingLeft: '1.1rem',
          }}>
            {isSignedIn ? (
              <>
                <li>Server-secure mode: keys are AES-GCM encrypted in Supabase and only decrypted inside Edge Functions.</li>
                <li>Keys are not re-downloaded to the browser after upload.</li>
              </>
            ) : (
              <>
                <li>
                  <strong>Local mode:</strong> keys are saved in <code>localStorage</code> via Zustand.
                  Any XSS on this origin can read them — use server-secure mode for real trading.
                </li>
                {hasLocalKeys && (
                  <li style={{ color: 'var(--color-red)', fontWeight: 600 }}>
                    You currently have exchange keys in this browser. Clear them before using a shared device.
                  </li>
                )}
              </>
            )}
            <li>Grant <strong>Trade</strong> permission only — never Withdraw or Transfer.</li>
            <li>Keep <strong>Dry-Run</strong> enabled until you have tested connectivity.</li>
            <li>Prefer SSH deploy keys for CI; never disable SSH host key verification in production pipelines.</li>
          </ul>
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
