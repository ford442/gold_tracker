/**
 * Pure order synchronization & conflict resolution logic (no React, no network).
 *
 * Provides bidirectional mapping between Postgres `order_journal` rows and client
 * `OrderRecord`s, deterministic multi-device merge semantics, and unpushed diff detection.
 */

import type { LiveTradingExchangeId } from './exchanges';
import type { OrderLifecycleState, OrderMode, OrderRecord } from './orderLifecycle';
import { isTerminalState } from './orderLifecycle';

export interface DbOrderJournalRow {
  id?: string;
  user_id: string;
  client_order_id: string;
  venue_order_id: string | null;
  exchange: string;
  mode: string;
  state: string;
  product_id: string;
  side: string;
  requested_qty: number | string;
  filled_qty: number | string;
  avg_fill_price: number | string | null;
  fee_usd: number | string;
  idempotency_key: string;
  source: string | null;
  error: string | null;
  paper_fill_id: string | null;
  needs_attention: boolean | null;
  attention_reason: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Converts a client OrderRecord into a database row for Supabase order_journal.
 */
export function orderRecordToDbRow(record: OrderRecord, userId: string): DbOrderJournalRow {
  return {
    user_id: userId,
    client_order_id: record.clientOrderId,
    venue_order_id: record.venueOrderId ?? null,
    exchange: record.exchange,
    mode: record.mode,
    state: record.state,
    product_id: record.productId,
    side: record.side,
    requested_qty: record.requestedQty,
    filled_qty: record.filledQty,
    avg_fill_price: record.avgFillPrice ?? null,
    fee_usd: record.feeUsd,
    idempotency_key: record.idempotencyKey,
    source: record.source ?? null,
    error: record.error ?? null,
    paper_fill_id: record.paperFillId ?? null,
    needs_attention: record.needsAttention ?? false,
    attention_reason: record.attentionReason ?? null,
    submitted_at: record.submittedAt ?? null,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

/**
 * Converts a database row from Supabase order_journal into a client OrderRecord.
 */
export function dbRowToOrderRecord(row: DbOrderJournalRow): OrderRecord {
  const reqQty = typeof row.requested_qty === 'number' ? row.requested_qty : parseFloat(row.requested_qty) || 0;
  const fillQty = typeof row.filled_qty === 'number' ? row.filled_qty : parseFloat(row.filled_qty) || 0;
  const avgPrice = row.avg_fill_price != null
    ? (typeof row.avg_fill_price === 'number' ? row.avg_fill_price : parseFloat(row.avg_fill_price) || undefined)
    : undefined;
  const fee = typeof row.fee_usd === 'number' ? row.fee_usd : parseFloat(row.fee_usd) || 0;

  return {
    clientOrderId: row.client_order_id,
    venueOrderId: row.venue_order_id ?? undefined,
    exchange: (row.exchange === 'kraken' ? 'kraken' : 'coinbase') as LiveTradingExchangeId,
    mode: (row.mode === 'paper' ? 'paper' : 'live') as OrderMode,
    state: (row.state ?? 'submitted') as OrderLifecycleState,
    productId: row.product_id,
    side: row.side === 'SELL' ? 'SELL' : 'BUY',
    requestedQty: reqQty,
    filledQty: fillQty,
    avgFillPrice: avgPrice,
    feeUsd: fee,
    idempotencyKey: row.idempotency_key ?? `${row.exchange}:${row.product_id}:${row.side}:synced:${reqQty}`,
    source: row.source ?? undefined,
    error: row.error ?? undefined,
    paperFillId: row.paper_fill_id ?? undefined,
    needsAttention: Boolean(row.needs_attention),
    attentionReason: row.attention_reason ?? undefined,
    submittedAt: row.submitted_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseTimeSafe(isoString?: string): number {
  if (!isoString) return 0;
  const ts = new Date(isoString).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

/**
 * Resolves a conflict between a local OrderRecord and a remote OrderRecord sharing the same clientOrderId.
 *
 * Precedence:
 * 1. Terminal states ('filled', 'cancelled', 'failed') take precedence over non-terminal states.
 * 2. If both are terminal: 'filled' with filledQty > 0 wins over 'cancelled'/'failed'; otherwise newer updatedAt wins.
 * 3. If both are non-terminal: higher filledQty wins; presence of venueOrderId wins over pending without venueOrderId.
 * 4. Venue fields (venueOrderId, fill price, fee) merge in from whichever record has them.
 * 5. Local-only properties (source, paperFillId) are preserved.
 */
export function resolveOrderConflict(local: OrderRecord, remote: OrderRecord): OrderRecord {
  const localTerminal = isTerminalState(local.state);
  const remoteTerminal = isTerminalState(remote.state);

  let primary: OrderRecord;
  let secondary: OrderRecord;

  if (remoteTerminal && !localTerminal) {
    primary = remote;
    secondary = local;
  } else if (localTerminal && !remoteTerminal) {
    primary = local;
    secondary = remote;
  } else if (remoteTerminal && localTerminal) {
    if (remote.state === 'filled' && remote.filledQty > 0 && local.state !== 'filled') {
      primary = remote;
      secondary = local;
    } else if (local.state === 'filled' && local.filledQty > 0 && remote.state !== 'filled') {
      primary = local;
      secondary = remote;
    } else {
      const localTime = parseTimeSafe(local.updatedAt);
      const remoteTime = parseTimeSafe(remote.updatedAt);
      if (remoteTime >= localTime) {
        primary = remote;
        secondary = local;
      } else {
        primary = local;
        secondary = remote;
      }
    }
  } else {
    // Both non-terminal
    if (remote.filledQty > local.filledQty) {
      primary = remote;
      secondary = local;
    } else if (local.filledQty > remote.filledQty) {
      primary = local;
      secondary = remote;
    } else if (remote.venueOrderId && !local.venueOrderId) {
      primary = remote;
      secondary = local;
    } else if (local.venueOrderId && !remote.venueOrderId) {
      primary = local;
      secondary = remote;
    } else {
      const localTime = parseTimeSafe(local.updatedAt);
      const remoteTime = parseTimeSafe(remote.updatedAt);
      if (remoteTime >= localTime) {
        primary = remote;
        secondary = local;
      } else {
        primary = local;
        secondary = remote;
      }
    }
  }

  // Determine earliest createdAt and latest updatedAt
  const localCreated = parseTimeSafe(local.createdAt);
  const remoteCreated = parseTimeSafe(remote.createdAt);
  const earliestCreated = (localCreated > 0 && remoteCreated > 0)
    ? (localCreated <= remoteCreated ? local.createdAt : remote.createdAt)
    : (local.createdAt || remote.createdAt);

  const localUpdated = parseTimeSafe(local.updatedAt);
  const remoteUpdated = parseTimeSafe(remote.updatedAt);
  const latestUpdated = (localUpdated > 0 && remoteUpdated > 0)
    ? (localUpdated >= remoteUpdated ? local.updatedAt : remote.updatedAt)
    : (primary.updatedAt || new Date().toISOString());

  return {
    ...primary,
    venueOrderId: primary.venueOrderId ?? secondary.venueOrderId,
    avgFillPrice: primary.avgFillPrice ?? secondary.avgFillPrice,
    feeUsd: primary.feeUsd > 0 ? primary.feeUsd : secondary.feeUsd,
    source: primary.source ?? secondary.source,
    paperFillId: primary.paperFillId ?? secondary.paperFillId,
    idempotencyKey: primary.idempotencyKey || secondary.idempotencyKey,
    createdAt: earliestCreated,
    updatedAt: latestUpdated,
    submittedAt: primary.submittedAt ?? secondary.submittedAt,
  };
}

/**
 * Merges local and remote order arrays by clientOrderId, resolving conflicts deterministically.
 * Returns orders sorted by createdAt DESC (newest first).
 */
export function mergeOrderRecords(local: OrderRecord[], remote: OrderRecord[]): OrderRecord[] {
  const mergedMap = new Map<string, OrderRecord>();

  // Add all local records first
  for (const ord of local) {
    if (!ord.clientOrderId) continue;
    mergedMap.set(ord.clientOrderId, ord);
  }

  // Merge in remote records
  for (const rem of remote) {
    if (!rem.clientOrderId) continue;
    const existing = mergedMap.get(rem.clientOrderId);
    if (!existing) {
      mergedMap.set(rem.clientOrderId, rem);
    } else {
      mergedMap.set(rem.clientOrderId, resolveOrderConflict(existing, rem));
    }
  }

  const result = Array.from(mergedMap.values());
  result.sort((a, b) => parseTimeSafe(b.createdAt) - parseTimeSafe(a.createdAt));
  return result;
}

/**
 * Returns local orders that either do not exist on the remote server or have more recent local updates.
 */
export function findUnsyncedOrders(localOrders: OrderRecord[], remoteOrders: OrderRecord[]): OrderRecord[] {
  const remoteMap = new Map<string, OrderRecord>();
  for (const r of remoteOrders) {
    if (r.clientOrderId) {
      remoteMap.set(r.clientOrderId, r);
    }
  }

  return localOrders.filter((loc) => {
    if (!loc.clientOrderId) return false;
    const rem = remoteMap.get(loc.clientOrderId);
    if (!rem) return true; // not in remote

    // If local is terminal and remote is not, it needs sync
    if (isTerminalState(loc.state) && !isTerminalState(rem.state)) return true;

    // If local has newer timestamp and state/fill differences
    const locTime = parseTimeSafe(loc.updatedAt);
    const remTime = parseTimeSafe(rem.updatedAt);
    if (locTime > remTime && (loc.state !== rem.state || loc.filledQty !== rem.filledQty || loc.error !== rem.error)) {
      return true;
    }

    return false;
  });
}
