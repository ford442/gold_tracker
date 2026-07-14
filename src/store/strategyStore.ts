import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BacktestResult } from '@lib/strategyEngine';
import { DEFAULT_REGIME_GATE_CONFIG, type RegimeGateConfig } from '@lib/regime';

// ─── Config shape slices ──────────────────────────────────────────────────────

export interface ArbStoreConfig {
  arbSpreadThreshold: number; // percent, e.g. 0.25
  arbTradeSize: number;       // USD per entry
  arbAsset1: string;          // CoinGecko ID
  arbAsset2: string;          // CoinGecko ID
  /** Enable structural fidelity gate on arb entries in backtests. */
  arbRegimeGateEnabled: boolean;
  regimeGateConfig: RegimeGateConfig;
}

export interface MRStoreConfig {
  mrAsset: string;
  mrWindowSize: number;    // SMA period (ticks)
  mrBuyThreshold: number;  // % below SMA
  mrSellThreshold: number; // % above SMA  (take-profit)
  mrStopLoss: number;      // % below entry (stop-loss)
  mrTradeSize: number;     // USD per entry
}

// Scenario Lab (Feature 3) — persisted config for shocks, seeding, DCA
export interface ScenarioLabConfig {
  scenarioMode: 'classic' | 'lab';
  selectedScenario: string; // 'flight-to-gold' | 'crypto-meltup' | ... | 'custom'
  customShocks: Record<string, number>; // e.g. { 'gold': 1.12, bitcoin: 0.75, ... }
  seedFromPortfolio: boolean;
  extraCashUsd: number;
  dcaUsdPerPeriod: number;
  dcaPeriodCount: number;
  /** Fee profile for simulation legs (none = gross-only, backward compatible). */
  costModelPreset: 'none' | 'coinbase' | 'kraken';
}

// ─── Full store interface ─────────────────────────────────────────────────────

interface StrategyState extends ArbStoreConfig, MRStoreConfig, ScenarioLabConfig {
  strategyType: 'arbitrage' | 'mean-reversion';
  initialBalance: number;
  lastResult: BacktestResult | null;
  isRunning: boolean;
  lastScenarioResult: BacktestResult | null; // separate for lab mode (optional reuse of lastResult)

  // ── Actions ──────────────────────────────────────────────────────────────
  setStrategyType: (t: 'arbitrage' | 'mean-reversion') => void;
  setArbConfig: (c: Partial<ArbStoreConfig>) => void;
  setRegimeGateConfig: (c: Partial<RegimeGateConfig>) => void;
  setMrConfig: (c: Partial<MRStoreConfig>) => void;
  setInitialBalance: (b: number) => void;
  setLastResult: (r: BacktestResult | null) => void;
  setIsRunning: (v: boolean) => void;

  // Scenario Lab actions
  setScenarioMode: (m: 'classic' | 'lab') => void;
  setSelectedScenario: (key: string) => void;
  setCustomShocks: (shocks: Record<string, number>) => void;
  setSeedFromPortfolio: (v: boolean) => void;
  setExtraCashUsd: (v: number) => void;
  setDcaParams: (usd: number, periods: number) => void;
  setLastScenarioResult: (r: BacktestResult | null) => void;
  setCostModelPreset: (preset: 'none' | 'coinbase' | 'kraken') => void;
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
      arbRegimeGateEnabled: true,
      regimeGateConfig: { ...DEFAULT_REGIME_GATE_CONFIG },

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

      // Scenario Lab defaults (Feature 3)
      scenarioMode: 'classic',
      selectedScenario: 'flight-to-gold',
      customShocks: { gold: 1.12, 'pax-gold': 1.10, 'tether-gold': 1.09, bitcoin: 0.75, ethereum: 0.72 },
      seedFromPortfolio: true,
      extraCashUsd: 0,
      dcaUsdPerPeriod: 100,
      dcaPeriodCount: 6,
      lastScenarioResult: null,
      costModelPreset: 'none',

      // ── Actions ──────────────────────────────────────────────────────────
      setStrategyType: (t) => set({ strategyType: t }),
      setArbConfig: (c) => set((s) => ({ ...s, ...c })),
      setRegimeGateConfig: (c) =>
        set((s) => ({ regimeGateConfig: { ...s.regimeGateConfig, ...c } })),
      setMrConfig: (c) => set((s) => ({ ...s, ...c })),
      setInitialBalance: (b) => set({ initialBalance: b }),
      setLastResult: (r) => set({ lastResult: r }),
      setIsRunning: (v) => set({ isRunning: v }),

      // Scenario Lab actions
      setScenarioMode: (m) => set({ scenarioMode: m }),
      setSelectedScenario: (key) => set({ selectedScenario: key }),
      setCustomShocks: (shocks) => set({ customShocks: shocks }),
      setSeedFromPortfolio: (v) => set({ seedFromPortfolio: v }),
      setExtraCashUsd: (v) => set({ extraCashUsd: Math.max(0, v) }),
      setDcaParams: (usd, periods) => set({ dcaUsdPerPeriod: Math.max(0, usd), dcaPeriodCount: Math.max(0, periods) }),
      setLastScenarioResult: (r) => set({ lastScenarioResult: r }),
      setCostModelPreset: (preset) => set({ costModelPreset: preset }),
    }),
    {
      name: 'goldtrackr-strategy',
      // isRunning is transient — always start as false after a page reload
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isRunning = false;
          // scenario lab running flag not stored, but we can keep last results
        }
      },
    }
  )
);
