import type { User } from '@supabase/supabase-js';

interface Props {
  count: number;
  selectedExchange: string;
  user: User | null;
  autoTradeEnabled: boolean;
  dryRun: boolean;
  onOpenSettings: () => void;
}

export function TradeSuggestionsHeader({
  count,
  selectedExchange,
  user,
  autoTradeEnabled,
  dryRun,
  onOpenSettings,
}: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '12px',
      }}
    >
      <h2 className="section-heading">
        <span className="heading-icon">⚡</span> Suggested Trades
        <span
          style={{
            fontSize: 'var(--font-xs)',
            padding: '4px 10px',
            borderRadius: '999px',
            background: 'var(--color-gold-dim)',
            color: 'var(--color-gold)',
            fontWeight: 700,
          }}
        >
          {count} Active
        </span>
      </h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span
          title={dryRun
            ? 'Paper mode: executions are simulated and logged to the Paper Ledger — no live orders.'
            : 'LIVE mode: executions place real orders on the selected exchange.'}
          style={{
            fontSize: 'var(--font-xs)',
            padding: '4px 10px',
            borderRadius: '999px',
            background: dryRun ? 'var(--color-accent-dim)' : 'rgba(220,38,38,0.12)',
            color: dryRun ? 'var(--color-accent)' : 'var(--color-red)',
            fontWeight: 700,
            letterSpacing: '0.04em',
          }}
        >
          {dryRun ? '🧪 PAPER' : '🚀 LIVE'}
        </span>
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
          {selectedExchange === 'kraken' ? '🔱 Kraken' : '🔵 Coinbase'}
        </span>
        {user && (
          <span
            style={{
              fontSize: 'var(--font-xs)',
              padding: '4px 10px',
              borderRadius: '999px',
              background: 'rgba(5,150,105,0.1)',
              color: 'var(--color-green)',
              fontWeight: 600,
            }}
          >
            🔒 Server
          </span>
        )}
        {autoTradeEnabled && (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: 'var(--font-xs)',
              fontWeight: 600,
              color: 'var(--color-red)',
              background: 'rgba(220,38,38,0.1)',
              padding: '4px 10px',
              borderRadius: '999px',
            }}
          >
            <span
              className="live-pulse"
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: 'var(--color-red)',
              }}
            />
            Auto {dryRun ? '(Dry)' : 'LIVE'}
          </span>
        )}
        <button
          onClick={onOpenSettings}
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            background: 'transparent',
            color: 'var(--color-muted)',
            fontSize: 'var(--font-xs)',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          ⚙️ Settings
        </button>
      </div>
    </div>
  );
}

interface FooterProps {
  selectedExchange: string;
  user: User | null;
}

export function TradeSuggestionsFooter({ selectedExchange, user }: FooterProps) {
  return (
    <div
      style={{
        marginTop: '20px',
        paddingTop: '16px',
        borderTop: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '10px',
        fontSize: 'var(--font-xs)',
        color: 'var(--color-muted)',
      }}
    >
      <span>
        Trading via:{' '}
        <strong
          style={{
            color: selectedExchange === 'kraken' ? 'var(--color-green)' : 'var(--color-blue)',
          }}
        >
          {selectedExchange === 'kraken' ? '🔱 Kraken Pro' : '🔵 Coinbase Advanced'}
        </strong>
      </span>
      <span>
        {user
          ? '🔒 Keys stored securely on Supabase'
          : '⚠️ Keys stored locally (sign in for security)'}
      </span>
    </div>
  );
}
