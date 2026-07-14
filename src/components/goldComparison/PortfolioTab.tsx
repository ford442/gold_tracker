import { useMemo } from 'react';
import { usePriceStore } from '@/store/priceStore';
import { usePortfolioStore } from '@/store/portfolioStore';
import { PORTFOLIO_COLUMNS } from './constants';

export function PortfolioTab() {
  const { prices, goldSpot } = usePriceStore();
  const { entries: portfolioEntries } = usePortfolioStore();

  const spotPrice = goldSpot?.price ?? prices['pax-gold']?.price ?? 3290;

  const portfolioData = useMemo(() => {
    return portfolioEntries.map((entry) => {
      const currentPrice = prices[entry.id]?.price
        ?? prices[entry.symbol.toLowerCase()]?.price
        ?? (entry.symbol === 'XAU' ? spotPrice : entry.buyPrice);
      const currentValue = entry.amount * currentPrice;
      const costBasis = entry.amount * entry.buyPrice;
      const pnl = currentValue - costBasis;
      const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
      const goldEquivOz = spotPrice > 0 ? currentValue / spotPrice : 0;
      const isGoldBacked = ['PAXG', 'XAUT', 'XAU'].includes(entry.symbol);
      const goldExposurePct = isGoldBacked ? 100 : 0;

      return {
        ...entry,
        currentPrice,
        currentValue,
        costBasis,
        pnl,
        pnlPct,
        goldEquivOz,
        goldExposurePct,
        isGoldBacked,
      };
    });
  }, [portfolioEntries, prices, spotPrice]);

  const totalValue = portfolioData.reduce((sum, e) => sum + e.currentValue, 0);
  const totalGoldEquiv = portfolioData.reduce((sum, e) => sum + e.goldEquivOz, 0);
  const totalGoldBacked = portfolioData
    .filter((e) => e.isGoldBacked ?? false)
    .reduce((sum, e) => sum + e.currentValue, 0);
  const totalPnl = portfolioData.reduce((s, e) => s + e.pnl, 0);
  const totalCost = portfolioData.reduce((s, e) => s + e.costBasis, 0);
  const totalPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  return (
    <div className="glass-card" style={{ padding: 'var(--space-lg)' }}>
      {portfolioEntries.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: 'var(--space-xl)',
          color: 'var(--color-muted)',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>💼</div>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>No portfolio entries yet</div>
          <div style={{ fontSize: 'var(--font-xs)' }}>
            Add positions in the Portfolio Tracker section below to see comparison data here.
          </div>
        </div>
      ) : (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '10px',
            marginBottom: '20px',
          }}>
            <div style={{ background: 'var(--color-surface2)', borderRadius: 'var(--radius-md)', padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', marginBottom: '4px' }}>Total Value</div>
              <div style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: 'var(--color-gold)' }}>
                ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{ background: 'var(--color-surface2)', borderRadius: 'var(--radius-md)', padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', marginBottom: '4px' }}>Gold Exposure</div>
              <div style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: 'var(--color-text)' }}>
                ${totalGoldBacked.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>
                {totalValue > 0 ? ((totalGoldBacked / totalValue) * 100).toFixed(1) : 0}% of portfolio
              </div>
            </div>
            <div style={{ background: 'var(--color-surface2)', borderRadius: 'var(--radius-md)', padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', marginBottom: '4px' }}>Gold Equiv. (oz)</div>
              <div style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: 'var(--color-cyan)' }}>
                {totalGoldEquiv.toFixed(4)} oz
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>
                ≈ {(totalGoldEquiv * 31.1035).toFixed(2)}g
              </div>
            </div>
            <div style={{ background: 'var(--color-surface2)', borderRadius: 'var(--radius-md)', padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', marginBottom: '4px' }}>Spot Gold Price</div>
              <div style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: 'var(--color-gold)' }}>
                ${spotPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: goldSpot?.change24h && goldSpot.change24h >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                {goldSpot?.change24h !== undefined
                  ? `${goldSpot.change24h >= 0 ? '▲ +' : '▼ '}${Math.abs(goldSpot.change24h).toFixed(2)}%`
                  : '—'}
              </div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table
              className="table-zebra"
              style={{ width: '100%', borderCollapse: 'collapse' }}
              aria-label="Portfolio holdings vs spot gold comparison"
            >
              <thead>
                <tr>
                  {PORTFOLIO_COLUMNS.map((col) => (
                    <th key={col.label} style={{
                      padding: '10px 12px',
                      fontSize: 'var(--font-xs)',
                      color: 'var(--color-muted)',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      borderBottom: '1px solid var(--color-border)',
                      textAlign: col.align,
                      whiteSpace: 'nowrap',
                    }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {portfolioData.map((entry) => (
                  <tr key={entry.id}>
                    <td style={{ padding: '10px 12px', fontSize: 'var(--font-sm)', color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 700, color: 'var(--color-gold)' }}>{entry.symbol}</span>
                      <span style={{ marginLeft: '6px', fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>{entry.name}</span>
                      {entry.source === 'coinbase' && (
                        <span className="badge badge-accent" style={{ marginLeft: '6px', fontSize: 'var(--font-xxs)' }}>CB</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 'var(--font-sm)', color: 'var(--color-text)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {entry.amount.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 'var(--font-xs)', color: 'var(--color-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      ${entry.buyPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--color-text)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      ${entry.currentPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--color-text)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      ${entry.currentValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span className={entry.pnl >= 0 ? 'change-chip-green' : 'change-chip-red'}>
                        {entry.pnl >= 0 ? '+' : ''}${entry.pnl.toFixed(2)}
                        {' '}({entry.pnlPct >= 0 ? '+' : ''}{entry.pnlPct.toFixed(2)}%)
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 'var(--font-xs)', color: 'var(--color-cyan)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {entry.goldEquivOz.toFixed(4)} oz
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ padding: '10px 12px', fontSize: 'var(--font-xs)', color: 'var(--color-muted)', fontWeight: 600, borderTop: '1px solid var(--color-border)' }}>
                    Total
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--color-gold)', textAlign: 'right', borderTop: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                    ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <span className={totalPnl >= 0 ? 'change-chip-green' : 'change-chip-red'}>
                      {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
                      {' '}({totalPct >= 0 ? '+' : ''}{totalPct.toFixed(2)}%)
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 'var(--font-xs)', color: 'var(--color-cyan)', textAlign: 'right', fontWeight: 700, borderTop: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                    {totalGoldEquiv.toFixed(4)} oz
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div style={{
            marginTop: '16px',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-accent-dim)',
            border: '1px solid rgba(124,92,252,0.2)',
            fontSize: 'var(--font-xs)',
            color: 'var(--color-muted)',
          }}>
            💡 <strong style={{ color: 'var(--color-text)' }}>Portfolio vs Spot Gold:</strong>
            {' '}Your portfolio is worth{' '}
            <strong style={{ color: 'var(--color-gold)' }}>
              {totalGoldEquiv.toFixed(4)} troy oz
            </strong>
            {' '}of gold at current spot price.
            {totalGoldBacked > 0 && (
              <span>
                {' '}
                <strong style={{ color: 'var(--color-green)' }}>
                  {((totalGoldBacked / totalValue) * 100).toFixed(1)}%
                </strong>
                {' '}of your portfolio is gold-backed (PAXG/XAUT/XAU).
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
