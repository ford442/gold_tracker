/**
 * Shared order execution orchestrator — routes to server (Supabase) or local adapter,
 * with durable order journal writes (issue #33 lifecycle).
 */

import { tradeService } from '@/services/tradeService';
import type { Exchange } from '@/store/settingsStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useOrderStore } from '@/store/orderStore';
import { usePortfolioStore } from '@/store/portfolioStore';
import { usePaperTradeStore } from '@/store/paperTradeStore';
import { resolvePortfolioAssetId } from './assets';
import {
  assembleRiskCheckInput,
  evaluateTradeRisk,
  riskLimitsFromSettings,
  type RiskCheckResult,
} from './riskEngine';
import {
  getAdapter,
  adapterCredentialsFromSettings,
  canExecuteLocally,
  type AdapterCredentials,
} from './exchangeAdapters';
import type { TradeOrder, PlaceTradeResponse } from './orderTypes';
import {
  applyPaperFill,
  applyPlaceResult,
  buildIdempotencyKey,
  createPendingOrder,
  findBlockingOrder,
  generateClientOrderId,
  markCancelled,
  markFailed,
  type OrderMode,
  type OrderRecord,
} from './orderLifecycle';

export interface ExecuteOrderOptions {
  order: TradeOrder;
  dryRun: boolean;
  exchange: Exchange;
  user: { id: string } | null;
  creds?: AdapterCredentials;
  /** Originating context for journal traceability. */
  source?: string;
  /** When set, links paper fill after simulated execution. */
  paperFillId?: string;
  /** Override mode; defaults to dryRun ? 'paper' : 'live'. */
  mode?: OrderMode;
  /** Asset prices for risk checks (assetId → USD). */
  riskPrices?: Record<string, number>;
  /** Reference unit price for notional risk checks. */
  unitPriceUsd?: number;
}

export interface ExecuteOrderResult {
  result: PlaceTradeResponse;
  record?: OrderRecord;
}

export class OrderExecutionError extends Error {
  exchange: Exchange;

  constructor(message: string, exchange: Exchange) {
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

export function runRiskGate(
  order: TradeOrder,
  mode: OrderMode,
  unitPriceUsd: number,
  riskPrices: Record<string, number> = {},
): RiskCheckResult {
  const settings = useSettingsStore.getState();
  const limits = riskLimitsFromSettings(settings);
  const holdings = usePortfolioStore
    .getState()
    .entries.reduce<{ assetId: string; units: number }[]>((acc, e) => {
      const assetId = resolvePortfolioAssetId(e.symbol);
      if (assetId) acc.push({ assetId, units: e.amount });
      return acc;
    }, []);

  const { input, nextAnchor } = assembleRiskCheckInput({
    limits,
    holdings,
    prices: riskPrices,
    order: {
      productId: order.product_id,
      side: order.side,
      requestedQty: requestedQtyFromOrder(order),
      unitPriceUsd,
      mode,
    },
    orders: useOrderStore.getState().orders,
    paperFills: usePaperTradeStore.getState().fills,
    anchor: settings.riskDayAnchor,
  });

  if (
    !settings.riskDayAnchor ||
    settings.riskDayAnchor.date !== nextAnchor.date ||
    settings.riskDayAnchor.startEquityUsd !== nextAnchor.startEquityUsd
  ) {
    useSettingsStore.getState().setRiskDayAnchor(nextAnchor);
  }

  return evaluateTradeRisk(input);
}

async function routeOrder(
  order: TradeOrder,
  dryRun: boolean,
  exchange: Exchange,
  user: { id: string } | null,
  creds?: AdapterCredentials,
): Promise<PlaceTradeResponse> {
  if (user) {
    return tradeService.executeTrade(order, dryRun, exchange);
  }

  const path = canExecuteLocally(exchange, user);
  if (path === 'unsupported') {
    const adapter = getAdapter(exchange);
    throw new OrderExecutionError(
      `${adapter?.config.label ?? exchange} trading requires Supabase login. Please sign in in Settings.`,
      exchange,
    );
  }

  const adapter = getAdapter(exchange);
  if (!adapter) {
    throw new OrderExecutionError(`Unknown exchange: ${exchange}`, exchange);
  }

  const resolvedCreds =
    creds ?? adapterCredentialsFromSettings(useSettingsStore.getState());

  return adapter.placeOrder(order, dryRun, resolvedCreds);
}

/**
 * Execute an order with durable journal writes: pending before venue call,
 * then submitted/filled/failed from the response.
 */
export async function executeOrderWithLifecycle(
  opts: ExecuteOrderOptions,
): Promise<ExecuteOrderResult> {
  const { order, dryRun, exchange, user, creds, source, paperFillId, riskPrices, unitPriceUsd } =
    opts;
  const mode = opts.mode ?? (dryRun ? 'paper' : 'live');
  const requestedQty = requestedQtyFromOrder(order);

  const risk = runRiskGate(order, mode, unitPriceUsd ?? 0, riskPrices ?? {});
  if (!risk.allowed) {
    return {
      result: {
        success: false,
        error: risk.reasons.join(' · '),
      },
    };
  }

  const idempotencyKey = buildIdempotencyKey(
    exchange,
    order.product_id,
    order.side,
    requestedQty,
    source,
  );

  const store = useOrderStore.getState();
  const blocking = findBlockingOrder(store.orders, idempotencyKey);
  if (blocking) {
    return {
      result: { success: false, error: 'Duplicate order in flight' },
      record: blocking,
    };
  }

  const clientOrderId = generateClientOrderId();
  let record = createPendingOrder({
    clientOrderId,
    exchange,
    mode,
    productId: order.product_id,
    side: order.side,
    requestedQty,
    source,
    idempotencyKey,
  });

  store.upsertOrder(record);

  // Paper mode: simulate fill without venue API.
  if (mode === 'paper') {
    record = applyPaperFill(
      record,
      paperFillId ?? `sim-${clientOrderId}`,
      requestedQty,
      0,
    );
    store.upsertOrder(record);
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

  try {
    const result = await routeOrder(order, dryRun, exchange, user, creds);
    record = applyPlaceResult(record, result);
    store.upsertOrder(record);
    return { result, record };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown execution error';
    record = markFailed(record, message);
    store.upsertOrder(record);
    throw err;
  }
}

/** @deprecated Use executeOrderWithLifecycle for journal writes. */
export async function executeOrder(opts: ExecuteOrderOptions): Promise<PlaceTradeResponse> {
  const { result } = await executeOrderWithLifecycle(opts);
  return result;
}

export async function cancelOrderWithLifecycle(
  record: OrderRecord,
  user: { id: string } | null,
): Promise<OrderRecord> {
  if (!record.venueOrderId) {
    const failed = markFailed(record, 'No venue order id to cancel');
    useOrderStore.getState().upsertOrder(failed);
    return failed;
  }

  let cancelResult;
  if (user) {
    cancelResult = await tradeService.cancelOrder(
      record.venueOrderId,
      record.exchange,
      record.productId,
    );
  } else {
    const adapter = getAdapter(record.exchange);
    if (!adapter?.cancelOrder) {
      const failed = markFailed(record, 'Cancel not supported for this venue locally');
      useOrderStore.getState().upsertOrder(failed);
      return failed;
    }
    const creds = adapterCredentialsFromSettings(useSettingsStore.getState());
    cancelResult = await adapter.cancelOrder(record.venueOrderId, record.productId, creds);
  }

  const next = cancelResult.success
    ? markCancelled(record)
    : markFailed(record, cancelResult.error ?? 'Cancel failed');
  useOrderStore.getState().upsertOrder(next);
  return next;
}

export async function pollOrderStatus(
  record: OrderRecord,
  user: { id: string } | null,
): Promise<import('./orderTypes').OrderStatusResult> {
  if (!record.venueOrderId) {
    return { status: 'unknown', error: 'No venue order id' };
  }

  if (user) {
    return tradeService.getOrderStatus(record.venueOrderId, record.exchange, record.productId);
  }

  const adapter = getAdapter(record.exchange);
  if (!adapter?.getOrderStatus) {
    return { status: 'unknown', error: 'Status poll not supported locally' };
  }

  const creds = adapterCredentialsFromSettings(useSettingsStore.getState());
  return adapter.getOrderStatus(record.venueOrderId, record.productId, creds);
}
