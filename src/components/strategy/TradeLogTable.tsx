import type { BacktestResult } from '@lib/strategyEngine';
import { formatPrice } from '@lib/utils';

interface Props {
  result: BacktestResult;
  isLab: boolean;
}

export function TradeLogTable({ result, isLab }: Props) {
  if (result.trades.length === 0) return null;

  const tradeLogDisplay = [...result.trades].reverse().slice(0, 100);
  const showFees = result.totalFeesUsd > 0;
  const headers = ['Date / Time', 'Asset', 'Side', 'Price', 'Units', 'Amount (USD)', ...(showFees ? ['Fee'] : []), 'P&L'];

  return (
    <div className="glass-card" style={{ padding: 'var(--space-xl)' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '12px',
      }}
      >
        <h3 className="section-heading">
          <span className="heading-icon">🗒</span> {isLab ? 'Scenario Trades (rebal + DCA)' : 'Simulated Trade Log'}
        </h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <span style={{
            fontSize: 'var(--font-xs)',
            padding: '3px 10px',
            borderRadius: '999px',
            background: 'var(--color-surface2)',
            color: 'var(--color-muted)',
            fontWeight: 600,
          }}
          >
            {result.trades.length} executions
          </span>
          <span style={{
            fontSize: 'var(--font-xs)',
            padding: '3px 10px',
            borderRadius: '999px',
            background: 'var(--color-accent-dim)',
            color: 'var(--color-accent)',
            fontWeight: 600,
          }}
          >
            Showing last {Math.min(100, result.trades.length)}
          </span>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-xs)' }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, background: 'var(--color-surface)', zIndex: 1 }}>
                {headers.map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '10px 12px',
                      textAlign: h === 'P&L' || h === 'Amount (USD)' || h === 'Price' || h === 'Units' || h === 'Fee' ? 'right' : 'left',
                      color: 'var(--color-muted)',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      borderBottom: '2px solid var(--color-border)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tradeLogDisplay.map((trade, idx) => {
                const isEven = idx % 2 === 0;
                const pnlColor = trade.side === 'BUY'
                  ? 'var(--color-muted)'
                  : trade.pnl >= 0
                    ? 'var(--color-green)'
                    : 'var(--color-red)';

                return (
                  <tr
                    key={trade.id}
                    style={{
                      background: isEven ? 'transparent' : 'var(--color-surface2)',
                      borderBottom: '1px solid var(--color-border)',
                      transition: 'background 0.1s',
                    }}
                    title={trade.reason}
                  >
                    <td style={{ padding: '10px 12px', color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(trade.timestamp).toLocaleString('en-US', {
                        month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--color-text)' }}>
                      {trade.symbol}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        background: trade.side === 'BUY'
                          ? 'var(--color-gold-dim)'
                          : trade.pnl >= 0
                            ? 'var(--color-green-dim)'
                            : 'var(--color-red-dim)',
                        color: trade.side === 'BUY'
                          ? 'var(--color-gold)'
                          : trade.pnl >= 0
                            ? 'var(--color-green)'
                            : 'var(--color-red)',
                      }}
                      >
                        {trade.side}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text)' }}>
                      {formatPrice(trade.price)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--color-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {trade.units < 0.01
                        ? trade.units.toFixed(6)
                        : trade.units < 1
                          ? trade.units.toFixed(4)
                          : trade.units.toFixed(2)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text)' }}>
                      {formatPrice(trade.amountUSD)}
                    </td>
                    {showFees && (
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-muted)' }}>
                        {trade.feeUsd > 0 ? formatPrice(trade.feeUsd) : '—'}
                      </td>
                    )}
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: pnlColor, fontVariantNumeric: 'tabular-nums' }}>
                      {trade.side === 'BUY'
                        ? <span style={{ color: 'var(--color-muted)' }}>—</span>
                        : (trade.pnl >= 0 ? '+' : '') + formatPrice(trade.pnl)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {result.trades.length > 100 && (
        <p style={{ margin: '12px 0 0 0', fontSize: 'var(--font-xs)', color: 'var(--color-muted)', textAlign: 'center' }}>
          Showing most recent 100 of {result.trades.length} total executions
        </p>
      )}
    </div>
  );
}
