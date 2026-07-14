import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PaperFill } from '@lib/paperTrade';

/**
 * Local-first paper-trading ledger (Zustand + localStorage persist).
 *
 * Works with or without Supabase: paper trading never requires exchange keys or
 * auth. Every fill carries `mode: 'paper'` from the pure builder, and this store
 * only ever appends paper fills — there is no path to write a live fill here, so
 * paper history can never be confused with real execution.
 */
interface PaperTradeStore {
  fills: PaperFill[];
  /** Append a simulated fill to the ledger. */
  recordFill: (fill: PaperFill) => void;
  /** One-click reset of the paper portfolio / ledger. */
  resetPaper: () => void;
}

export const usePaperTradeStore = create<PaperTradeStore>()(
  persist(
    (set) => ({
      fills: [],
      recordFill: (fill) =>
        set((state) => ({ fills: [...state.fills, fill] })),
      resetPaper: () => set({ fills: [] }),
    }),
    { name: 'goldtrackr-paper-ledger' },
  ),
);
