import type { TradeSuggestion } from '@/types/TradeSuggestion';
import { InfoTooltip, TrendIndicator } from './shared';
import { TradeExecuteControls } from './TradeExecuteControls';

interface Props {
  suggestion: TradeSuggestion;
  selectedExchange: string;
  executingId: string | null;
  dryRun: boolean;
  onExecute: (suggestion: TradeSuggestion) => void;
}

export function TradeSuggestionCard({
  suggestion,
  selectedExchange,
  executingId,
  dryRun,
  onExecute,
}: Props) {
  return (
    <div
      className="card-hover"
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface2)',
        padding: '20px',
        transition: 'all 0.15s ease',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          padding: '4px 10px',
          background: 'var(--color-surface)',
          borderBottomLeftRadius: 'var(--radius-md)',
          fontSize: '0.65rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--color-muted)',
        }}
      >
        {suggestion.type}
      </div>

      {suggestion.id === 'arb-paxg-xaut' && selectedExchange === 'kraken' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            padding: '4px 10px',
            background: 'var(--color-green)',
            borderBottomRightRadius: 'var(--radius-md)',
            fontSize: '0.65rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#fff',
          }}
        >
          Direct Pair
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
              marginBottom: '8px',
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: '1.1rem',
                fontWeight: 700,
                color: 'var(--color-text)',
              }}
            >
              {suggestion.action}
            </h3>
            <span
              style={{
                fontSize: 'var(--font-xs)',
                fontFamily: 'monospace',
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-green-dim)',
                color: 'var(--color-green)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {suggestion.confidence}% Conf.
              <InfoTooltip text="Confidence based on spread magnitude, volume, and historical success rate" />
            </span>
            {suggestion.regimeTag && (
              <span
                className={`badge ${suggestion.regimeBlocked ? 'badge-red' : 'badge-gold'}`}
                title={suggestion.regimeReason}
                style={{ fontSize: 'var(--font-xs)' }}
              >
                {suggestion.regimeTag}
                {suggestion.regimeScore !== undefined ? ` · ${suggestion.regimeScore}` : ''}
              </span>
            )}
            <TrendIndicator direction="up" value={0.15} />
          </div>
          {suggestion.regimeReason && (
            <p
              style={{
                fontSize: 'var(--font-xs)',
                color: suggestion.regimeBlocked ? 'var(--color-red)' : 'var(--color-muted)',
                margin: '0 0 8px',
                lineHeight: 1.4,
              }}
            >
              <strong>Regime:</strong> {suggestion.regimeReason}
            </p>
          )}
          {suggestion.regimeDisclaimer && (
            <p style={{ fontSize: 'var(--font-xxs)', color: 'var(--color-muted)', margin: '0 0 8px' }}>
              {suggestion.regimeDisclaimer}
            </p>
          )}
          <p
            style={{
              fontSize: 'var(--font-sm)',
              color: 'var(--color-muted)',
              margin: 0,
              marginBottom: '12px',
              lineHeight: 1.5,
            }}
          >
            {suggestion.reason}
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              flexWrap: 'wrap',
              fontSize: 'var(--font-xs)',
              color: 'var(--color-muted)',
            }}
          >
            <span>
              <strong style={{ color: 'var(--color-text)' }}>Size:</strong> {suggestion.size}
            </span>
            <span>
              <strong style={{ color: 'var(--color-green)' }}>Exp. Profit:</strong>{' '}
              {suggestion.expectedProfit}
            </span>
          </div>

          {suggestion.id === 'arb-paxg-xaut' && selectedExchange === 'kraken' && (
            <p
              style={{
                fontSize: 'var(--font-xs)',
                color: 'var(--color-green)',
                marginTop: '8px',
                marginBottom: 0,
              }}
            >
              ✅ Lower fees with Kraken direct PAXG/XAUT pair!
            </p>
          )}
        </div>

        <TradeExecuteControls
          suggestion={suggestion}
          executingId={executingId}
          dryRun={dryRun}
          selectedExchange={selectedExchange}
          onExecute={onExecute}
        />
      </div>
    </div>
  );
}
