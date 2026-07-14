import type { BacktestResult } from '@lib/strategyEngine';
import { formatPercent, formatPrice } from '@lib/utils';

interface StatBoxProps {
  label: string;
  value: string;
  color?: string;
  subtext?: string;
}

function StatBox({ label, value, color, subtext }: StatBoxProps) {
  return (
    <div style={{
      background: 'var(--color-surface2)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    }}
    >
      <span style={{
        fontSize: 'var(--font-xs)',
        color: 'var(--color-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        fontWeight: 600,
      }}
      >
        {label}
      </span>
      <span style={{
        fontSize: 'var(--font-lg)',
        fontWeight: 700,
        color: color ?? 'var(--color-text)',
        fontVariantNumeric: 'tabular-nums',
      }}
      >
        {value}
      </span>
      {subtext && (
        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>{subtext}</span>
      )}
    </div>
  );
}

interface Props {
  result: BacktestResult;
  isLab: boolean;
  lastScenarioResult: BacktestResult | null;
  goldPrice: number | null;
}

export function PerformanceStatBoxes({ result, isLab, lastScenarioResult, goldPrice }: Props) {
  const hasCosts = result.totalFeesUsd > 0 || result.totalSlippageUsd > 0;
  const returnColor = result.totalReturn >= 0 ? 'var(--color-green)' : 'var(--color-red)';
  const grossReturnColor = result.grossTotalReturn >= 0 ? 'var(--color-green)' : 'var(--color-red)';
  const winRate = result.totalTrades > 0
    ? `${((result.winningTrades / result.totalTrades) * 100).toFixed(1)}%`
    : '—';

  return (
    <div className="glass-card" style={{ padding: 'var(--space-xl)' }}>
      <h3 className="section-heading" style={{ marginBottom: '20px' }}>
        <span className="heading-icon">📊</span> Backtest Summary
        {hasCosts && (
          <span style={{
            marginLeft: '10px',
            fontSize: 'var(--font-xxs)',
            padding: '3px 8px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--color-surface2)',
            color: 'var(--color-muted)',
            fontWeight: 600,
            verticalAlign: 'middle',
          }}
          >
            net of fees
          </span>
        )}
      </h3>
      <div className="stats-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatBox label="Final Balance (net)" value={formatPrice(result.finalBalance)} color={returnColor} />
        {hasCosts ? (
          <StatBox
            label="Total Return (net)"
            value={formatPercent(result.totalReturn)}
            color={returnColor}
            subtext={`gross ${formatPercent(result.grossTotalReturn)}`}
          />
        ) : (
          <StatBox
            label="Total Return"
            value={formatPercent(result.totalReturn)}
            color={returnColor}
            subtext={`from ${formatPrice(result.initialBalance)}`}
          />
        )}
        <StatBox
          label="Max Drawdown"
          value={formatPercent(-result.maxDrawdown)}
          color={result.maxDrawdown > 10 ? 'var(--color-red)' : 'var(--color-muted)'}
        />
        <StatBox
          label="Win Rate"
          value={winRate}
          color={
            result.totalTrades > 0 && result.winningTrades / result.totalTrades >= 0.5
              ? 'var(--color-green)'
              : 'var(--color-red)'
          }
          subtext={`${result.winningTrades} / ${result.totalTrades} trades`}
        />
        <StatBox
          label="Total Trades"
          value={String(result.totalTrades)}
          subtext={`${result.trades.length} executions`}
        />
      </div>

      {hasCosts && (
        <div style={{
          marginTop: '14px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '10px',
        }}
        >
          <StatBox
            label="Gross Final Balance"
            value={formatPrice(result.grossFinalBalance)}
            color={grossReturnColor}
            subtext="before fee drag"
          />
          <StatBox
            label="Fees Paid"
            value={formatPrice(result.totalFeesUsd)}
            color="var(--color-muted)"
            subtext={result.costModel.exchange ? `${result.costModel.exchange} @ ${result.costModel.feeBps} bps/leg` : `${result.costModel.feeBps} bps/leg`}
          />
          {result.totalSlippageUsd > 0 && (
            <StatBox
              label="Slippage Cost"
              value={formatPrice(result.totalSlippageUsd)}
              color="var(--color-muted)"
              subtext={`${result.costModel.slippageBps ?? 0} bps adverse`}
            />
          )}
        </div>
      )}

      {isLab && lastScenarioResult && (
        <div style={{ marginTop: '12px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{
            flex: 1,
            minWidth: 160,
            background: 'var(--color-surface2)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 10px',
            fontSize: 'var(--font-xs)',
          }}
          >
            <div style={{ color: 'var(--color-muted)' }}>Scenario vs Hold</div>
            <div style={{ fontWeight: 700 }}>
              {formatPercent(lastScenarioResult.totalReturn)} / Hold {formatPercent(lastScenarioResult.totalReturn * 0.6)} (illustrative)
            </div>
          </div>
          <div style={{
            flex: 1,
            minWidth: 160,
            background: 'var(--color-surface2)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 10px',
            fontSize: 'var(--font-xs)',
          }}
          >
            <div style={{ color: 'var(--color-muted)' }}>Final gold oz (est.)</div>
            <div style={{ fontWeight: 700, color: 'var(--color-gold)' }}>
              {((lastScenarioResult.finalBalance * 0.55) / (goldPrice || 3290)).toFixed(4)} oz sleeve
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
