import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PortfolioEntry } from '../types';
import { COINBASE_CURRENCY_TO_ASSET_ID, type CoinbaseAccount } from '../lib/coinbase';

// Reverse map: symbol → asset name for known assets
const ASSET_NAMES: Record<string, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  PAXG: 'PAX Gold',
  XAUT: 'Tether Gold',
  USDC: 'USD Coin',
  XAU: 'Spot Gold',
};

interface PortfolioStore {
  entries: PortfolioEntry[];
  addEntry: (entry: Omit<PortfolioEntry, 'id'>) => void;
  updateEntry: (id: string, updates: Partial<PortfolioEntry>) => void;
  removeEntry: (id: string) => void;
  /**
   * Upsert entries from Coinbase accounts.
   * - Existing Coinbase-sourced entries are updated (amount refreshed, buyPrice kept).
   * - New Coinbase assets are added with `currentPrice` as buyPrice.
   * - Coinbase-sourced entries whose balance is now zero are removed.
   * - Manually-added entries are never touched.
   */
  syncCoinbaseBalances: (
    accounts: CoinbaseAccount[],
    getPriceForAssetId: (assetId: string) => number
  ) => void;
}

export const usePortfolioStore = create<PortfolioStore>()(
  persist(
    (set) => ({
      entries: [],
      addEntry: (entry) =>
        set((state) => ({
          entries: [
            ...state.entries,
            { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` },
          ],
        })),
      updateEntry: (id, updates) =>
        set((state) => ({
          entries: state.entries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        })),
      removeEntry: (id) =>
        set((state) => ({ entries: state.entries.filter((e) => e.id !== id) })),

      syncCoinbaseBalances: (accounts, getPriceForAssetId) =>
        set((state) => {
          // Build a map of currency codes with non-zero balances that we support
          const incoming = new Map<string, number>(); // symbol → amount
          for (const acct of accounts) {
            const code = acct.currency.code;
            if (!COINBASE_CURRENCY_TO_ASSET_ID[code]) continue;
            const amount = parseFloat(acct.balance.amount);
            if (amount > 0) {
              incoming.set(code, (incoming.get(code) ?? 0) + amount);
            }
          }

          // Keep all manual entries unchanged
          const manual = state.entries.filter((e) => e.source !== 'coinbase');

          // Upsert Coinbase entries
          const existingCoinbase = state.entries.filter((e) => e.source === 'coinbase');
          const coinbaseUpdated: PortfolioEntry[] = [];

          incoming.forEach((amount, code) => {
            const assetId = COINBASE_CURRENCY_TO_ASSET_ID[code];
            const name = ASSET_NAMES[code] ?? code;
            const existing = existingCoinbase.find((e) => e.symbol === code);

            if (existing) {
              // Refresh amount, keep buy price
              coinbaseUpdated.push({ ...existing, amount });
            } else {
              // New asset — use current market price as buy price
              const buyPrice = getPriceForAssetId(assetId) || 1;
              coinbaseUpdated.push({
                id: `cb-${code}-${Date.now()}`,
                symbol: code,
                name,
                amount,
                buyPrice,
                source: 'coinbase',
              });
            }
          });

          return { entries: [...manual, ...coinbaseUpdated] };
        }),
    }),
    { name: 'goldtrackr-portfolio' }
  )
);
