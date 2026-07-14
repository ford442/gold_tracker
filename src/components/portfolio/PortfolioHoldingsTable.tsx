import { formatPrice, formatNumber, formatPercent } from '@lib/utils';
import { resolvePortfolioAssetId } from '@lib/assets';
import type { PortfolioEntry } from '@/types';
import { getCurrentPrice } from './portfolioUtils';

interface Props {
  entries: PortfolioEntry[];
  prices: Record<string, { price: number }>;
  goldPrice: number | null;
  onEdit: (entry: PortfolioEntry) => void;
  onRemove: (id: string) => void;
}

export function PortfolioHoldingsTable({
  entries,
  prices,
  goldPrice,
  onEdit,
  onRemove,
}: Props) {
  return (
    <div className="glass-card">
      <table className="table-zebra" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
            {['Asset', 'Amount', 'Buy Price', 'Current', 'Value', 'P&L', ''].map((h) => (
              <th
                key={h}
                style={{
                  padding: '14px 12px',
                  fontSize: 'var(--font-xs)',
                  color: 'var(--color-muted)',
                  textAlign:
                    h === 'Amount' ||
                    h === 'Buy Price' ||
                    h === 'Current' ||
                    h === 'Value' ||
                    h === 'P&L'
                      ? 'right'
                      : h === ''
                        ? 'center'
                        : 'left',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const assetId = resolvePortfolioAssetId(entry.symbol);
            const curPrice = getCurrentPrice(assetId, prices, goldPrice);
            const value = entry.amount * curPrice;
            const cost = entry.amount * entry.buyPrice;
            const pnl = value - cost;
            const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
            const isCoinbase = entry.source === 'coinbase';

            return (
              <tr
                key={entry.id}
                style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.15s' }}
              >
                <td
                  style={{
                    padding: '14px 12px',
                    fontSize: 'var(--font-base)',
                    fontWeight: 600,
                    color: 'var(--color-text)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {entry.symbol}
                    {isCoinbase && (
                      <span
                        style={{
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'var(--color-gold)',
                          color: '#000',
                          letterSpacing: '0.04em',
                        }}
                      >
                        CB
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 'var(--font-xs)',
                      color: 'var(--color-muted)',
                      fontWeight: 400,
                    }}
                  >
                    {entry.name}
                  </span>
                </td>
                <td
                  style={{
                    padding: '14px 12px',
                    fontSize: 'var(--font-base)',
                    color: 'var(--color-text)',
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {entry.amount < 0.001
                    ? entry.amount.toFixed(8)
                    : entry.amount < 1
                      ? entry.amount.toFixed(4)
                      : entry.amount.toFixed(2)}
                </td>
                <td
                  style={{
                    padding: '14px 12px',
                    fontSize: 'var(--font-base)',
                    color: 'var(--color-muted)',
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatPrice(entry.buyPrice)}
                </td>
                <td
                  style={{
                    padding: '14px 12px',
                    fontSize: 'var(--font-base)',
                    color: 'var(--color-text)',
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {curPrice > 0 ? formatPrice(curPrice) : '—'}
                </td>
                <td
                  style={{
                    padding: '14px 12px',
                    fontSize: 'var(--font-base)',
                    fontWeight: 600,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {curPrice > 0 ? formatNumber(value) : '—'}
                </td>
                <td
                  style={{
                    padding: '14px 12px',
                    fontSize: 'var(--font-base)',
                    fontWeight: 600,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    color: pnl >= 0 ? 'var(--color-green)' : 'var(--color-red)',
                  }}
                >
                  {curPrice > 0 ? (
                    <span>
                      {pnl >= 0 ? '↑ +' : '↓ '}
                      {formatNumber(pnl)}
                      <span style={{ display: 'block', fontSize: 'var(--font-xs)' }}>
                        ({formatPercent(pnlPct)})
                      </span>
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td style={{ padding: '14px 12px', textAlign: 'center' }}>
                  {!isCoinbase && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                      }}
                    >
                      <button
                        onClick={() => onEdit(entry)}
                        aria-label={`Edit ${entry.symbol} position`}
                        title="Edit position"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--color-gold)',
                          fontSize: '1.1rem',
                          padding: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => onRemove(entry.id)}
                        aria-label={`Remove ${entry.symbol} position`}
                        title="Delete position"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--color-red)',
                          fontSize: '1.1rem',
                          padding: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
