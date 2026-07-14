import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CostBasisMethod, PortfolioEntry, RealizedGainEvent } from '@/types';
import { COINBASE_CURRENCY_TO_ASSET_ID, fromCoinbaseCode } from '@lib/assets';
import type { CoinbaseAccount } from '@lib/coinbase';
import {
  appendAcquisitionLot,
  buildEntryWithLot,
  ensureEntryLots,
  migratePortfolioEntries,
  replaceWithSingleLot,
  sellFromEntry,
} from '@lib/portfolioLots';

interface PortfolioStore {
  entries: PortfolioEntry[];
  realizedGains: RealizedGainEvent[];
  costBasisMethod: CostBasisMethod;
  setCostBasisMethod: (method: CostBasisMethod) => void;
  addEntry: (entry: Omit<PortfolioEntry, 'id' | 'lots'>) => void;
  updateEntry: (id: string, updates: Partial<Pick<PortfolioEntry, 'symbol' | 'name' | 'amount' | 'buyPrice'>>) => void;
  removeEntry: (id: string) => void;
  sellUnits: (
    entryId: string,
    units: number,
    salePricePerUnit: number,
    specLotIds?: string[],
    note?: string,
  ) => { ok: true } | { ok: false; error: string };
  /**
   * Upsert entries from Coinbase accounts.
   * - Existing Coinbase-sourced entries are updated (amount refreshed, buyPrice kept).
   * - New Coinbase assets are added with `currentPrice` as buyPrice.
   * - Coinbase-sourced entries whose balance is now zero are removed.
   * - Manually-added entries are never touched.
   */
  syncCoinbaseBalances: (
    accounts: CoinbaseAccount[],
    getPriceForAssetId: (assetId: string) => number,
  ) => void;
}

export const usePortfolioStore = create<PortfolioStore>()(
  persist(
    (set, get) => ({
      entries: [],
      realizedGains: [],
      costBasisMethod: 'FIFO',

      setCostBasisMethod: (method) => set({ costBasisMethod: method }),

      addEntry: (entry) =>
        set((state) => {
          const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const withLot = buildEntryWithLot({ ...entry, id });
          return { entries: [...state.entries, withLot] };
        }),

      updateEntry: (id, updates) =>
        set((state) => ({
          entries: state.entries.map((e) => {
            if (e.id !== id) return e;
            const merged = { ...e, ...updates };
            if (updates.amount !== undefined || updates.buyPrice !== undefined) {
              const amount = updates.amount ?? e.amount;
              const buyPrice = updates.buyPrice ?? e.buyPrice;
              return replaceWithSingleLot(merged, amount, buyPrice);
            }
            return merged;
          }),
        })),

      removeEntry: (id) =>
        set((state) => ({ entries: state.entries.filter((e) => e.id !== id) })),

      sellUnits: (entryId, units, salePricePerUnit, specLotIds, note) => {
        const state = get();
        const entry = state.entries.find((e) => e.id === entryId);
        if (!entry) return { ok: false, error: 'Position not found' };

        const sold = sellFromEntry(ensureEntryLots(entry), {
          unitsToSell: units,
          salePricePerUnit,
          method: state.costBasisMethod,
          specLotIds,
          note,
        });
        if (!sold.ok) return sold;

        const { entry: updatedEntry, event } = sold.result;
        set({
          entries: state.entries
            .map((e) => (e.id === entryId ? updatedEntry : e))
            .filter((e) => e.amount > 1e-10),
          realizedGains: [...state.realizedGains, event],
        });
        return { ok: true };
      },

      syncCoinbaseBalances: (accounts, getPriceForAssetId) =>
        set((state) => {
          const incoming = new Map<string, number>();
          for (const acct of accounts) {
            const code = acct.currency.code;
            if (!COINBASE_CURRENCY_TO_ASSET_ID[code]) continue;
            const amount = parseFloat(acct.balance.amount);
            if (amount > 0) {
              incoming.set(code, (incoming.get(code) ?? 0) + amount);
            }
          }

          const manual = state.entries.filter((e) => e.source !== 'coinbase');
          const existingCoinbase = state.entries
            .filter((e) => e.source === 'coinbase')
            .map((e) => ensureEntryLots(e));
          const coinbaseUpdated: PortfolioEntry[] = [];
          const newRealized: RealizedGainEvent[] = [];

          incoming.forEach((amount, code) => {
            const assetId = COINBASE_CURRENCY_TO_ASSET_ID[code];
            const name = fromCoinbaseCode(code)?.name ?? code;
            const existing = existingCoinbase.find((e) => e.symbol === code);
            const markPrice = getPriceForAssetId(assetId) || 1;

            if (existing) {
              const prevAmount = existing.amount;
              if (amount > prevAmount + 1e-10) {
                const delta = amount - prevAmount;
                coinbaseUpdated.push(
                  appendAcquisitionLot(existing, delta, markPrice),
                );
              } else if (amount < prevAmount - 1e-10) {
                const delta = prevAmount - amount;
                const sold = sellFromEntry(existing, {
                  unitsToSell: delta,
                  salePricePerUnit: markPrice,
                  method: state.costBasisMethod,
                  note: 'Coinbase balance decrease (auto-realized)',
                });
                if (sold.ok) {
                  coinbaseUpdated.push(sold.result.entry);
                  newRealized.push(sold.result.event);
                } else {
                  coinbaseUpdated.push({ ...existing, amount });
                }
              } else {
                coinbaseUpdated.push(existing);
              }
            } else {
              coinbaseUpdated.push(
                buildEntryWithLot({
                  id: `cb-${code}-${Date.now()}`,
                  symbol: code,
                  name,
                  amount,
                  buyPrice: markPrice,
                  source: 'coinbase',
                }),
              );
            }
          });

          return {
            entries: [...manual, ...coinbaseUpdated],
            realizedGains:
              newRealized.length > 0
                ? [...state.realizedGains, ...newRealized]
                : state.realizedGains,
          };
        }),
    }),
    {
      name: 'goldtrackr-portfolio',
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as {
          entries?: PortfolioEntry[];
          realizedGains?: RealizedGainEvent[];
          costBasisMethod?: CostBasisMethod;
        };
        if (version < 2) {
          return {
            ...state,
            entries: migratePortfolioEntries(state.entries ?? []),
            realizedGains: state.realizedGains ?? [],
            costBasisMethod: state.costBasisMethod ?? 'FIFO',
          };
        }
        return persisted;
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.entries = migratePortfolioEntries(state.entries);
        state.realizedGains = state.realizedGains ?? [];
        state.costBasisMethod = state.costBasisMethod ?? 'FIFO';
      },
    },
  ),
);
