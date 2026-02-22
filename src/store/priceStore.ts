import { create } from 'zustand';
import type { PriceData, GoldSpot } from '../types';

interface PriceStore {
  prices: Record<string, PriceData>;
  goldSpot: GoldSpot | null;
  lastUpdated: number | null;
  isLoading: boolean;
  error: string | null;
  setPrices: (prices: Record<string, PriceData>) => void;
  setGoldSpot: (spot: GoldSpot) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const usePriceStore = create<PriceStore>((set) => ({
  prices: {},
  goldSpot: null,
  lastUpdated: null,
  isLoading: false,
  error: null,
  setPrices: (prices) => set({ prices, lastUpdated: Date.now(), isLoading: false }),
  setGoldSpot: (goldSpot) => set({ goldSpot }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
}));
