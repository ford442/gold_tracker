import { useState, useEffect, useCallback } from 'react';
import { usePortfolioStore } from '@/store/portfolioStore';
import { usePriceStore } from '@/store/priceStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useCoinbaseBalances } from '@/hooks/useCoinbaseBalances';
import { ASSETS, fromSymbol, isGoldSleeve, resolvePortfolioAssetId } from '@lib/assets';
import { PnLOverTimeChart } from './PnLOverTimeChart';
import { PortfolioHeader } from '@components/portfolio/PortfolioHeader';
import { PortfolioEntryForm } from '@components/portfolio/PortfolioEntryForm';
import { PortfolioSummary } from '@components/portfolio/PortfolioSummary';
import { PortfolioEmptyState } from '@components/portfolio/PortfolioEmptyState';
import { PortfolioHoldingsTable } from '@components/portfolio/PortfolioHoldingsTable';
import {
  DEFAULT_FORM,
  DEMO_POSITION,
  getCurrentPrice,
  type PortfolioFormState,
} from '@components/portfolio/portfolioUtils';

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

  const [form, setForm] = useState<PortfolioFormState>(DEFAULT_FORM);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const getPriceForAssetId = useCallback(
    (assetId: string) => getCurrentPrice(assetId, prices, goldPrice),
    [prices, goldPrice],
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
    const asset = ASSETS[form.assetId as keyof typeof ASSETS];
    if (!asset) return;

    if (editingId) {
      updateEntry(editingId, { symbol: asset.symbol, name: asset.name, amount, buyPrice });
      setEditingId(null);
    } else {
      addEntry({ symbol: asset.symbol, name: asset.name, amount, buyPrice, source: 'manual' });
    }
    setForm(DEFAULT_FORM);
    setShowForm(false);
  };

  const handleEdit = (entry: (typeof entries)[0]) => {
    const asset = fromSymbol(entry.symbol);
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
    setForm(DEFAULT_FORM);
  };

  const handleAddDemo = () => {
    addEntry({ ...DEMO_POSITION, source: 'manual' });
    setShowDemo(true);
  };

  const totalValue = entries.reduce((sum, e) => {
    const assetId = resolvePortfolioAssetId(e.symbol);
    const cur = getCurrentPrice(assetId, prices, goldPrice);
    return sum + e.amount * cur;
  }, 0);

  const totalCost = entries.reduce((sum, e) => sum + e.amount * e.buyPrice, 0);
  const totalPnL = totalValue - totalCost;
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  const goldValue = entries.reduce((sum, e) => {
    const assetId = resolvePortfolioAssetId(e.symbol);
    if (!isGoldSleeve(assetId)) return sum;
    const cur = getCurrentPrice(assetId, prices, goldPrice);
    return sum + e.amount * cur;
  }, 0);
  const goldPct = totalValue > 0 ? (goldValue / totalValue) * 100 : 0;
  const cryptoPct = 100 - goldPct;

  return (
    <section aria-label="Portfolio Tracker" style={{ marginBottom: 'var(--space-2xl)' }}>
      <PortfolioHeader
        hasCdpKeys={hasCdpKeys}
        coinbaseSyncEnabled={coinbaseSyncEnabled}
        cbLoading={cbLoading}
        cbError={cbError}
        lastSynced={lastSynced}
        showForm={showForm}
        onSyncClick={coinbaseSyncEnabled ? syncNow : () => setCoinbaseSyncEnabled(true)}
        onToggleForm={showForm ? handleCancelForm : () => setShowForm(true)}
      />

      <PnLOverTimeChart />

      {showForm && (
        <PortfolioEntryForm
          form={form}
          editingId={editingId}
          onFormChange={setForm}
          onSubmit={handleAdd}
        />
      )}

      {entries.length > 0 && (
        <PortfolioSummary
          totalValue={totalValue}
          totalPnL={totalPnL}
          totalPnLPct={totalPnLPct}
          goldPct={goldPct}
          cryptoPct={cryptoPct}
        />
      )}

      {entries.length === 0 ? (
        <PortfolioEmptyState
          hasCdpKeys={hasCdpKeys}
          onAddPosition={() => setShowForm(true)}
          onEnableCoinbaseSync={() => setCoinbaseSyncEnabled(true)}
          onAddDemo={handleAddDemo}
        />
      ) : (
        <PortfolioHoldingsTable
          entries={entries}
          prices={prices}
          goldPrice={goldPrice}
          onEdit={handleEdit}
          onRemove={removeEntry}
        />
      )}
    </section>
  );
}
