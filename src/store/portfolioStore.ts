import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PortfolioEntry } from '../types';

interface PortfolioStore {
  entries: PortfolioEntry[];
  addEntry: (entry: Omit<PortfolioEntry, 'id'>) => void;
  updateEntry: (id: string, updates: Partial<PortfolioEntry>) => void;
  removeEntry: (id: string) => void;
}

export const usePortfolioStore = create<PortfolioStore>()(
  persist(
    (set) => ({
      entries: [],
      addEntry: (entry) =>
        set((state) => ({
          entries: [
            ...state.entries,
            { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` },
          ],
        })),
      updateEntry: (id, updates) =>
        set((state) => ({
          entries: state.entries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        })),
      removeEntry: (id) =>
        set((state) => ({ entries: state.entries.filter((e) => e.id !== id) })),
    }),
    { name: 'goldtrackr-portfolio' }
  )
);
