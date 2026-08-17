import { useEffect, useRef } from 'react';
import { useOrderStore } from '@/store/orderStore';
import { useOrderExecution } from '@/hooks/useOrderExecution';
import {
  detectStaleSubmitted,
  mergePollResult,
  pollSnapshotFromStatus,
  needsReconciliation,
} from '@lib/orderLifecycle';

const RECONCILE_INTERVAL_MS = 15_000;

/**
 * Poll venue status for non-terminal orders and merge into the journal.
 * Runs on an interval while any order needs reconciliation (tab sleep recovery).
 */
export function useOrderReconciliation() {
  const orders = useOrderStore((s) => s.orders);
  const { pollStatus, notifyJournal } = useOrderExecution();
  const pollingRef = useRef(false);

  const nonTerminal = orders.filter((o) => needsReconciliation(o.state));

  useEffect(() => {
    if (nonTerminal.length === 0) return;

    const reconcile = async () => {
      if (pollingRef.current) return;
      pollingRef.current = true;

      try {
        const now = Date.now();
        for (const order of nonTerminal) {
          const stale = detectStaleSubmitted(order, now);
          if (stale && stale.state === 'needs_attention') {
            notifyJournal(stale);
            continue;
          }

          if (!order.venueOrderId || order.mode === 'paper') continue;

          try {
            const status = await pollStatus(order);
            const snapshot = pollSnapshotFromStatus(status, order);
            const merged = mergePollResult(order, snapshot);
            if (merged.updatedAt !== order.updatedAt || merged.state !== order.state) {
              notifyJournal(merged);
            }
          } catch {
            const merged = mergePollResult(order, {
              state: order.state,
              pollFailed: true,
              attentionReason: 'Reconciliation poll failed — check connection',
            });
            notifyJournal(merged);
          }
        }
      } finally {
        pollingRef.current = false;
      }
    };

    void reconcile();
    const id = window.setInterval(() => void reconcile(), RECONCILE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [nonTerminal, pollStatus, notifyJournal]);
}
