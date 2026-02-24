import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Exchange = 'coinbase' | 'kraken';

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
  updateSettings: (settings: Partial<TradingSettings>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
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
      updateSettings: (newSettings) => set((state) => ({ ...state, ...newSettings })),
    }),
    {
      name: 'goldtrackr-settings',
    }
  )
);
