import { useCallback } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { useOrderStore } from '@/store/orderStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useRiskContext } from '@/hooks/useRiskContext';
import { tradeService } from '@/services/tradeService';
import { orderJournalService } from '@/services/orderJournalService';
import {
  getAdapter,
  adapterCredentialsFromSettings,
  canExecuteLocally,
  type AdapterCredentials,
} from '@lib/exchangeAdapters';
import type { LiveTradingExchangeId } from '@lib/exchanges';
import {
  executeOrderWithLifecycle,
  cancelOrderWithLifecycle,
  pollOrderStatus as purePollOrderStatus,
  OrderExecutionError,
  requestedQtyFromOrder,
  type ExecuteOrderParams,
  type ExecuteOrderResult,
  type OrderExecutionDeps,
  type CancelOrderDeps,
  type PollOrderStatusDeps,
} from '@lib/executeOrder';
import type {
  CancelOrderResult,
  OrderStatusResult,
  PlaceTradeResponse,
  TradeOrder,
} from '@lib/orderTypes';
import type { OrderMode, OrderRecord } from '@lib/orderLifecycle';

export interface ExecuteOrderHookOptions extends ExecuteOrderParams {
  creds?: AdapterCredentials;
}

export { OrderExecutionError };

/**
 * React hook wiring Zustand stores, auth, pre-trade risk checks,
 * and exchange adapters into the pure order lifecycle orchestrator.
 */
export function useOrderExecution() {
  const { user } = useAuthStore();
  const { checkOrderRisk } = useRiskContext();
  const upsertLocalOrder = useOrderStore((s) => s.upsertOrder);

  const notifyJournal = useCallback(
    (record: OrderRecord) => {
      upsertLocalOrder(record);
      if (user?.id) {
        void orderJournalService.upsertOrder(record, user.id);
      }
    },
    [upsertLocalOrder, user],
  );

  const routeOrder = useCallback(
    async (
      order: TradeOrder,
      dryRun: boolean,
      exchange: LiveTradingExchangeId,
      meta: { clientOrderId: string; idempotencyKey: string; source?: string },
      credsOverride?: AdapterCredentials,
    ): Promise<PlaceTradeResponse> => {
      if (user) {
        return tradeService.executeTrade(order, dryRun, exchange, meta);
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
        credsOverride ?? adapterCredentialsFromSettings(useSettingsStore.getState());

      return adapter.placeOrder(order, dryRun, resolvedCreds);
    },
    [user],
  );

  const cancelVenueOrder = useCallback(
    async (
      venueOrderId: string,
      exchange: LiveTradingExchangeId,
      productId: string,
    ): Promise<CancelOrderResult> => {
      if (user) {
        return tradeService.cancelOrder(venueOrderId, exchange, productId);
      }

      const adapter = getAdapter(exchange);
      if (!adapter?.cancelOrder) {
        return {
          success: false,
          error: 'Cancel not supported for this venue locally',
        };
      }

      const creds = adapterCredentialsFromSettings(useSettingsStore.getState());
      return adapter.cancelOrder(venueOrderId, productId, creds);
    },
    [user],
  );

  const pollVenueStatus = useCallback(
    async (
      venueOrderId: string,
      exchange: LiveTradingExchangeId,
      productId: string,
    ): Promise<OrderStatusResult> => {
      if (user) {
        return tradeService.getOrderStatus(venueOrderId, exchange, productId);
      }

      const adapter = getAdapter(exchange);
      if (!adapter?.getOrderStatus) {
        return { status: 'unknown', error: 'Status poll not supported locally' };
      }

      const creds = adapterCredentialsFromSettings(useSettingsStore.getState());
      return adapter.getOrderStatus(venueOrderId, productId, creds);
    },
    [user],
  );

  const executeOrder = useCallback(
    async (options: ExecuteOrderHookOptions): Promise<ExecuteOrderResult> => {
      const deps: OrderExecutionDeps = {
        evaluateRisk: (order: TradeOrder, mode: OrderMode) => {
          const unitPrice = options.unitPriceUsd ?? 0;
          return checkOrderRisk({
            productId: order.product_id,
            side: order.side,
            requestedQty: requestedQtyFromOrder(order),
            unitPriceUsd: unitPrice,
            mode,
          });
        },
        upsertOrder: notifyJournal,
        getOrders: () => useOrderStore.getState().orders,
        routeOrder: (order, dryRun, exchange, meta) =>
          routeOrder(order, dryRun, exchange, meta, options.creds),
      };

      return executeOrderWithLifecycle(options, deps);
    },
    [checkOrderRisk, notifyJournal, routeOrder],
  );

  const cancelOrder = useCallback(
    async (record: OrderRecord): Promise<OrderRecord> => {
      const deps: CancelOrderDeps = {
        upsertOrder: notifyJournal,
        cancelVenueOrder,
      };
      return cancelOrderWithLifecycle(record, deps);
    },
    [cancelVenueOrder, notifyJournal],
  );

  const pollStatus = useCallback(
    async (record: OrderRecord): Promise<OrderStatusResult> => {
      const deps: PollOrderStatusDeps = {
        pollVenueStatus,
      };
      return purePollOrderStatus(record, deps);
    },
    [pollVenueStatus],
  );

  return {
    executeOrder,
    cancelOrder,
    pollStatus,
    notifyJournal,
    routeOrder,
    cancelVenueOrder,
    pollVenueStatus,
  };
}
