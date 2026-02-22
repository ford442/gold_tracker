import { create } from 'zustand';
import type { AlertItem } from '../types';

interface AlertStore {
  alerts: AlertItem[];
  addAlert: (alert: Omit<AlertItem, 'id' | 'timestamp' | 'dismissed'>) => void;
  dismissAlert: (id: string) => void;
  clearAll: () => void;
}

export const useAlertStore = create<AlertStore>((set) => ({
  alerts: [],
  addAlert: (alert) =>
    set((state) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const newAlert: AlertItem = { ...alert, id, timestamp: Date.now(), dismissed: false };
      // Keep only last 20 alerts
      const filtered = state.alerts.filter((a) => !a.dismissed).slice(0, 19);
      return { alerts: [newAlert, ...filtered] };
    }),
  dismissAlert: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, dismissed: true } : a)),
    })),
  clearAll: () => set({ alerts: [] }),
}));
