import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  type CounterfactualPresetRange,
  getCounterfactualFeeBps,
} from '@lib/counterfactual';

export interface CounterfactualState {
  fromAsset: string;
  toAsset: string;
  fromAmount: number;
  selectedRange: CounterfactualPresetRange;
  customTimestamp: number | null;
  costPreset: 'none' | 'coinbase' | 'kraken' | 'custom';
  customFeeBps: number;
  isExpanded: boolean;

  // Actions
  setFromAsset: (asset: string) => void;
  setToAsset: (asset: string) => void;
  setFromAmount: (amount: number) => void;
  setSelectedRange: (range: CounterfactualPresetRange) => void;
  setCustomTimestamp: (ts: number | null) => void;
  setCostPreset: (preset: 'none' | 'coinbase' | 'kraken' | 'custom') => void;
  setCustomFeeBps: (bps: number) => void;
  setIsExpanded: (expanded: boolean) => void;
  flipAssets: () => void;
  loadPreset: (from: string, to: string, amount: number, range: CounterfactualPresetRange) => void;
  seedFromPortfolio: (assetId: string, amount: number) => void;
}

export const useCounterfactualStore = create<CounterfactualState>()(
  persist(
    (set, get) => ({
      fromAsset: 'bitcoin',
      toAsset: 'pax-gold',
      fromAmount: 0.25,
      selectedRange: '30d',
      customTimestamp: null,
      costPreset: 'coinbase',
      customFeeBps: getCounterfactualFeeBps('coinbase'),
      isExpanded: true,

      setFromAsset: (fromAsset) => set({ fromAsset }),
      setToAsset: (toAsset) => set({ toAsset }),
      setFromAmount: (fromAmount) => set({ fromAmount: Math.max(0, fromAmount) }),
      setSelectedRange: (selectedRange) => set({ selectedRange, customTimestamp: null }),
      setCustomTimestamp: (customTimestamp) => set({ customTimestamp }),
      setCostPreset: (costPreset) => {
        const bps = getCounterfactualFeeBps(costPreset, get().customFeeBps);
        set({ costPreset, customFeeBps: bps });
      },
      setCustomFeeBps: (customFeeBps) => set({ customFeeBps: Math.max(0, customFeeBps) }),
      setIsExpanded: (isExpanded) => set({ isExpanded }),

      flipAssets: () => {
        const { fromAsset, toAsset } = get();
        set({ fromAsset: toAsset, toAsset: fromAsset });
      },

      loadPreset: (from, to, amount, range) => {
        set({
          fromAsset: from,
          toAsset: to,
          fromAmount: amount,
          selectedRange: range,
          customTimestamp: null,
        });
      },

      seedFromPortfolio: (assetId, amount) => {
        const currentTo = get().toAsset;
        const newTo = assetId === currentTo ? (assetId === 'pax-gold' ? 'bitcoin' : 'pax-gold') : currentTo;
        set({
          fromAsset: assetId,
          toAsset: newTo,
          fromAmount: amount,
          customTimestamp: null,
        });
      },
    }),
    {
      name: 'goldtrackr-counterfactual',
    }
  )
);
