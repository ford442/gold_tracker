import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OrderRecord } from '@lib/orderLifecycle';
import { needsReconciliation } from '@lib/orderLifecycle';

interface OrderStore {
  orders: OrderRecord[];
  /** Insert or replace by clientOrderId (append-only journal semantics). */
  upsertOrder: (record: OrderRecord) => void;
  /** Patch an existing order by clientOrderId. */
  updateOrder: (clientOrderId: string, updater: (prev: OrderRecord) => OrderRecord) => void;
  getOrder: (clientOrderId: string) => OrderRecord | undefined;
  getOpenOrders: () => OrderRecord[];
  getNonTerminalOrders: () => OrderRecord[];
  replaceOrders: (orders: OrderRecord[]) => void;
}

export const useOrderStore = create<OrderStore>()(
  persist(
    (set, get) => ({
      orders: [],

      upsertOrder: (record) =>
        set((state) => {
          const idx = state.orders.findIndex((o) => o.clientOrderId === record.clientOrderId);
          if (idx === -1) {
            return { orders: [record, ...state.orders] };
          }
          const next = [...state.orders];
          next[idx] = record;
          return { orders: next };
        }),

      updateOrder: (clientOrderId, updater) =>
        set((state) => {
          const idx = state.orders.findIndex((o) => o.clientOrderId === clientOrderId);
          if (idx === -1) return state;
          const next = [...state.orders];
          next[idx] = updater(next[idx]);
          return { orders: next };
        }),

      getOrder: (clientOrderId) =>
        get().orders.find((o) => o.clientOrderId === clientOrderId),

      getOpenOrders: () =>
        get().orders.filter(
          (o) =>
            o.state === 'open' ||
            o.state === 'partially_filled' ||
            o.state === 'submitted' ||
            o.state === 'needs_attention',
        ),

      getNonTerminalOrders: () =>
        get().orders.filter((o) => needsReconciliation(o.state)),

      replaceOrders: (orders) => set({ orders }),
    }),
    { name: 'goldtrackr-order-journal' },
  ),
);
