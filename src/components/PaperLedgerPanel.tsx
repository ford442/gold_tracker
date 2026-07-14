import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { usePaperTradeStore } from '@/store/paperTradeStore';
import { usePriceStore } from '@/store/priceStore';
import {
  paperEquityCurve,
  paperFillsToCsv,
  summarizePaperLedger,
} from '@lib/paperTrade';
import { formatPrice } from '@lib/utils';

function pnlColor(v: number): string {
  return v >= 0 ? 'var(--color-green)' : 'var(--color-red)';
}

export function PaperLedgerPanel() {
  const { fills, resetPaper } = usePaperTradeStore();
  const { prices, goldSpot } = usePriceStore();
  const [confirmingReset, setConfirmingReset] = useState(false);

  const currentPrices = useMemo(() => {
    const map: Record<string, number> = {};
    for (const [id, p] of Object.entries(prices)) map[id] = p.price;
    if (goldSpot) map.gold = goldSpot.price;
    return map;
  }, [prices, goldSpot]);

  const summary = useMemo(
    () => summarizePaperLedger(fills, currentPrices),
    [fills, currentPrices],
  );
  const equity = useMemo(() => paperEquityCurve(fills), [fills]);

  const handleExport = () => {
    const csv = paperFillsToCsv(fills);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `goldtrackr-paper-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    resetPaper();
    setConfirmingReset(false);
  };

  const totalPnl = summary.realizedPnl + summary.unrealizedPnl;

  return (
    <section className="glass-card" aria-label="Paper trading ledger" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: 'var(--font-base)', fontWeight: 700, color: 'var(--color-text)' }}>
          🧪 Paper Trade Ledger
          <span
            title="Simulated fills only. No live orders, no funds moved."
            style={{
              fontSize: 'var(--font-xxs)',
              padding: '3px 9px',
              borderRadius: '999px',
              background: 'var(--color-accent-dim)',
              color: 'var(--color-accent)',
              fontWeight: 700,
              letterSpacing: '0.06em',
            }}
          >
            PAPER · SIMULATED
          </span>
        </h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={handleExport}
            disabled={fills.length === 0}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: fills.length === 0 ? 'var(--color-muted)' : 'var(--color-text)',
              fontSize: 'var(--font-xs)',
              fontWeight: 600,
              cursor: fills.length === 0 ? 'not-allowed' : 'pointer',
              opacity: fills.length === 0 ? 0.5 : 1,
            }}
          >
            ⬇ Export CSV
          </button>
          <button
            onClick={handleReset}
            onBlur={() => setConfirmingReset(false)}
            disabled={fills.length === 0}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${confirmingReset ? 'var(--color-red)' : 'var(--color-border)'}`,
              background: confirmingReset ? 'var(--color-red-dim)' : 'transparent',
              color: confirmingReset ? 'var(--color-red)' : 'var(--color-muted)',
              fontSize: 'var(--font-xs)',
              fontWeight: 600,
              cursor: fills.length === 0 ? 'not-allowed' : 'pointer',
              opacity: fills.length === 0 ? 0.5 : 1,
            }}
          >
            {confirmingReset ? 'Click to confirm reset' : '↺ Reset paper portfolio'}
          </button>
        </div>
      </div>

      {fills.length === 0 ? (
        <p style={{ margin: 0, fontSize: 'var(--font-sm)', color: 'var(--color-muted)', lineHeight: 1.6 }}>
          No paper fills yet. With <strong>🧪 PAPER</strong> mode on (Settings → dry run), execute a
          suggested trade to practice arbitrage &amp; rebalancing here — no exchange keys required.
          Simulated fills are logged with estimated fees so you can build a learning P&amp;L curve.
        </p>
      ) : (
        <>
          {/* Summary stat row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginBottom: '16px' }}>
            <StatBox label="Net P&L" value={formatPrice(totalPnl)} color={pnlColor(totalPnl)} />
            <StatBox label="Realized" value={formatPrice(summary.realizedPnl)} color={pnlColor(summary.realizedPnl)} />
            <StatBox label="Unrealized" value={formatPrice(summary.unrealizedPnl)} color={pnlColor(summary.unrealizedPnl)} />
            <StatBox label="Est. Fees" value={formatPrice(summary.totalFees)} color="var(--color-muted)" />
            <StatBox label="Fills" value={String(summary.fillCount)} color="var(--color-text)" />
          </div>

          {/* Realized P&L learning curve */}
          {equity.length > 1 && (
            <div style={{ width: '100%', height: 160, marginBottom: '16px' }} role="img" aria-label="Cumulative paper realized profit and loss curve">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={equity} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(80,86,140,0.15)" vertical={false} />
                  <XAxis dataKey="t" tick={false} stroke="var(--color-muted)" height={4} />
                  <YAxis
                    stroke="var(--color-muted)"
                    tick={{ fill: 'var(--color-muted)', fontSize: 10 }}
                    tickFormatter={(v) => `$${v}`}
                    width={55}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(16,19,35,0.92)',
                      border: '1px solid rgba(212,175,55,0.18)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--color-text)',
                      fontSize: '0.75rem',
                    }}
                    labelFormatter={(t) => new Date(t as string).toLocaleString()}
                    formatter={(value?: number) => [`$${(value ?? 0).toFixed(2)}`, 'Cumulative realized P&L']}
                  />
                  <ReferenceLine y={0} stroke="var(--color-muted)" strokeDasharray="4 4" strokeOpacity={0.5} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={pnlColor(equity[equity.length - 1]?.value ?? 0)}
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Open paper positions */}
          {summary.positions.some((p) => p.units !== 0) && (
            <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
              <table className="table-zebra" style={{ width: '100%', fontSize: 'var(--font-xs)', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Asset</Th><Th align="right">Units</Th><Th align="right">Avg Cost</Th>
                    <Th align="right">Realized</Th><Th align="right">Fees</Th>
                  </tr>
                </thead>
                <tbody>
                  {summary.positions.filter((p) => p.units !== 0 || p.realizedPnl !== 0).map((p) => (
                    <tr key={p.assetId}>
                      <Td>{p.symbol}</Td>
                      <Td align="right">{p.units.toFixed(4)}</Td>
                      <Td align="right">{p.avgCost > 0 ? formatPrice(p.avgCost) : '—'}</Td>
                      <Td align="right" style={{ color: pnlColor(p.realizedPnl) }}>{formatPrice(p.realizedPnl)}</Td>
                      <Td align="right" style={{ color: 'var(--color-muted)' }}>{formatPrice(p.fees)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Fill history */}
          <div style={{ overflowX: 'auto' }}>
            <table className="table-zebra" style={{ width: '100%', fontSize: 'var(--font-xs)', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <Th>Time</Th><Th>Side</Th><Th>Asset</Th>
                  <Th align="right">Units</Th><Th align="right">Price</Th>
                  <Th align="right">Notional</Th><Th align="right">Est. Fee</Th>
                </tr>
              </thead>
              <tbody>
                {[...fills].sort((a, b) => b.timestamp - a.timestamp).slice(0, 50).map((f) => (
                  <tr key={f.id}>
                    <Td style={{ color: 'var(--color-muted)' }}>{new Date(f.timestamp).toLocaleTimeString()}</Td>
                    <Td style={{ color: f.side === 'BUY' ? 'var(--color-green)' : 'var(--color-red)', fontWeight: 700 }}>{f.side}</Td>
                    <Td>{f.symbol}</Td>
                    <Td align="right">{f.units}</Td>
                    <Td align="right">{formatPrice(f.price)}</Td>
                    <Td align="right">{formatPrice(f.notionalUsd)}</Td>
                    <Td align="right" style={{ color: 'var(--color-muted)' }}>{formatPrice(f.feeUsd)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ margin: '12px 0 0', fontSize: 'var(--font-xxs)', color: 'var(--color-muted)', lineHeight: 1.5 }}>
            Paper trades are simulated for practice and journaling only — <strong>not financial advice</strong> and
            not a tax record. Fees are estimated from exchange presets; real fills, slippage, and taxes will differ.
          </p>
        </>
      )}
    </section>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: 'var(--color-surface2)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
      <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 'var(--font-base)', fontWeight: 700, color, marginTop: '2px' }}>{value}</div>
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th style={{ textAlign: align, padding: '6px 8px', color: 'var(--color-muted)', fontWeight: 600, borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
      {children}
    </th>
  );
}

function Td({ children, align = 'left', style }: { children: React.ReactNode; align?: 'left' | 'right'; style?: React.CSSProperties }) {
  return (
    <td style={{ textAlign: align, padding: '6px 8px', color: 'var(--color-text)', whiteSpace: 'nowrap', ...style }}>
      {children}
    </td>
  );
}

export default PaperLedgerPanel;
