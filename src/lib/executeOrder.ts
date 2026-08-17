/**
 * Shared order execution orchestrator — pure lifecycle transitions with
 * dependency injection (issue #33 lifecycle + P1 pure lib refactor).
 *
 * Free of React, Zustand stores, and network clients.
 */

import type { LiveTradingExchangeId } from './exchanges';
import type {
  CancelOrderResult,
  OrderStatusResult,
  PlaceTradeResponse,
  TradeOrder,
} from './orderTypes';
import type { OrderMode, OrderRecord } from './orderLifecycle';
import {
  applyPaperFill,
  applyPlaceResult,
  buildIdempotencyKey,
  createPendingOrder,
  findBlockingOrder,
  generateClientOrderId,
  markCancelled,
  markFailed,
} from './orderLifecycle';
import { recordObservabilityEvent } from './observability';
import type { RiskCheckResult } from './riskEngine';

export interface ExecuteOrderParams {
  order: TradeOrder;
  dryRun: boolean;
  exchange: LiveTradingExchangeId;
  /** Originating context for journal traceability (e.g. suggestion id, 'arb'). */
  source?: string;
  /** When set, links paper fill after simulated execution. */
  paperFillId?: string;
  /** Override mode; defaults to dryRun ? 'paper' : 'live'. */
  mode?: OrderMode;
  /** Reference unit price in USD for display or paper fill logs. */
  unitPriceUsd?: number;
}

export interface OrderExecutionDeps {
  /** Pre-trade risk gate evaluation. If omitted, risk check passes. */
  evaluateRisk?: (order: TradeOrder, mode: OrderMode) => RiskCheckResult;
  /** Records order mutations in local/durable storage. */
  upsertOrder: (record: OrderRecord) => void;
  /** Query existing orders to check for blocking in-flight orders. */
  getOrders: () => OrderRecord[];
  /** Route order to venue or server backend. */
  routeOrder: (
    order: TradeOrder,
    dryRun: boolean,
    exchange: LiveTradingExchangeId,
    meta: { clientOrderId: string; idempotencyKey: string; source?: string },
  ) => Promise<PlaceTradeResponse>;
  /** Optional clock for deterministic testing (defaults to Date.now). */
  now?: () => number;
}

export interface ExecuteOrderResult {
  result: PlaceTradeResponse;
  record?: OrderRecord;
}

export class OrderExecutionError extends Error {
  exchange: LiveTradingExchangeId;

  constructor(message: string, exchange: LiveTradingExchangeId) {
    super(message);
    this.name = 'OrderExecutionError';
    this.exchange = exchange;
  }
}

export function requestedQtyFromOrder(order: TradeOrder): number {
  const size =
    order.order_configuration.market_market_ioc?.base_size ??
    order.order_configuration.limit_limit_gtc?.base_size;
  const qty = parseFloat(size ?? '0');
  return Number.isFinite(qty) && qty > 0 ? qty : 0;
}

/**
 * Execute an order with durable lifecycle state machine progression:
 * 1. Evaluate risk gate
 * 2. Check for in-flight idempotency duplicate
 * 3. Create and record pending journal row
 * 4. In paper mode: apply simulated fill immediately
 * 5. In live mode: route to venue/server and apply result/failure
 */
export async function executeOrderWithLifecycle(
  params: ExecuteOrderParams,
  deps: OrderExecutionDeps,
): Promise<ExecuteOrderResult> {
  const { order, dryRun, exchange, source, paperFillId } = params;
  const mode = params.mode ?? (dryRun ? 'paper' : 'live');
  const requestedQty = requestedQtyFromOrder(order);
  const nowMs = deps.now ? deps.now() : Date.now();
  const nowIso = new Date(nowMs).toISOString();

  // 1. Risk gate check
  if (deps.evaluateRisk) {
    const risk = deps.evaluateRisk(order, mode);
    if (!risk.allowed) {
      recordObservabilityEvent({
        kind: 'trade_attempt',
        severity: 'warn',
        ok: false,
        source: 'risk-gate',
        exchange,
        action: 'risk_block',
        detail: `Risk guardrail blocked: ${risk.reasons.join(' · ')}`,
        meta: { productId: order.product_id, side: order.side, mode },
      });
      return {
        result: {
          success: false,
          error: risk.reasons.join(' · '),
        },
      };
    }
  }

  // 2. In-flight idempotency duplicate check
  const idempotencyKey = buildIdempotencyKey(
    exchange,
    order.product_id,
    order.side,
    requestedQty,
    source,
  );

  const existingOrders = deps.getOrders();
  const blocking = findBlockingOrder(existingOrders, idempotencyKey);
  if (blocking) {
    recordObservabilityEvent({
      kind: 'trade_attempt',
      severity: 'warn',
      ok: false,
      source: 'idempotency-gate',
      exchange,
      action: 'idempotency_block',
      detail: `Duplicate in-flight order blocked for ${order.product_id}`,
      meta: { productId: order.product_id, side: order.side },
    });
    return {
      result: { success: false, error: 'Duplicate order in flight' },
      record: blocking,
    };
  }

  // 3. Create pending journal row
  const clientOrderId = generateClientOrderId(nowMs);
  let record = createPendingOrder({
    clientOrderId,
    exchange,
    mode,
    productId: order.product_id,
    side: order.side,
    requestedQty,
    source,
    idempotencyKey,
    now: nowIso,
  });

  deps.upsertOrder(record);

  // 4. Paper mode execution
  if (mode === 'paper') {
    record = applyPaperFill(
      record,
      paperFillId ?? `sim-${clientOrderId}`,
      requestedQty,
      0,
      params.unitPriceUsd,
      nowIso,
    );
    deps.upsertOrder(record);
    recordObservabilityEvent({
      kind: 'trade_attempt',
      severity: 'info',
      ok: true,
      source: exchange,
      exchange,
      action: 'paper_fill',
      detail: `Paper fill: ${order.side} ${order.product_id} (${requestedQty})`,
      meta: { clientOrderId: record.clientOrderId, venueOrderId: record.venueOrderId },
    });
    return {
      result: {
        success: true,
        order_id: record.venueOrderId,
        message: 'PAPER trade recorded',
        exchange,
      },
      record,
    };
  }

  // 5. Live mode execution
  try {
    const result = await deps.routeOrder(order, dryRun, exchange, {
      clientOrderId,
      idempotencyKey,
      source,
    });
    record = applyPlaceResult(record, result, nowIso);
    deps.upsertOrder(record);
    recordObservabilityEvent({
      kind: 'trade_attempt',
      severity: result.success ? 'success' : 'error',
      ok: result.success,
      source: exchange,
      exchange,
      action: 'place_order',
      detail: result.success
        ? `Live order submitted on ${exchange}: ${result.order_id ?? clientOrderId}`
        : `Live order rejected on ${exchange}: ${result.error ?? 'Unknown error'}`,
      meta: { clientOrderId: record.clientOrderId, venueOrderId: result.order_id },
    });
    return { result, record };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown execution error';
    record = markFailed(record, message, nowIso);
    deps.upsertOrder(record);
    recordObservabilityEvent({
      kind: 'trade_attempt',
      severity: 'error',
      ok: false,
      source: exchange,
      exchange,
      action: 'place_order',
      detail: `Live order exception on ${exchange}: ${message}`,
      meta: { clientOrderId: record.clientOrderId },
    });
    throw err;
  }
}

export interface CancelOrderDeps {
  upsertOrder: (record: OrderRecord) => void;
  cancelVenueOrder: (
    venueOrderId: string,
    exchange: LiveTradingExchangeId,
    productId: string,
  ) => Promise<CancelOrderResult>;
  now?: () => number;
}

/**
 * Cancel an order through its lifecycle:
 * validates venueOrderId, delegates to cancelVenueOrder, and records cancelled or failed state.
 */
export async function cancelOrderWithLifecycle(
  record: OrderRecord,
  deps: CancelOrderDeps,
): Promise<OrderRecord> {
  const nowMs = deps.now ? deps.now() : Date.now();
  const nowIso = new Date(nowMs).toISOString();

  if (!record.venueOrderId) {
    const failed = markFailed(record, 'No venue order id to cancel', nowIso);
    deps.upsertOrder(failed);
    recordObservabilityEvent({
      kind: 'trade_attempt',
      severity: 'error',
      ok: false,
      source: record.exchange,
      exchange: record.exchange,
      action: 'cancel_order',
      detail: `Cancel failed: No venue order id on ${record.clientOrderId}`,
      meta: { clientOrderId: record.clientOrderId },
    });
    return failed;
  }

  const cancelResult = await deps.cancelVenueOrder(
    record.venueOrderId,
    record.exchange,
    record.productId,
  );

  const next = cancelResult.success
    ? markCancelled(record, nowIso)
    : markFailed(record, cancelResult.error ?? 'Cancel failed', nowIso);
  deps.upsertOrder(next);

  recordObservabilityEvent({
    kind: 'trade_attempt',
    severity: next.state === 'cancelled' ? 'info' : 'error',
    ok: next.state === 'cancelled',
    source: record.exchange,
    exchange: record.exchange,
    action: 'cancel_order',
    detail: next.state === 'cancelled'
      ? `Order ${record.clientOrderId} cancelled on ${record.exchange}`
      : `Cancel failed on ${record.exchange}: ${next.error}`,
    meta: { clientOrderId: record.clientOrderId, venueOrderId: record.venueOrderId },
  });

  return next;
}

export interface PollOrderStatusDeps {
  pollVenueStatus: (
    venueOrderId: string,
    exchange: LiveTradingExchangeId,
    productId: string,
  ) => Promise<OrderStatusResult>;
}

/**
 * Query venue status for an open order.
 */
export async function pollOrderStatus(
  record: OrderRecord,
  deps: PollOrderStatusDeps,
): Promise<OrderStatusResult> {
  if (!record.venueOrderId) {
    return { status: 'unknown', error: 'No venue order id' };
  }
  return deps.pollVenueStatus(record.venueOrderId, record.exchange, record.productId);
}
