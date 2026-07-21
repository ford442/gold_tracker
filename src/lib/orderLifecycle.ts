/**
 * Order lifecycle — PURE logic (no React, no network).
 *
 * Normalizes venue responses into a shared `OrderRecord`, drives state transitions,
 * and provides reconciliation helpers for polling after tab sleep / network blips.
 */

import type { LiveTradingExchangeId } from './exchanges';
import type { PlaceTradeResponse } from './orderTypes';

export type OrderLifecycleState =
  | 'pending'
  | 'submitted'
  | 'open'
  | 'partially_filled'
  | 'filled'
  | 'cancelled'
  | 'failed'
  | 'needs_attention';

export type OrderMode = 'live' | 'paper';

export interface OrderRecord {
  /** Stable client-side key — one journal row per order attempt. */
  clientOrderId: string;
  /** Venue-assigned id after submit ack. */
  venueOrderId?: string;
  exchange: LiveTradingExchangeId;
  mode: OrderMode;
  state: OrderLifecycleState;
  productId: string;
  side: 'BUY' | 'SELL';
  requestedQty: number;
  filledQty: number;
  avgFillPrice?: number;
  feeUsd: number;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  error?: string;
  /** Link to paperTradeStore fill when mode === 'paper'. */
  paperFillId?: string;
  /** Originating context: suggestion id, 'arb', etc. */
  source?: string;
  idempotencyKey: string;
  needsAttention?: boolean;
  attentionReason?: string;
}

export interface CreatePendingOrderParams {
  clientOrderId: string;
  exchange: LiveTradingExchangeId;
  mode: OrderMode;
  productId: string;
  side: 'BUY' | 'SELL';
  requestedQty: number;
  source?: string;
  idempotencyKey: string;
  now?: string;
}

export interface VenueOrderSnapshot {
  state: OrderLifecycleState;
  venueOrderId?: string;
  filledQty?: number;
  avgFillPrice?: number;
  feeUsd?: number;
  error?: string;
}

export interface OrderPollSnapshot extends VenueOrderSnapshot {
  /** When true, poll could not resolve status — surface needs_attention. */
  pollFailed?: boolean;
  attentionReason?: string;
}

export const TERMINAL_STATES: readonly OrderLifecycleState[] = [
  'filled',
  'cancelled',
  'failed',
] as const;

/** Non-terminal states that should keep reconciliation polling active. */
export const RECONCILE_STATES: readonly OrderLifecycleState[] = [
  'pending',
  'submitted',
  'open',
  'partially_filled',
  'needs_attention',
] as const;

export const STALE_SUBMITTED_MS = 60_000;
export const RESUBMIT_COOLDOWN_MS = 30_000;

let clientOrderSeq = 0;

export function generateClientOrderId(now = Date.now()): string {
  clientOrderSeq += 1;
  return `gt-${now}-${clientOrderSeq}`;
}

export function buildIdempotencyKey(
  exchange: string,
  productId: string,
  side: string,
  requestedQty: number,
  source?: string,
): string {
  return `${exchange}:${productId}:${side}:${source ?? 'manual'}:${requestedQty}`;
}

export function isTerminalState(state: OrderLifecycleState): boolean {
  return (TERMINAL_STATES as readonly string[]).includes(state);
}

export function needsReconciliation(state: OrderLifecycleState): boolean {
  return (RECONCILE_STATES as readonly string[]).includes(state);
}

export function canCancelOrder(record: OrderRecord): boolean {
  return (
    record.mode === 'live' &&
    (record.state === 'open' || record.state === 'partially_filled' || record.state === 'submitted')
  );
}

export function findBlockingOrder(
  orders: OrderRecord[],
  idempotencyKey: string,
): OrderRecord | undefined {
  return orders.find(
    (o) =>
      o.idempotencyKey === idempotencyKey &&
      needsReconciliation(o.state) &&
      o.state !== 'needs_attention',
  );
}

export function canResubmit(
  record: OrderRecord,
  now: number,
): boolean {
  if (record.state !== 'failed' && record.state !== 'needs_attention') return false;
  const updated = new Date(record.updatedAt).getTime();
  return now - updated >= RESUBMIT_COOLDOWN_MS;
}

export function createPendingOrder(params: CreatePendingOrderParams): OrderRecord {
  const now = params.now ?? new Date().toISOString();
  return {
    clientOrderId: params.clientOrderId,
    exchange: params.exchange,
    mode: params.mode,
    state: 'pending',
    productId: params.productId,
    side: params.side,
    requestedQty: params.requestedQty,
    filledQty: 0,
    feeUsd: 0,
    createdAt: now,
    updatedAt: now,
    source: params.source,
    idempotencyKey: params.idempotencyKey,
  };
}

function withUpdated(record: OrderRecord, patch: Partial<OrderRecord>, now?: string): OrderRecord {
  const ts = now ?? new Date().toISOString();
  return { ...record, ...patch, updatedAt: ts };
}

export function markSubmitted(
  record: OrderRecord,
  venueOrderId?: string,
  now?: string,
): OrderRecord {
  const ts = now ?? new Date().toISOString();
  return withUpdated(
    record,
    {
      state: 'submitted',
      venueOrderId: venueOrderId ?? record.venueOrderId,
      submittedAt: ts,
    },
    ts,
  );
}

export function markNeedsAttention(
  record: OrderRecord,
  reason: string,
  now?: string,
): OrderRecord {
  return withUpdated(
    record,
    {
      state: 'needs_attention',
      needsAttention: true,
      attentionReason: reason,
    },
    now,
  );
}

export function markCancelled(record: OrderRecord, now?: string): OrderRecord {
  return withUpdated(record, { state: 'cancelled', needsAttention: false }, now);
}

export function markFailed(record: OrderRecord, error: string, now?: string): OrderRecord {
  return withUpdated(record, { state: 'failed', error, needsAttention: false }, now);
}

/** Map venue poll status string to lifecycle state. */
export function mapPollStatusToState(
  status: 'open' | 'filled' | 'cancelled' | 'partially_filled' | 'unknown',
  filledQty: number,
  requestedQty: number,
): OrderLifecycleState {
  if (status === 'filled') return 'filled';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'partially_filled') return 'partially_filled';
  if (status === 'open') return 'open';
  if (filledQty > 0 && filledQty < requestedQty) return 'partially_filled';
  if (filledQty >= requestedQty && requestedQty > 0) return 'filled';
  return 'submitted';
}

export function normalizeCoinbasePlaceResponse(
  response: PlaceTradeResponse,
  requestedQty: number,
  mode: OrderMode,
): VenueOrderSnapshot {
  if (!response.success) {
    return { state: 'failed', error: response.error ?? 'Order failed' };
  }

  const venueOrderId = response.order_id;
  if (mode === 'paper' || (venueOrderId?.startsWith('dry-run-') ?? false)) {
    return {
      state: 'filled',
      venueOrderId,
      filledQty: requestedQty,
      feeUsd: 0,
    };
  }

  // Market IOC: assume submitted until poll confirms fill.
  return {
    state: 'submitted',
    venueOrderId,
    filledQty: 0,
  };
}

export function normalizeKrakenPlaceResponse(
  response: PlaceTradeResponse & { description?: string },
  requestedQty: number,
  mode: OrderMode,
): VenueOrderSnapshot {
  if (!response.success) {
    return { state: 'failed', error: response.error ?? 'Order failed' };
  }

  const venueOrderId = response.order_id;
  if (mode === 'paper' || (venueOrderId?.startsWith('dry-run-') ?? false)) {
    return {
      state: 'filled',
      venueOrderId,
      filledQty: requestedQty,
      feeUsd: 0,
    };
  }

  return {
    state: 'submitted',
    venueOrderId,
    filledQty: 0,
  };
}

export function normalizePlaceResponse(
  exchange: LiveTradingExchangeId,
  response: PlaceTradeResponse,
  requestedQty: number,
  mode: OrderMode,
): VenueOrderSnapshot {
  return exchange === 'kraken'
    ? normalizeKrakenPlaceResponse(response, requestedQty, mode)
    : normalizeCoinbasePlaceResponse(response, requestedQty, mode);
}

export function applyVenueSnapshot(
  record: OrderRecord,
  snapshot: VenueOrderSnapshot,
  now?: string,
): OrderRecord {
  const filledQty = snapshot.filledQty ?? record.filledQty;
  const feeUsd = snapshot.feeUsd ?? record.feeUsd;

  return withUpdated(
    record,
    {
      state: snapshot.state,
      venueOrderId: snapshot.venueOrderId ?? record.venueOrderId,
      filledQty,
      avgFillPrice: snapshot.avgFillPrice ?? record.avgFillPrice,
      feeUsd,
      error: snapshot.error,
      needsAttention: snapshot.state === 'needs_attention',
      attentionReason: snapshot.state === 'needs_attention' ? snapshot.error : undefined,
    },
    now,
  );
}

export function applyPlaceResult(
  record: OrderRecord,
  response: PlaceTradeResponse,
  now?: string,
): OrderRecord {
  const snapshot = normalizePlaceResponse(
    record.exchange,
    response,
    record.requestedQty,
    record.mode,
  );

  if (!response.success) {
    return applyVenueSnapshot(record, snapshot, now);
  }

  const submitted = markSubmitted(record, response.order_id, now);
  return applyVenueSnapshot(submitted, snapshot, now);
}

/** Merge a poll result into an existing journal row (no duplicate rows). */
export function mergePollResult(
  record: OrderRecord,
  poll: OrderPollSnapshot,
  now?: string,
): OrderRecord {
  if (poll.pollFailed) {
    return markNeedsAttention(
      record,
      poll.attentionReason ?? 'Could not reconcile order status with venue',
      now,
    );
  }

  const filledQty = poll.filledQty ?? record.filledQty;

  return applyVenueSnapshot(
    record,
    {
      state: poll.state,
      venueOrderId: poll.venueOrderId ?? record.venueOrderId,
      filledQty,
      avgFillPrice: poll.avgFillPrice,
      feeUsd: poll.feeUsd,
      error: poll.error,
    },
    now,
  );
}

/** Map adapter/service poll into a lifecycle poll snapshot. */
export function pollSnapshotFromStatus(
  result: {
    status: 'open' | 'filled' | 'cancelled' | 'partially_filled' | 'unknown';
    venueOrderId?: string;
    filledQty?: number;
    avgFillPrice?: number;
    feeUsd?: number;
    error?: string;
  },
  record: OrderRecord,
): OrderPollSnapshot {
  if (result.status === 'unknown' && result.error) {
    return {
      state: record.state,
      pollFailed: true,
      attentionReason: result.error,
    };
  }

  const filledQty = result.filledQty ?? record.filledQty;
  const state = mapPollStatusToState(
    result.status,
    filledQty,
    record.requestedQty,
  );

  return {
    state,
    venueOrderId: result.venueOrderId ?? record.venueOrderId,
    filledQty,
    avgFillPrice: result.avgFillPrice,
    feeUsd: result.feeUsd,
    error: result.error,
  };
}

export function detectStaleSubmitted(
  record: OrderRecord,
  now: number,
): OrderRecord | null {
  if (record.state !== 'submitted' || !record.submittedAt) return null;
  const elapsed = now - new Date(record.submittedAt).getTime();
  if (elapsed < STALE_SUBMITTED_MS) return null;
  return markNeedsAttention(record, 'No venue confirmation received — check exchange or retry');
}

export function reconcileOrderBatch(
  orders: OrderRecord[],
  polls: Map<string, OrderPollSnapshot>,
  now: number,
): OrderRecord[] {
  return orders.map((order) => {
    if (!needsReconciliation(order.state)) return order;

    const stale = detectStaleSubmitted(order, now);
    if (stale) return stale;

    const poll = order.venueOrderId ? polls.get(order.venueOrderId) : undefined;
    if (!poll) return order;

    return mergePollResult(order, poll, new Date(now).toISOString());
  });
}

/** Paper-mode immediate fill (same state machine, mode: 'paper'). */
export function applyPaperFill(
  record: OrderRecord,
  paperFillId: string,
  filledQty: number,
  feeUsd: number,
  avgFillPrice?: number,
  now?: string,
): OrderRecord {
  return withUpdated(
    record,
    {
      state: 'filled',
      mode: 'paper',
      paperFillId,
      filledQty,
      feeUsd,
      avgFillPrice,
      venueOrderId: `paper-${paperFillId}`,
    },
    now,
  );
}

// ——— Test fixtures: Coinbase + Kraken response shapes ———

export const FIXTURE_COINBASE_PLACE_SUCCESS: PlaceTradeResponse = {
  success: true,
  order_id: 'cb-order-abc123',
  message: 'Order placed on Coinbase',
  exchange: 'coinbase',
};

export const FIXTURE_COINBASE_PLACE_FAILURE: PlaceTradeResponse = {
  success: false,
  error: 'INSUFFICIENT_FUND',
  exchange: 'coinbase',
};

export const FIXTURE_COINBASE_DRY_RUN: PlaceTradeResponse = {
  success: true,
  order_id: 'dry-run-1710000000000',
  message: 'DRY RUN on COINBASE — no real order was placed',
  exchange: 'coinbase',
};

export const FIXTURE_KRAKEN_PLACE_SUCCESS: PlaceTradeResponse = {
  success: true,
  order_id: 'KRAKEN-TXID-XYZ',
  message: 'Order placed on Kraken (PAXGXAUT)',
  exchange: 'kraken',
};

export const FIXTURE_KRAKEN_PLACE_FAILURE: PlaceTradeResponse = {
  success: false,
  error: 'EOrder:Insufficient funds',
  exchange: 'kraken',
};

export const FIXTURE_COINBASE_POLL_PARTIAL: OrderPollSnapshot = {
  state: 'partially_filled',
  venueOrderId: 'cb-order-abc123',
  filledQty: 0.25,
  avgFillPrice: 2650,
  feeUsd: 1.59,
};

export const FIXTURE_COINBASE_POLL_FILLED: OrderPollSnapshot = {
  state: 'filled',
  venueOrderId: 'cb-order-abc123',
  filledQty: 0.5,
  avgFillPrice: 2650,
  feeUsd: 3.18,
};

export const FIXTURE_KRAKEN_POLL_OPEN: OrderPollSnapshot = {
  state: 'open',
  venueOrderId: 'KRAKEN-TXID-XYZ',
  filledQty: 0,
};
