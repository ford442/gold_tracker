import { create } from 'zustand';
import type { PriceData, GoldSpot, MetalSpot } from '@/types';

interface PriceStore {
  prices: Record<string, PriceData>;
  goldSpot: GoldSpot | null;
  otherMetals: MetalSpot[];
  lastUpdated: number | null;
  isLoading: boolean;
  error: string | null;
  isMockData: boolean;
  /** True when current prices were restored from localStorage snapshot. */
  isFromCache: boolean;
  /** Timestamp of the snapshot used when isFromCache is true. */
  snapshotSavedAt: number | null;
  setPrices: (prices: Record<string, PriceData>) => void;
  setGoldSpot: (spot: GoldSpot) => void;
  setOtherMetals: (metals: MetalSpot[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setIsMockData: (isMock: boolean) => void;
  hydrateFromSnapshot: (payload: {
    prices: Record<string, PriceData>;
    goldSpot: GoldSpot | null;
    otherMetals: MetalSpot[];
    savedAt: number;
    isMockData: boolean;
  }) => void;
}

export const usePriceStore = create<PriceStore>((set) => ({
  prices: {},
  goldSpot: null,
  otherMetals: [],
  lastUpdated: null,
  isLoading: false,
  error: null,
  isMockData: false,
  isFromCache: false,
  snapshotSavedAt: null,
  setPrices: (prices) => set({
    prices,
    lastUpdated: Date.now(),
    isLoading: false,
    isFromCache: false,
    snapshotSavedAt: null,
  }),
  setGoldSpot: (goldSpot) => set({ goldSpot }),
  setOtherMetals: (otherMetals) => set({ otherMetals }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  setIsMockData: (isMockData) => set({ isMockData }),
  hydrateFromSnapshot: (payload) => set({
    prices: payload.prices,
    goldSpot: payload.goldSpot,
    otherMetals: payload.otherMetals,
    lastUpdated: payload.savedAt,
    snapshotSavedAt: payload.savedAt,
    isFromCache: true,
    isMockData: payload.isMockData,
    isLoading: false,
  }),
}));
