interface Props {
  selectedExchange: string;
  onOpenSettings: () => void;
}

export function TradeSuggestionsEmptyState({ selectedExchange, onOpenSettings }: Props) {
  return (
    <div
      className="glass-card"
      style={{
        padding: '24px',
        marginBottom: 'var(--space-2xl)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <h2 className="section-heading">
          <span className="heading-icon">💡</span> Trading Intelligence
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              fontSize: 'var(--font-xs)',
              padding: '4px 10px',
              borderRadius: '999px',
              background:
                selectedExchange === 'kraken' ? 'rgba(5,150,105,0.1)' : 'rgba(37,99,235,0.1)',
              color: selectedExchange === 'kraken' ? 'var(--color-green)' : 'var(--color-blue)',
              fontWeight: 600,
            }}
          >
            {selectedExchange === 'kraken' ? '🔱 Kraken Mode' : '🔵 Coinbase Mode'}
          </span>
          <button
            onClick={onOpenSettings}
            style={{
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-muted)',
              fontSize: 'var(--font-xs)',
              cursor: 'pointer',
            }}
            aria-label="Open settings"
          >
            ⚙️
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '52px 20px 44px',
          textAlign: 'center',
        }}
      >
        <div style={{ position: 'relative', marginBottom: '24px' }}>
          <div
            style={{
              position: 'absolute',
              inset: '-12px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(212,175,55,0.12) 0%, transparent 70%)',
              animation: 'pulse-live 2.4s ease-in-out infinite',
            }}
            aria-hidden="true"
          />
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(212,175,55,0.18), rgba(212,175,55,0.06))',
              border: '1px solid rgba(212,175,55,0.28)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
              opacity: 0.75,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: '0 0 24px rgba(212,175,55,0.12)',
            }}
          >
            ⚖️
          </div>
        </div>
        <p
          style={{
            fontFamily: 'var(--font-display)',
            color: 'var(--color-gold)',
            fontSize: 'var(--font-lg)',
            fontWeight: 700,
            margin: '0 0 8px',
            letterSpacing: '0.01em',
            opacity: 0.85,
          }}
        >
          Market is Balanced
        </p>
        <p
          style={{
            color: 'var(--color-muted)',
            fontSize: 'var(--font-base)',
            margin: '0 0 6px',
            maxWidth: '340px',
            lineHeight: 1.5,
          }}
        >
          No significant arbitrage divergence detected at this time.
        </p>
        <p
          style={{
            color: 'var(--color-muted)',
            fontSize: 'var(--font-xs)',
            marginTop: '4px',
            opacity: 0.6,
          }}
        >
          Waiting for divergence · Scanning every 30s
        </p>
      </div>
    </div>
  );
}
