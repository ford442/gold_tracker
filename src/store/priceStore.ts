import { create } from 'zustand';
import type { PriceData, GoldSpot, MetalSpot } from '../types';

interface PriceStore {
  prices: Record<string, PriceData>;
  goldSpot: GoldSpot | null;
  otherMetals: MetalSpot[];
  lastUpdated: number | null;
  isLoading: boolean;
  error: string | null;
  isMockData: boolean;
  setPrices: (prices: Record<string, PriceData>) => void;
  setGoldSpot: (spot: GoldSpot) => void;
  setOtherMetals: (metals: MetalSpot[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setIsMockData: (isMock: boolean) => void;
}

export const usePriceStore = create<PriceStore>((set) => ({
  prices: {},
  goldSpot: null,
  otherMetals: [],
  lastUpdated: null,
  isLoading: false,
  error: null,
  isMockData: false,
  setPrices: (prices) => set({ prices, lastUpdated: Date.now(), isLoading: false }),
  setGoldSpot: (goldSpot) => set({ goldSpot }),
  setOtherMetals: (otherMetals) => set({ otherMetals }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  setIsMockData: (isMockData) => set({ isMockData }),
}));
