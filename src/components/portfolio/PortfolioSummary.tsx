import { formatNumber, formatPercent } from '@lib/utils';

interface Props {
  totalValue: number;
  totalPnL: number;
  totalPnLPct: number;
  goldPct: number;
  cryptoPct: number;
}

export function PortfolioSummary({
  totalValue,
  totalPnL,
  totalPnLPct,
  goldPct,
  cryptoPct,
}: Props) {
  return (
    <div
      className="glass-card"
      style={{
        padding: '18px 20px',
        marginBottom: 'var(--space-lg)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '16px',
      }}
    >
      <div>
        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', marginBottom: '4px' }}>
          Total Value
        </div>
        <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-text)' }}>
          {formatNumber(totalValue)}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', marginBottom: '4px' }}>
          Unrealized P&L
        </div>
        <div
          style={{
            fontSize: '1.2rem',
            fontWeight: 700,
            color: totalPnL >= 0 ? 'var(--color-green)' : 'var(--color-red)',
          }}
        >
          {totalPnL >= 0 ? '↑ +' : '↓ '}
          {formatNumber(totalPnL)} ({formatPercent(totalPnLPct)})
        </div>
      </div>
      <div>
        <div
          style={{
            fontSize: 'var(--font-xs)',
            color: 'var(--color-muted)',
            marginBottom: '4px',
            cursor: 'help',
          }}
          title="Percentage of portfolio value in gold-backed assets (XAU, PAXG, XAUT)"
        >
          Gold Exposure
        </div>
        <div style={{ fontWeight: 700, color: 'var(--color-gold)', fontSize: '1.1rem' }}>
          {goldPct.toFixed(1)}%
        </div>
      </div>
      <div>
        <div
          style={{
            fontSize: 'var(--font-xs)',
            color: 'var(--color-muted)',
            marginBottom: '4px',
            cursor: 'help',
          }}
          title="Percentage of portfolio value in non-gold crypto assets (BTC, ETH, etc.)"
        >
          Crypto Beta
        </div>
        <div style={{ fontWeight: 700, color: 'var(--color-blue)', fontSize: '1.1rem' }}>
          {cryptoPct.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}
