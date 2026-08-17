import type { CounterfactualEvaluation } from '@lib/counterfactual';
import { formatPrice, formatPercent } from '@lib/utils';

interface Props {
  evaluation: CounterfactualEvaluation;
  fromSymbol: string;
  toSymbol: string;
}

function formatQty(val: number): string {
  if (val >= 1000) return val.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (val >= 1) return val.toLocaleString('en-US', { maximumFractionDigits: 4 });
  return val.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

export function CounterfactualStatCards({ evaluation, fromSymbol, toSymbol }: Props) {
  const {
    currentValueIfTraded,
    currentValueIfKept,
    deltaUsd,
    alphaPct,
    returnIfTradedPct,
    returnIfKeptPct,
    toAmountReceived,
    trade,
    priceFromAtTrade,
    priceToAtTrade,
    feeUsd,
    isProfitable,
  } = evaluation;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
      {/* 3 Metric Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
        }}
      >
        {/* Card 1: If Traded */}
        <div
          style={{
            padding: '14px',
            borderRadius: 'var(--radius-md, 8px)',
            background: 'var(--color-surface2, rgba(255, 255, 255, 0.04))',
            border: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--color-muted)', fontWeight: 600 }}>
            🟣 IF YOU TRADED INTO {toSymbol}
          </div>
          <div style={{ fontSize: 'var(--font-xl)', fontWeight: 800, color: 'var(--color-text)' }}>
            {formatPrice(currentValueIfTraded)}
          </div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>
            Received: <strong style={{ color: 'var(--color-text)' }}>{formatQty(toAmountReceived)} {toSymbol}</strong>
            {feeUsd > 0 && <span> (after {formatPrice(feeUsd)} fee)</span>}
          </div>
          <div
            style={{
              fontSize: 'var(--font-xxs)',
              color: returnIfTradedPct >= 0 ? 'var(--color-green)' : 'var(--color-red)',
              fontWeight: 600,
              marginTop: '2px',
            }}
          >
            {toSymbol} path: {returnIfTradedPct >= 0 ? '+' : ''}{formatPercent(returnIfTradedPct / 100)} since trade
          </div>
        </div>

        {/* Card 2: If Kept */}
        <div
          style={{
            padding: '14px',
            borderRadius: 'var(--radius-md, 8px)',
            background: 'var(--color-surface2, rgba(255, 255, 255, 0.04))',
            border: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--color-muted)', fontWeight: 600 }}>
            🟡 IF YOU KEPT {fromSymbol}
          </div>
          <div style={{ fontSize: 'var(--font-xl)', fontWeight: 800, color: 'var(--color-text)' }}>
            {formatPrice(currentValueIfKept)}
          </div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>
            Original: <strong style={{ color: 'var(--color-text)' }}>{formatQty(trade.fromAmount)} {fromSymbol}</strong>
          </div>
          <div
            style={{
              fontSize: 'var(--font-xxs)',
              color: returnIfKeptPct >= 0 ? 'var(--color-green)' : 'var(--color-red)',
              fontWeight: 600,
              marginTop: '2px',
            }}
          >
            {fromSymbol} path: {returnIfKeptPct >= 0 ? '+' : ''}{formatPercent(returnIfKeptPct / 100)} since trade
          </div>
        </div>

        {/* Card 3: Net Alpha / Delta */}
        <div
          style={{
            padding: '14px',
            borderRadius: 'var(--radius-md, 8px)',
            background: isProfitable
              ? 'var(--color-green-dim, rgba(0, 219, 166, 0.1))'
              : 'var(--color-red-dim, rgba(255, 90, 120, 0.1))',
            border: `1px solid ${isProfitable ? 'rgba(0, 219, 166, 0.3)' : 'rgba(255, 90, 120, 0.3)'}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div
            style={{
              fontSize: 'var(--font-xxs)',
              color: isProfitable ? 'var(--color-green)' : 'var(--color-red)',
              fontWeight: 700,
            }}
          >
            {isProfitable ? '🚀 TRADE ALPHA (WIN)' : '📉 HOLDING BENEFIT (LOSS)'}
          </div>
          <div
            style={{
              fontSize: 'var(--font-xl)',
              fontWeight: 800,
              color: isProfitable ? 'var(--color-green)' : 'var(--color-red)',
            }}
          >
            {deltaUsd >= 0 ? '+' : ''}{formatPrice(deltaUsd)}
          </div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-text)', fontWeight: 600 }}>
            {alphaPct >= 0 ? '+' : ''}{formatPercent(alphaPct / 100)} vs holding
          </div>
          <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--color-muted)', marginTop: '2px' }}>
            Trade Price: {formatPrice(priceFromAtTrade)} ➔ {formatPrice(priceToAtTrade)}
          </div>
        </div>
      </div>

      {/* English Summary Banner */}
      <div
        style={{
          padding: '10px 14px',
          borderRadius: 'var(--radius-sm, 6px)',
          background: isProfitable
            ? 'var(--color-green-dim, rgba(0, 219, 166, 0.08))'
            : 'var(--color-surface2, rgba(255, 255, 255, 0.03))',
          border: `1px solid ${isProfitable ? 'rgba(0, 219, 166, 0.25)' : 'var(--color-border)'}`,
          fontSize: 'var(--font-xs)',
          color: 'var(--color-text)',
          lineHeight: 1.5,
        }}
      >
        {isProfitable ? (
          <span>
            💡 <strong>Profitable decision:</strong> Swapping <strong>{formatQty(trade.fromAmount)} {fromSymbol}</strong> for{' '}
            <strong>{formatQty(toAmountReceived)} {toSymbol}</strong> on {new Date(trade.timestamp).toLocaleDateString()} would be worth{' '}
            <strong style={{ color: 'var(--color-green)' }}>{formatPrice(currentValueIfTraded)}</strong> today vs{' '}
            <strong>{formatPrice(currentValueIfKept)}</strong> by holding — yielding an extra{' '}
            <strong style={{ color: 'var(--color-green)' }}>+{formatPrice(deltaUsd)} (+{alphaPct.toFixed(2)}%)</strong>.
          </span>
        ) : (
          <span>
            🛡️ <strong>Holding was better:</strong> Keeping <strong>{formatQty(trade.fromAmount)} {fromSymbol}</strong> on{' '}
            {new Date(trade.timestamp).toLocaleDateString()} resulted in <strong>{formatPrice(currentValueIfKept)}</strong> today vs{' '}
            <strong>{formatPrice(currentValueIfTraded)}</strong> if traded to {toSymbol} — saving{' '}
            <strong style={{ color: 'var(--color-red)' }}>{formatPrice(Math.abs(deltaUsd))} ({Math.abs(alphaPct).toFixed(2)}%)</strong> in opportunity cost.
          </span>
        )}
      </div>
    </div>
  );
}
