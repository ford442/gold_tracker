import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { usePortfolioStore } from '@/store/portfolioStore';
import { usePriceStore } from '@/store/priceStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useCoinbaseBalances } from '@/hooks/useCoinbaseBalances';
import { ASSETS, fromSymbol, resolvePortfolioAssetId } from '@lib/assets';
import { computePortfolioMetrics } from '@lib/riskEngine';
import { PnLOverTimeChart } from './PnLOverTimeChart';
import { PortfolioHeader } from '@components/portfolio/PortfolioHeader';
import { PortfolioEntryForm } from '@components/portfolio/PortfolioEntryForm';
import { PortfolioSummary } from '@components/portfolio/PortfolioSummary';
import { PortfolioEmptyState } from '@components/portfolio/PortfolioEmptyState';
import { PortfolioHoldingsTable } from '@components/portfolio/PortfolioHoldingsTable';
import { PortfolioGoldOzWidget } from '@components/portfolio/PortfolioGoldOzWidget';
import { PortfolioCostBasisPanel } from '@components/portfolio/PortfolioCostBasisPanel';
import { PortfolioSellForm } from '@components/portfolio/PortfolioSellForm';
import {
  DEFAULT_FORM,
  DEMO_POSITION,
  getCurrentPrice,
  type PortfolioFormState,
} from '@components/portfolio/portfolioUtils';
import type { PortfolioEntry } from '@/types';

export function PortfolioTracker() {
  const {
    entries,
    realizedGains,
    costBasisMethod,
    setCostBasisMethod,
    addEntry,
    updateEntry,
    removeEntry,
    sellUnits,
    syncCoinbaseBalances,
  } = usePortfolioStore();
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
  const [sellingEntry, setSellingEntry] = useState<PortfolioEntry | null>(null);

  const getPriceForAssetId = useCallback(
    (assetId: string) => getCurrentPrice(assetId, prices, goldPrice),
    [prices, goldPrice],
  );

  const getPriceForSymbol = useCallback(
    (symbol: string) => {
      const assetId = resolvePortfolioAssetId(symbol);
      return assetId ? getPriceForAssetId(assetId) : 0;
    },
    [getPriceForAssetId],
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
    setSellingEntry(null);
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

  const handleSell = (units: number, salePrice: number, specLotIds?: string[]) => {
    if (!sellingEntry) return;
    const result = sellUnits(sellingEntry.id, units, salePrice, specLotIds);
    if (result.ok) {
      toast.success(`Recorded sale of ${units} ${sellingEntry.symbol}`);
      setSellingEntry(null);
    } else {
      toast.error(result.error);
    }
  };

  const portfolioSnapshot = {
    holdings: entries.reduce<{ assetId: string; units: number }[]>((acc, e) => {
      const assetId = resolvePortfolioAssetId(e.symbol);
      if (assetId) acc.push({ assetId, units: e.amount });
      return acc;
    }, []),
    prices: Object.fromEntries(
      entries
        .map((e) => resolvePortfolioAssetId(e.symbol))
        .filter(Boolean)
        .map((id) => [id, getCurrentPrice(id, prices, goldPrice)]),
    ) as Record<string, number>,
  };
  for (const id of ['gold', 'pax-gold', 'tether-gold', 'bitcoin', 'ethereum'] as const) {
    if (!portfolioSnapshot.prices[id]) {
      portfolioSnapshot.prices[id] = getCurrentPrice(id, prices, goldPrice);
    }
  }

  const { totalValue, goldPct, cryptoPct } = (() => {
    const m = computePortfolioMetrics(portfolioSnapshot);
    return { totalValue: m.totalValueUsd, goldPct: m.goldPct, cryptoPct: m.cryptoPct };
  })();

  const totalCost = entries.reduce((sum, e) => sum + e.amount * e.buyPrice, 0);
  const totalPnL = totalValue - totalCost;
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  const sellingMark =
    sellingEntry != null ? getPriceForSymbol(sellingEntry.symbol) : 0;

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

      {sellingEntry && (
        <PortfolioSellForm
          entry={sellingEntry}
          method={costBasisMethod}
          defaultSalePrice={sellingMark}
          onCancel={() => setSellingEntry(null)}
          onSell={handleSell}
        />
      )}

      {entries.length > 0 && (
        <>
          <PortfolioGoldOzWidget entries={entries} />
          <PortfolioSummary
            totalValue={totalValue}
            totalPnL={totalPnL}
            totalPnLPct={totalPnLPct}
            goldPct={goldPct}
            cryptoPct={cryptoPct}
          />
          <PortfolioCostBasisPanel
            entries={entries}
            realizedGains={realizedGains}
            costBasisMethod={costBasisMethod}
            onMethodChange={setCostBasisMethod}
            getPrice={getPriceForSymbol}
          />
        </>
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
          onSell={(entry) => {
            setSellingEntry(entry);
            setShowForm(false);
            setEditingId(null);
          }}
        />
      )}
    </section>
  );
}
