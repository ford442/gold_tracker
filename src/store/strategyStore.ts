import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BacktestResult } from '../lib/strategyEngine';

// ─── Config shape slices ──────────────────────────────────────────────────────

export interface ArbStoreConfig {
  arbSpreadThreshold: number; // percent, e.g. 0.25
  arbTradeSize: number;       // USD per entry
  arbAsset1: string;          // CoinGecko ID
  arbAsset2: string;          // CoinGecko ID
}

export interface MRStoreConfig {
  mrAsset: string;
  mrWindowSize: number;    // SMA period (ticks)
  mrBuyThreshold: number;  // % below SMA
  mrSellThreshold: number; // % above SMA  (take-profit)
  mrStopLoss: number;      // % below entry (stop-loss)
  mrTradeSize: number;     // USD per entry
}

// ─── Full store interface ─────────────────────────────────────────────────────

interface StrategyState extends ArbStoreConfig, MRStoreConfig {
  strategyType: 'arbitrage' | 'mean-reversion';
  initialBalance: number;
  lastResult: BacktestResult | null;
  isRunning: boolean;

  // ── Actions ──────────────────────────────────────────────────────────────
  setStrategyType: (t: 'arbitrage' | 'mean-reversion') => void;
  setArbConfig: (c: Partial<ArbStoreConfig>) => void;
  setMrConfig: (c: Partial<MRStoreConfig>) => void;
  setInitialBalance: (b: number) => void;
  setLastResult: (r: BacktestResult | null) => void;
  setIsRunning: (v: boolean) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useStrategyStore = create<StrategyState>()(
  persist(
    (set) => ({
      // Strategy selection
      strategyType: 'arbitrage',

      // Arbitrage defaults
      arbSpreadThreshold: 0.25,
      arbTradeSize: 500,
      arbAsset1: 'pax-gold',
      arbAsset2: 'tether-gold',

      // Mean-reversion defaults
      mrAsset: 'bitcoin',
      mrWindowSize: 24,
      mrBuyThreshold: 2.0,
      mrSellThreshold: 1.5,
      mrStopLoss: 5.0,
      mrTradeSize: 1000,

      // Common
      initialBalance: 10000,
      lastResult: null,
      isRunning: false,

      // ── Actions ──────────────────────────────────────────────────────────
      setStrategyType: (t) => set({ strategyType: t }),
      setArbConfig: (c) => set((s) => ({ ...s, ...c })),
      setMrConfig: (c) => set((s) => ({ ...s, ...c })),
      setInitialBalance: (b) => set({ initialBalance: b }),
      setLastResult: (r) => set({ lastResult: r }),
      setIsRunning: (v) => set({ isRunning: v }),
    }),
    {
      name: 'goldtrackr-strategy',
      // isRunning is transient — always start as false after a page reload
      onRehydrateStorage: () => (state) => {
        if (state) state.isRunning = false;
      },
    }
  )
);
