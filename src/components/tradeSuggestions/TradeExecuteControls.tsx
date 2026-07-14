import type { TradeSuggestion } from '@/types/TradeSuggestion';

interface Props {
  suggestion: TradeSuggestion;
  executingId: string | null;
  dryRun: boolean;
  selectedExchange: string;
  onExecute: (suggestion: TradeSuggestion) => void;
}

export function TradeExecuteControls({
  suggestion,
  executingId,
  dryRun,
  selectedExchange,
  onExecute,
}: Props) {
  const isExecuting = executingId === suggestion.id;

  const blocked = suggestion.regimeBlocked === true;

  return (
    <div
      style={{
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap',
      }}
    >
      <button
        onClick={() => onExecute(suggestion)}
        disabled={isExecuting || blocked}
        title={blocked ? (suggestion.regimeReason ?? 'Regime gate blocked') : undefined}
        style={{
          flex: '1 1 200px',
          padding: '12px 20px',
          borderRadius: 'var(--radius-md)',
          border: 'none',
          background: isExecuting || blocked
            ? 'var(--color-surface)'
            : dryRun
              ? 'var(--color-accent)'
              : 'var(--color-red)',
          color: '#fff',
          fontSize: '0.9rem',
          fontWeight: 700,
          cursor: isExecuting || blocked ? 'not-allowed' : 'pointer',
          opacity: isExecuting || blocked ? 0.6 : 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          boxShadow: isExecuting ? 'none' : 'var(--shadow-md)',
        }}
      >
        {isExecuting ? (
          <>
            <span
              style={{
                width: '16px',
                height: '16px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }}
            />
            Executing...
          </>
        ) : blocked ? (
          <>⛔ Regime gated — manual review required</>
        ) : dryRun ? (
          <>🧪 PAPER TRADE ({selectedExchange.toUpperCase()} fees)</>
        ) : (
          <>🚀 LIVE EXECUTE on {selectedExchange.toUpperCase()}</>
        )}
      </button>

      <a
        href={suggestion.coinbaseDeepLink}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          padding: '12px 20px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          background: 'transparent',
          color: 'var(--color-text)',
          fontSize: '0.85rem',
          fontWeight: 600,
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--color-surface2)';
          e.currentTarget.style.borderColor = 'var(--color-gold)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.borderColor = 'var(--color-border)';
        }}
      >
        Manual on Coinbase ↗
      </a>
    </div>
  );
}
