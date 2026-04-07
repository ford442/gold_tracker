import { useState, useEffect, useCallback } from 'react';
import { usePortfolioStore } from '../store/portfolioStore';
import { usePriceStore } from '../store/priceStore';
import { useSettingsStore } from '../store/settingsStore';
import { useCoinbaseBalances } from '../hooks/useCoinbaseBalances';
import { formatPrice, formatPercent, formatNumber } from '../lib/utils';
import { PnLOverTimeChart } from './PnLOverTimeChart';

const AVAILABLE_ASSETS = [
  { id: 'gold', symbol: 'XAU', name: 'Spot Gold' },
  { id: 'pax-gold', symbol: 'PAXG', name: 'PAX Gold' },
  { id: 'tether-gold', symbol: 'XAUT', name: 'Tether Gold' },
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'usd-coin', symbol: 'USDC', name: 'USD Coin' },
];

// Demo position for preview
const DEMO_POSITION = {
  symbol: 'PAXG',
  name: 'PAX Gold',
  amount: 5,
  buyPrice: 3200,
};

function getCurrentPrice(id: string, prices: Record<string, { price: number }>, goldPrice: number | null): number {
  if (id === 'gold') return goldPrice ?? 0;
  if (id === 'usd-coin') return 1;
  return prices[id]?.price ?? 0;
}

export function PortfolioTracker() {
  const { entries, addEntry, updateEntry, removeEntry, syncCoinbaseBalances } = usePortfolioStore();
  const { prices, goldSpot } = usePriceStore();
  const { cdpKeyName, cdpPrivateKey } = useSettingsStore();
  const goldPrice = goldSpot?.price ?? null;

  const hasCdpKeys = Boolean(cdpKeyName && cdpPrivateKey);
  const [coinbaseSyncEnabled, setCoinbaseSyncEnabled] = useState(false);
  const [, setShowDemo] = useState(false);

  const { accounts, isLoading: cbLoading, error: cbError, syncNow, lastSynced } =
    useCoinbaseBalances(coinbaseSyncEnabled);

  const [form, setForm] = useState({ assetId: 'pax-gold', amount: '', buyPrice: '' });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const getPriceForAssetId = useCallback(
    (assetId: string) => getCurrentPrice(assetId, prices, goldPrice),
    [prices, goldPrice]
  );

  useEffect(() => {
    if (accounts.length > 0) {
      syncCoinbaseBalances(accounts, getPriceForAssetId);
    }
  }, [accounts, syncCoinbaseBalances, getPriceForAssetId]);

  const handleAdd = () => {
    const amount = parseFloat(form.amount);
    const buyPrice = parseFloat(form.buyPrice);
    if (isNaN(amount) || amount <= 0 || isNaN(buyPrice) || buyPrice <= 0) return;
    const asset = AVAILABLE_ASSETS.find((a) => a.id === form.assetId);
    if (!asset) return;

    if (editingId) {
      updateEntry(editingId, { symbol: asset.symbol, name: asset.name, amount, buyPrice });
      setEditingId(null);
    } else {
      addEntry({ symbol: asset.symbol, name: asset.name, amount, buyPrice, source: 'manual' });
    }
    setForm({ assetId: 'pax-gold', amount: '', buyPrice: '' });
    setShowForm(false);
  };

  const handleEdit = (entry: typeof entries[0]) => {
    const asset = AVAILABLE_ASSETS.find((a) => a.symbol === entry.symbol);
    setForm({
      assetId: asset?.id ?? 'pax-gold',
      amount: entry.amount.toString(),
      buyPrice: entry.buyPrice.toString(),
    });
    setEditingId(entry.id);
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ assetId: 'pax-gold', amount: '', buyPrice: '' });
  };

  const handleAddDemo = () => {
    addEntry({ ...DEMO_POSITION, source: 'manual' });
    setShowDemo(true);
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
    <section aria-label="Portfolio Tracker" style={{ marginBottom: 'var(--space-2xl)' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 'var(--space-lg)', 
        flexWrap: 'wrap', 
        gap: '12px' 
      }}>
        <h2 className="section-heading">
          <span className="heading-icon">💼</span> Portfolio Tracker
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Coinbase Sync Controls */}
          {hasCdpKeys && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {cbError && (
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-red)' }} title={cbError}>
                  ⚠ Sync failed
                </span>
              )}
              {lastSynced && !cbError && (
                <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-muted)' }}>
                  🔄 {new Date(lastSynced).toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={coinbaseSyncEnabled ? syncNow : () => setCoinbaseSyncEnabled(true)}
                disabled={cbLoading}
                aria-label={coinbaseSyncEnabled ? 'Refresh Coinbase balances' : 'Enable Coinbase sync'}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  background: coinbaseSyncEnabled ? 'var(--color-surface2)' : 'transparent',
                  color: 'var(--color-gold)',
                  cursor: cbLoading ? 'not-allowed' : 'pointer',
                  fontSize: 'var(--font-xs)',
                  fontWeight: 600,
                  opacity: cbLoading ? 0.6 : 1,
                }}
              >
                {cbLoading ? '⏳ Syncing…' : coinbaseSyncEnabled ? '↺ Coinbase' : '⬇ Sync Coinbase'}
              </button>
            </div>
          )}
          <button
            onClick={showForm ? handleCancelForm : () => setShowForm(true)}
            aria-label={showForm ? 'Cancel' : 'Add new position'}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'var(--color-accent)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 'var(--font-sm)',
              fontWeight: 600,
            }}
          >
            {showForm ? '✕ Cancel' : '+ Add Position'}
          </button>
        </div>
      </div>

      {/* PnL Over Time Chart - only when positions exist */}
      <PnLOverTimeChart />

      {/* Add/Edit Position Form */}
      {showForm && (
        <div style={{
          background: 'var(--color-surface)',
          border: `2px solid ${editingId ? 'var(--color-gold)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          marginBottom: 'var(--space-lg)',
        }}>
          {editingId && (
            <div style={{ 
              fontSize: 'var(--font-xs)', 
              color: 'var(--color-gold)', 
              marginBottom: '12px', 
              fontWeight: 600 
            }}>
              ✏️ Editing position
            </div>
          )}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '14px',
            alignItems: 'end',
          }}>
            <div>
              <label style={{ 
                fontSize: 'var(--font-xs)', 
                color: 'var(--color-muted)', 
                display: 'block', 
                marginBottom: '6px',
                fontWeight: 500
              }}>
                Asset
              </label>
              <select
                value={form.assetId}
                onChange={(e) => setForm({ ...form, assetId: e.target.value })}
                aria-label="Select asset"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface2)',
                  color: 'var(--color-text)',
                  fontSize: 'var(--font-base)',
                }}
              >
                {AVAILABLE_ASSETS.map((a) => (
                  <option key={a.id} value={a.id}>{a.symbol} — {a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ 
                fontSize: 'var(--font-xs)', 
                color: 'var(--color-muted)', 
                display: 'block', 
                marginBottom: '6px',
                fontWeight: 500
              }}>
                Amount
              </label>
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
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface2)',
                  color: 'var(--color-text)',
                  fontSize: 'var(--font-base)',
                }}
              />
            </div>
            <div>
              <label style={{ 
                fontSize: 'var(--font-xs)', 
                color: 'var(--color-muted)', 
                display: 'block', 
                marginBottom: '6px',
                fontWeight: 500
              }}>
                Buy Price (USD)
              </label>
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
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface2)',
                  color: 'var(--color-text)',
                  fontSize: 'var(--font-base)',
                }}
              />
            </div>
            <button
              onClick={handleAdd}
              aria-label={editingId ? 'Save changes' : 'Add position'}
              style={{
                padding: '10px 20px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: editingId ? 'var(--color-gold)' : 'var(--color-green)',
                color: editingId ? '#000' : '#fff',
                cursor: 'pointer',
                fontSize: 'var(--font-base)',
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              {editingId ? '💾 Save' : '➕ Add'}
            </button>
          </div>
        </div>
      )}

      {/* Summary bar */}
      {entries.length > 0 && (
        <div className="glass-card" style={{
          padding: '18px 20px',
          marginBottom: 'var(--space-lg)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '16px',
        }}>
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
            <div style={{ 
              fontSize: '1.2rem', 
              fontWeight: 700, 
              color: totalPnL >= 0 ? 'var(--color-green)' : 'var(--color-red)' 
            }}>
              {totalPnL >= 0 ? '↑ +' : '↓ '}{formatNumber(totalPnL)} ({formatPercent(totalPnLPct)})
            </div>
          </div>
          <div>
            <div 
              style={{ 
                fontSize: 'var(--font-xs)', 
                color: 'var(--color-muted)', 
                marginBottom: '4px',
                cursor: 'help'
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
                cursor: 'help'
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
      )}

      {/* Position rows or Enhanced Empty State */}
      {entries.length === 0 ? (
        <div style={{
          background: 'var(--color-surface)',
          border: '2px dashed var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          padding: '48px 32px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>💼</div>
          <h3 style={{ 
            margin: '0 0 8px 0',
            fontSize: 'var(--font-lg)', 
            fontWeight: 700, 
            color: 'var(--color-text)' 
          }}>
            No positions yet
          </h3>
          <p style={{ 
            fontSize: 'var(--font-sm)', 
            color: 'var(--color-muted)', 
            marginBottom: '20px',
            maxWidth: '400px',
            marginLeft: 'auto',
            marginRight: 'auto',
            lineHeight: 1.5
          }}>
            Track your gold and crypto holdings to monitor performance, 
            calculate unrealized P&L, and analyze your portfolio allocation.
          </p>
          
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            justifyContent: 'center', 
            flexWrap: 'wrap',
            marginBottom: '24px'
          }}>
            <button
              onClick={() => setShowForm(true)}
              style={{
                padding: '10px 20px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: 'var(--color-accent)',
                color: '#fff',
                fontSize: 'var(--font-sm)',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              ➕ Add Your First Position
            </button>
            {hasCdpKeys && (
              <button
                onClick={() => setCoinbaseSyncEnabled(true)}
                style={{
                  padding: '10px 20px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-gold)',
                  background: 'transparent',
                  color: 'var(--color-gold)',
                  fontSize: 'var(--font-sm)',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                ⬇ Import from Coinbase
              </button>
            )}
          </div>

          {/* Demo position option */}
          <div style={{
            padding: '16px',
            background: 'var(--color-surface2)',
            borderRadius: 'var(--radius-md)',
            maxWidth: '350px',
            margin: '0 auto'
          }}>
            <p style={{ 
              fontSize: 'var(--font-xs)', 
              color: 'var(--color-muted)', 
              margin: '0 0 10px 0' 
            }}>
              👋 New here? Try a demo position to see how it works:
            </p>
            <button
              onClick={handleAddDemo}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-muted)',
                fontSize: 'var(--font-xs)',
                cursor: 'pointer'
              }}
            >
              🎯 Add Demo Position (5 PAXG @ $3,200)
            </button>
          </div>
        </div>
      ) : (
        <div className="glass-card">
          <table className="table-zebra" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                {['Asset', 'Amount', 'Buy Price', 'Current', 'Value', 'P&L', ''].map((h) => (
                  <th key={h} style={{
                    padding: '14px 12px',
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
                const isCoinbase = entry.source === 'coinbase';
                return (
                  <tr key={entry.id} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.15s' }}>
                    <td style={{ padding: '14px 12px', fontSize: 'var(--font-base)', fontWeight: 600, color: 'var(--color-text)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {entry.symbol}
                        {isCoinbase && (
                          <span style={{
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: 'var(--color-gold)',
                            color: '#000',
                            letterSpacing: '0.04em',
                          }}>
                            CB
                          </span>
                        )}
                      </div>
                      <span style={{ display: 'block', fontSize: 'var(--font-xs)', color: 'var(--color-muted)', fontWeight: 400 }}>
                        {entry.name}
                      </span>
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: 'var(--font-base)', color: 'var(--color-text)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {entry.amount < 0.001
                        ? entry.amount.toFixed(8)
                        : entry.amount < 1
                        ? entry.amount.toFixed(4)
                        : entry.amount.toFixed(2)}
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: 'var(--font-base)', color: 'var(--color-muted)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {formatPrice(entry.buyPrice)}
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: 'var(--font-base)', color: 'var(--color-text)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {curPrice > 0 ? formatPrice(curPrice) : '—'}
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: 'var(--font-base)', fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {curPrice > 0 ? formatNumber(value) : '—'}
                    </td>
                    <td style={{ padding: '14px 12px', fontSize: 'var(--font-base)', fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: pnl >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                      {curPrice > 0 ? (
                        <span>
                          {pnl >= 0 ? '↑ +' : '↓ '}{formatNumber(pnl)}
                          <span style={{ display: 'block', fontSize: 'var(--font-xs)' }}>({formatPercent(pnlPct)})</span>
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '14px 12px', textAlign: 'center' }}>
                      {!isCoinbase && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          <button
                            onClick={() => handleEdit(entry)}
                            aria-label={`Edit ${entry.symbol} position`}
                            title="Edit position"
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--color-gold)', fontSize: '1.1rem',
                              padding: '6px',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => removeEntry(entry.id)}
                            aria-label={`Remove ${entry.symbol} position`}
                            title="Delete position"
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--color-red)', fontSize: '1.1rem',
                              padding: '6px',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
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
      )}
    </section>
  );
}
