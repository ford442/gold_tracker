import { useMemo } from 'react';
import type { CostBasisMethod, PortfolioEntry, RealizedGainEvent } from '@/types';
import {
  portfolioToCsv,
  summarizeRealized,
  summarizeUnrealized,
} from '@lib/portfolioLots';
import { formatNumber } from '@lib/utils';

interface Props {
  entries: PortfolioEntry[];
  realizedGains: RealizedGainEvent[];
  costBasisMethod: CostBasisMethod;
  onMethodChange: (method: CostBasisMethod) => void;
  getPrice: (symbol: string) => number;
}

const METHODS: { id: CostBasisMethod; label: string; hint: string }[] = [
  { id: 'FIFO', label: 'FIFO', hint: 'First acquired lots sold first' },
  { id: 'HIFO', label: 'HIFO', hint: 'Highest cost lots sold first' },
  { id: 'SpecID', label: 'SpecID', hint: 'You pick lots at sale time' },
];

function pnlColor(v: number): string {
  return v >= 0 ? 'var(--color-green)' : 'var(--color-red)';
}

export function PortfolioCostBasisPanel({
  entries,
  realizedGains,
  costBasisMethod,
  onMethodChange,
  getPrice,
}: Props) {
  const unrealized = useMemo(
    () => summarizeUnrealized(entries, getPrice),
    [entries, getPrice],
  );
  const realized = useMemo(() => summarizeRealized(realizedGains), [realizedGains]);

  const handleExport = () => {
    const csv = portfolioToCsv(entries, realizedGains, getPrice);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `goldtrackr-portfolio-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (entries.length === 0 && realizedGains.length === 0) return null;

  return (
    <section
      className="glass-card"
      aria-label="Cost basis and realized gains"
      style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '14px',
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: 'var(--font-base)',
              fontWeight: 700,
              color: 'var(--color-text)',
            }}
          >
            Cost Basis &amp; Realized Gains
          </h3>
          <p style={{ margin: '6px 0 0', fontSize: 'var(--font-xs)', color: 'var(--color-muted)', maxWidth: '52ch' }}>
            Lot-level journaling for power users. Not tax software — verify cost basis with your CPA.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={entries.length === 0 && realizedGains.length === 0}
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            background: 'transparent',
            color: 'var(--color-text)',
            fontSize: 'var(--font-xs)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ⬇ Export CSV
        </button>
      </div>

      <div
        role="radiogroup"
        aria-label="Cost basis method"
        style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '18px' }}
      >
        {METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={costBasisMethod === m.id}
            title={m.hint}
            onClick={() => onMethodChange(m.id)}
            className={costBasisMethod === m.id ? 'range-pill active' : 'range-pill'}
            style={{
              padding: '6px 14px',
              fontSize: 'var(--font-xs)',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Unrealized */}
      <div style={{ marginBottom: '20px' }}>
        <h4
          style={{
            margin: '0 0 10px',
            fontSize: 'var(--font-sm)',
            fontWeight: 700,
            color: 'var(--color-text)',
          }}
        >
          Unrealized (open lots)
        </h4>
        {unrealized.lines.length === 0 ? (
          <p style={{ margin: 0, fontSize: 'var(--font-sm)', color: 'var(--color-muted)' }}>
            No open positions.
          </p>
        ) : (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '12px',
                marginBottom: '12px',
              }}
            >
              <Stat label="Cost basis" value={formatNumber(unrealized.totalCostBasisUsd)} />
              <Stat label="Market value" value={formatNumber(unrealized.totalMarketValueUsd)} />
              <Stat
                label="Unrealized P&L"
                value={formatNumber(unrealized.totalUnrealizedPnlUsd)}
                color={pnlColor(unrealized.totalUnrealizedPnlUsd)}
              />
            </div>
            <table className="table-zebra" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['Asset', 'Units', 'Cost basis', 'Market', 'Unrealized'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '8px 10px',
                        fontSize: 'var(--font-xxs)',
                        color: 'var(--color-muted)',
                        textAlign: h === 'Asset' ? 'left' : 'right',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {unrealized.lines.map((line) => (
                  <tr key={line.entryId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{line.symbol}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {line.units}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {formatNumber(line.costBasisUsd)}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {formatNumber(line.marketValueUsd)}
                    </td>
                    <td
                      style={{
                        padding: '8px 10px',
                        textAlign: 'right',
                        fontWeight: 600,
                        color: pnlColor(line.unrealizedPnlUsd),
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatNumber(line.unrealizedPnlUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Realized */}
      <div>
        <h4
          style={{
            margin: '0 0 10px',
            fontSize: 'var(--font-sm)',
            fontWeight: 700,
            color: 'var(--color-text)',
          }}
        >
          Realized gains journal
        </h4>
        {realized.events.length === 0 ? (
          <p style={{ margin: 0, fontSize: 'var(--font-sm)', color: 'var(--color-muted)' }}>
            No recorded sales yet. Use &quot;Sell&quot; on a holding to journal a disposal.
          </p>
        ) : (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '12px',
                marginBottom: '12px',
              }}
            >
              <Stat label="Proceeds" value={formatNumber(realized.totalProceedsUsd)} />
              <Stat label="Cost basis (sold)" value={formatNumber(realized.totalCostBasisUsd)} />
              <Stat
                label="Realized P&L"
                value={formatNumber(realized.totalRealizedPnlUsd)}
                color={pnlColor(realized.totalRealizedPnlUsd)}
              />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table-zebra" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {['Date', 'Asset', 'Units', 'Proceeds', 'Basis', 'Gain', 'Method'].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '8px 10px',
                          fontSize: 'var(--font-xxs)',
                          color: 'var(--color-muted)',
                          textAlign: h === 'Date' || h === 'Asset' || h === 'Method' ? 'left' : 'right',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...realized.events].reverse().map((ev) => (
                    <tr key={ev.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '8px 10px', fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>
                        {new Date(ev.timestamp).toLocaleString()}
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{ev.symbol}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {ev.unitsSold}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {formatNumber(ev.proceedsUsd)}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {formatNumber(ev.costBasisUsd)}
                      </td>
                      <td
                        style={{
                          padding: '8px 10px',
                          textAlign: 'right',
                          fontWeight: 600,
                          color: pnlColor(ev.realizedGainUsd),
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatNumber(ev.realizedGainUsd)}
                      </td>
                      <td style={{ padding: '8px 10px', fontSize: 'var(--font-xs)' }}>{ev.costBasisMethod}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div
        style={{
          marginTop: '16px',
          padding: '12px 14px',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--color-accent-dim)',
          border: '1px solid var(--color-border)',
          fontSize: 'var(--font-xxs)',
          color: 'var(--color-muted)',
          lineHeight: 1.55,
        }}
      >
        <strong style={{ color: 'var(--color-text)' }}>Not financial or tax advice.</strong>{' '}
        GoldTrackr is an educational portfolio tracker. Cost-basis methods (FIFO/HIFO/SpecID) are
        simplified models for journaling — not IRS/CRA filing logic. Wash sales, holding periods,
        and jurisdictional rules are not modeled. Export is for your records only; consult a
        qualified tax professional before filing.
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 'var(--font-xxs)', color: 'var(--color-muted)', marginBottom: '2px' }}>
        {label}
      </div>
      <div style={{ fontWeight: 700, fontSize: 'var(--font-sm)', color: color ?? 'var(--color-text)' }}>
        {value}
      </div>
    </div>
  );
}
