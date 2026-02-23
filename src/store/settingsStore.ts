import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  coinbaseApiKey: string;
  coinbaseApiSecret: string;
  coinbasePassphrase?: string;
  autoTradeEnabled: boolean;
  dryRun: boolean;
  maxTradeSize: number; // oz
  dailyLossLimit: number; // %

  setApiKey: (key: string) => void;
  setApiSecret: (secret: string) => void;
  setPassphrase: (passphrase: string) => void;
  toggleAutoTrade: (enabled: boolean) => void;
  toggleDryRun: (enabled: boolean) => void;
  setMaxTradeSize: (size: number) => void;
  setDailyLossLimit: (limit: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      coinbaseApiKey: '',
      coinbaseApiSecret: '',
      coinbasePassphrase: '',
      autoTradeEnabled: false,
      dryRun: true,
      maxTradeSize: 0.5,
      dailyLossLimit: 2.0,

      setApiKey: (key) => set({ coinbaseApiKey: key }),
      setApiSecret: (secret) => set({ coinbaseApiSecret: secret }),
      setPassphrase: (passphrase) => set({ coinbasePassphrase: passphrase }),
      toggleAutoTrade: (enabled) => set({ autoTradeEnabled: enabled }),
      toggleDryRun: (enabled) => set({ dryRun: enabled }),
      setMaxTradeSize: (size) => set({ maxTradeSize: size }),
      setDailyLossLimit: (limit) => set({ dailyLossLimit: limit }),
    }),
    {
      name: 'goldtrackr-settings',
    }
  )
);
