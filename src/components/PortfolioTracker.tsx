import { useState } from 'react';
import { usePortfolioStore } from '../store/portfolioStore';
import { usePriceStore } from '../store/priceStore';
import { formatPrice, formatPercent, formatNumber } from '../lib/utils';
import { PnLOverTimeChart } from './PnLOverTimeChart';

const AVAILABLE_ASSETS = [
  { id: 'gold', symbol: 'XAU', name: 'Spot Gold' },
  { id: 'pax-gold', symbol: 'PAXG', name: 'PAX Gold' },
  { id: 'tether-gold', symbol: 'XAUT', name: 'Tether Gold' },
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
];

function getCurrentPrice(id: string, prices: Record<string, { price: number }>, goldPrice: number | null): number {
  if (id === 'gold') return goldPrice ?? 0;
  return prices[id]?.price ?? 0;
}

export function PortfolioTracker() {
  const { entries, addEntry, removeEntry } = usePortfolioStore();
  const { prices, goldSpot } = usePriceStore();
  const goldPrice = goldSpot?.price ?? null;

  const [form, setForm] = useState({ assetId: 'pax-gold', amount: '', buyPrice: '' });
  const [showForm, setShowForm] = useState(false);

  const handleAdd = () => {
    const amount = parseFloat(form.amount);
    const buyPrice = parseFloat(form.buyPrice);
    if (isNaN(amount) || amount <= 0 || isNaN(buyPrice) || buyPrice <= 0) return;
    const asset = AVAILABLE_ASSETS.find((a) => a.id === form.assetId);
    if (!asset) return;
    addEntry({ symbol: asset.symbol, name: asset.name, amount, buyPrice });
    setForm({ assetId: 'pax-gold', amount: '', buyPrice: '' });
    setShowForm(false);
  };

  const totalValue = entries.reduce((sum, e) => {
    const assetId = e.symbol === 'XAU' ? 'gold' : (AVAILABLE_ASSETS.find(a => a.symbol === e.symbol)?.id ?? '');
    const cur = getCurrentPrice(assetId, prices, goldPrice);
    return sum + e.amount * cur;
  }, 0);

  const totalCost = entries.reduce((sum, e) => sum + e.amount * e.buyPrice, 0);
  const totalPnL = totalValue - totalCost;
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  const goldStableIds = ['gold', 'pax-gold', 'tether-gold'];
  const goldValue = entries.reduce((sum, e) => {
    const assetId = e.symbol === 'XAU' ? 'gold' : (AVAILABLE_ASSETS.find(a => a.symbol === e.symbol)?.id ?? '');
    if (!goldStableIds.includes(assetId)) return sum;
    const cur = getCurrentPrice(assetId, prices, goldPrice);
    return sum + e.amount * cur;
  }, 0);
  const goldPct = totalValue > 0 ? (goldValue / totalValue) * 100 : 0;
  const cryptoPct = 100 - goldPct;

  return (
    <section aria-label="Portfolio Tracker">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--font-lg)', color: 'var(--color-text)' }}>
          💼 Portfolio Tracker
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          aria-label={showForm ? 'Cancel adding position' : 'Add new position'}
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: 'var(--color-accent)',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 'var(--font-sm)',
            fontWeight: 600,
            minHeight: '44px',
            minWidth: '44px',
          }}
        >
          {showForm ? '✕ Cancel' : '+ Add Position'}
        </button>
      </div>

      {/* PnL Over Time Chart - only when positions exist */}
      <PnLOverTimeChart />

      {/* Add Position Form */}
      {showForm && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px',
          marginBottom: 'var(--space-md)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '10px',
          alignItems: 'end',
        }}>
          <div>
            <label style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', display: 'block', marginBottom: '4px' }}>Asset</label>
            <select
              value={form.assetId}
              onChange={(e) => setForm({ ...form, assetId: e.target.value })}
              aria-label="Select asset"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface2)',
                color: 'var(--color-text)',
                fontSize: 'var(--font-base)',
                minHeight: '44px',
              }}
            >
              {AVAILABLE_ASSETS.map((a) => (
                <option key={a.id} value={a.id}>{a.symbol} — {a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', display: 'block', marginBottom: '4px' }}>Amount</label>
            <input
              type="number"
              min="0"
              step="any"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="e.g. 2.5"
              aria-label="Amount"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface2)',
                color: 'var(--color-text)',
                fontSize: 'var(--font-base)',
                minHeight: '44px',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)', display: 'block', marginBottom: '4px' }}>Buy Price (USD)</label>
            <input
              type="number"
              min="0"
              step="any"
              value={form.buyPrice}
              onChange={(e) => setForm({ ...form, buyPrice: e.target.value })}
              placeholder="e.g. 3200"
              aria-label="Buy price in USD"
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface2)',
                color: 'var(--color-text)',
                fontSize: 'var(--font-base)',
                minHeight: '44px',
              }}
            />
          </div>
          <button
            onClick={handleAdd}
            aria-label="Add position"
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'var(--color-green)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 'var(--font-base)',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              minHeight: '44px',
            }}
          >
            Add
          </button>
        </div>
      )}

      {/* Summary bar */}
      {entries.length > 0 && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '14px 16px',
          marginBottom: 'var(--space-md)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '12px',
        }}>
          <div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>Total Value</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text)' }}>{formatNumber(totalValue)}</div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>Unrealized P&amp;L</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: totalPnL >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
              {totalPnL >= 0 ? '↑ +' : '↓ '}{formatNumber(totalPnL)} ({formatPercent(totalPnLPct)})
            </div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>Gold Exposure</div>
            <div style={{ fontWeight: 700, color: 'var(--color-gold)' }}>{goldPct.toFixed(1)}%</div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>Crypto Beta</div>
            <div style={{ fontWeight: 700, color: 'var(--color-blue)' }}>{cryptoPct.toFixed(1)}%</div>
          </div>
        </div>
      )}

      {/* Position rows */}
      {entries.length === 0 ? (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-xl)',
          textAlign: 'center',
          color: 'var(--color-muted)',
          fontSize: 'var(--font-base)',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>💼</div>
          No positions yet — click &quot;+ Add Position&quot; to track your holdings
        </div>
      ) : (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <table className="table-zebra" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                {['Asset', 'Amount', 'Buy Price', 'Current', 'Value', 'P&L', ''].map((h) => (
                  <th key={h} style={{
                    padding: '12px',
                    fontSize: 'var(--font-xs)',
                    color: 'var(--color-muted)',
                    textAlign: h === 'Amount' || h === 'Buy Price' || h === 'Current' || h === 'Value' || h === 'P&L' ? 'right' : h === '' ? 'center' : 'left',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const assetId = entry.symbol === 'XAU' ? 'gold' : (AVAILABLE_ASSETS.find(a => a.symbol === entry.symbol)?.id ?? '');
                const curPrice = getCurrentPrice(assetId, prices, goldPrice);
                const value = entry.amount * curPrice;
                const cost = entry.amount * entry.buyPrice;
                const pnl = value - cost;
                const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
                return (
                  <tr key={entry.id} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.15s' }}>
                    <td style={{ padding: '12px', fontSize: 'var(--font-base)', fontWeight: 600, color: 'var(--color-text)' }}>
                      {entry.symbol}
                      <span style={{ display: 'block', fontSize: 'var(--font-xs)', color: 'var(--color-muted)', fontWeight: 400 }}>{entry.name}</span>
                    </td>
                    <td style={{ padding: '12px', fontSize: 'var(--font-base)', color: 'var(--color-text)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{entry.amount}</td>
                    <td style={{ padding: '12px', fontSize: 'var(--font-base)', color: 'var(--color-muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatPrice(entry.buyPrice)}</td>
                    <td style={{ padding: '12px', fontSize: 'var(--font-base)', color: 'var(--color-text)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{curPrice > 0 ? formatPrice(curPrice) : '—'}</td>
                    <td style={{ padding: '12px', fontSize: 'var(--font-base)', fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{curPrice > 0 ? formatNumber(value) : '—'}</td>
                    <td style={{ padding: '12px', fontSize: 'var(--font-base)', fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: pnl >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                      {curPrice > 0 ? (
                        <span>
                          {pnl >= 0 ? '↑ +' : '↓ '}{formatNumber(pnl)}
                          <span style={{ display: 'block', fontSize: 'var(--font-xs)' }}>({formatPercent(pnlPct)})</span>
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <button
                        onClick={() => removeEntry(entry.id)}
                        aria-label={`Remove ${entry.symbol} position`}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--color-red)', fontSize: '1rem',
                          minWidth: '44px', minHeight: '44px',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
