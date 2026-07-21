import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LiveTradingExchangeId } from '@lib/exchanges';
import type { PriceTransportMode } from '@lib/priceTransport';

/** Trading venue id — sourced from the exchange registry (exchanges.ts). */
export type Exchange = LiveTradingExchangeId;

export interface RiskDayAnchor {
  /** Local calendar date YYYY-MM-DD */
  date: string;
  startEquityUsd: number;
}

export interface TradingSettings {
  // Exchange selection
  selectedExchange: Exchange;
  
  // Coinbase CDP Keys
  cdpKeyName: string;
  cdpPrivateKey: string;
  
  // Kraken API Keys
  krakenApiKey: string;
  krakenApiSecret: string;
  
  // Trading settings
  autoTradeEnabled: boolean;
  dryRun: boolean;
  maxTradeSize: number; // oz
  dailyLossLimit: number; // %
  killSwitch: boolean;
  allowPaperDespiteKillSwitch: boolean;
  maxGoldSleevePct: number;
  maxSingleTradeNotionalUsd: number;
  maxOpenOrders: number;
  riskDayAnchor: RiskDayAnchor | null;
  /** Price feed transport: auto (WS + fallback), poll (REST), stream (WS + metals REST). */
  priceTransportMode: PriceTransportMode;
}

interface SettingsState extends TradingSettings {
  setSelectedExchange: (exchange: Exchange) => void;
  setCdpKeyName: (keyName: string) => void;
  setCdpPrivateKey: (privateKey: string) => void;
  setKrakenApiKey: (key: string) => void;
  setKrakenApiSecret: (secret: string) => void;
  toggleAutoTrade: (enabled: boolean) => void;
  toggleDryRun: (enabled: boolean) => void;
  setMaxTradeSize: (size: number) => void;
  setDailyLossLimit: (limit: number) => void;
  setKillSwitch: (enabled: boolean) => void;
  setAllowPaperDespiteKillSwitch: (enabled: boolean) => void;
  setMaxGoldSleevePct: (pct: number) => void;
  setMaxSingleTradeNotionalUsd: (usd: number) => void;
  setMaxOpenOrders: (count: number) => void;
  setRiskDayAnchor: (anchor: RiskDayAnchor | null) => void;
  setPriceTransportMode: (mode: PriceTransportMode) => void;
  updateSettings: (settings: Partial<TradingSettings>) => void;
  /** Wipe exchange credentials from local persistence (does not delete server-side keys). */
  clearExchangeKeys: () => void;
  hasLocalExchangeKeys: () => boolean;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Exchange
      selectedExchange: 'coinbase',
      
      // Coinbase keys
      cdpKeyName: '',
      cdpPrivateKey: '',
      
      // Kraken keys
      krakenApiKey: '',
      krakenApiSecret: '',
      
      // Trading settings
      autoTradeEnabled: false,
      dryRun: true,
      maxTradeSize: 0.5,
      dailyLossLimit: 2.0,
      killSwitch: false,
      allowPaperDespiteKillSwitch: true,
      maxGoldSleevePct: 100,
      maxSingleTradeNotionalUsd: 0,
      maxOpenOrders: 3,
      riskDayAnchor: null,
      priceTransportMode: 'auto',

      // Actions
      setSelectedExchange: (exchange) => set({ selectedExchange: exchange }),
      setCdpKeyName: (keyName) => set({ cdpKeyName: keyName }),
      setCdpPrivateKey: (privateKey) => set({ cdpPrivateKey: privateKey }),
      setKrakenApiKey: (key) => set({ krakenApiKey: key }),
      setKrakenApiSecret: (secret) => set({ krakenApiSecret: secret }),
      toggleAutoTrade: (enabled) => set({ autoTradeEnabled: enabled }),
      toggleDryRun: (enabled) => set({ dryRun: enabled }),
      setMaxTradeSize: (size) => set({ maxTradeSize: size }),
      setDailyLossLimit: (limit) => set({ dailyLossLimit: limit }),
      setKillSwitch: (enabled) => set({ killSwitch: enabled }),
      setAllowPaperDespiteKillSwitch: (enabled) => set({ allowPaperDespiteKillSwitch: enabled }),
      setMaxGoldSleevePct: (pct) => set({ maxGoldSleevePct: pct }),
      setMaxSingleTradeNotionalUsd: (usd) => set({ maxSingleTradeNotionalUsd: usd }),
      setMaxOpenOrders: (count) => set({ maxOpenOrders: count }),
      setRiskDayAnchor: (anchor) => set({ riskDayAnchor: anchor }),
      setPriceTransportMode: (mode) => set({ priceTransportMode: mode }),
      updateSettings: (newSettings) => set((state) => ({ ...state, ...newSettings })),
      clearExchangeKeys: () =>
        set({
          cdpKeyName: '',
          cdpPrivateKey: '',
          krakenApiKey: '',
          krakenApiSecret: '',
        }),
      hasLocalExchangeKeys: (): boolean => {
        const s = get();
        return Boolean(
          s.cdpKeyName.trim()
          || s.cdpPrivateKey.trim()
          || s.krakenApiKey.trim()
          || s.krakenApiSecret.trim(),
        );
      },
    }),
    {
      name: 'goldtrackr-settings',
    }
  )
);
