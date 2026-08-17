import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useOrderStore } from '@/store/orderStore';
import { orderJournalService } from '@/services/orderJournalService';
import { findUnsyncedOrders, mergeOrderRecords } from '@lib/orderSync';

const SYNC_INTERVAL_MS = 60_000;

/**
 * Orchestrates multi-device synchronization for the OMS order journal.
 * Pulls and merges Postgres order_journal rows with local storage on:
 * - Auth session change / login
 * - Tab visibility change (focus)
 * - Network reconnection (online event)
 * - Background interval
 * Also flushes local offline mutations to the server.
 */
export function useOrderSync() {
  const { user, init: initAuth } = useAuthStore();
  const orders = useOrderStore((s) => s.orders);
  const replaceOrders = useOrderStore((s) => s.replaceOrders);
  const syncingRef = useRef(false);
  const lastSyncUserRef = useRef<string | null>(null);

  const sync = useCallback(async () => {
    if (!user?.id || syncingRef.current) return;
    syncingRef.current = true;

    try {
      const currentLocal = useOrderStore.getState().orders;
      const serverOrders = await orderJournalService.fetchUserOrders(user.id);

      if (serverOrders.length > 0 || currentLocal.length > 0) {
        const merged = mergeOrderRecords(currentLocal, serverOrders);
        replaceOrders(merged);

        // Check if there are local orders that need to be pushed to the server
        const unsynced = findUnsyncedOrders(currentLocal, serverOrders);
        if (unsynced.length > 0) {
          await orderJournalService.upsertOrders(unsynced, user.id);
        }
      }
    } finally {
      syncingRef.current = false;
    }
  }, [user?.id, replaceOrders]);

  // Ensure auth session is initialized
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Sync on login / user identity change
  useEffect(() => {
    if (user?.id) {
      if (lastSyncUserRef.current !== user.id) {
        lastSyncUserRef.current = user.id;
        void sync();
      }
    } else {
      lastSyncUserRef.current = null;
    }
  }, [user?.id, sync]);

  // Sync on visibility focus, network reconnect, and periodic interval
  useEffect(() => {
    if (!user?.id) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void sync();
      }
    };

    const handleOnline = () => {
      void sync();
    };

    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    window.addEventListener('online', handleOnline);

    const intervalId = window.setInterval(() => {
      void sync();
    }, SYNC_INTERVAL_MS);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      window.removeEventListener('online', handleOnline);
      window.clearInterval(intervalId);
    };
  }, [user?.id, sync]);

  return { sync, ordersCount: orders.length };
}
