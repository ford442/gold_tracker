import { supabase } from '@lib/supabase';
import { recordObservabilityEvent } from '@lib/observability';
import type { TradeOrder, PlaceTradeResponse, OrderStatusResult, CancelOrderResult } from '@lib/orderTypes';
import type { Exchange } from '@/store/settingsStore';

export const tradeService = {
  async storeKeys(exchange: Exchange, keys: Record<string, string>) {
    const start = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke<{ success?: boolean }>('store-key', {
        body: { exchange, ...keys },
      });
      const latencyMs = performance.now() - start;
      if (error) {
        recordObservabilityEvent({
          kind: 'edge_invoke',
          severity: 'error',
          ok: false,
          source: 'edge:store-key',
          exchange,
          action: 'store_keys',
          latencyMs,
          detail: `store-key Edge Function error on ${exchange}: ${error.message}`,
        });
        throw error;
      }
      recordObservabilityEvent({
        kind: 'edge_invoke',
        severity: 'info',
        ok: true,
        source: 'edge:store-key',
        exchange,
        action: 'store_keys',
        latencyMs,
        detail: `Stored encrypted API keys for ${exchange}`,
      });
      return data;
    } catch (err) {
      if (!(err as { message?: string })?.message?.includes('store-key Edge Function error')) {
        recordObservabilityEvent({
          kind: 'edge_invoke',
          severity: 'error',
          ok: false,
          source: 'edge:store-key',
          exchange,
          action: 'store_keys',
          latencyMs: performance.now() - start,
          detail: `store-key failed for ${exchange}: ${err instanceof Error ? err.message : 'Unknown error'}`,
        });
      }
      throw err;
    }
  },

  async testConnectionServerSide(exchange: Exchange): Promise<boolean> {
    const start = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke<PlaceTradeResponse>('place-trade', {
        body: { exchange, testOnly: true },
      });
      const latencyMs = performance.now() - start;
      const success = !error && Boolean(data?.success);
      recordObservabilityEvent({
        kind: 'edge_invoke',
        severity: success ? 'success' : 'error',
        ok: success,
        source: 'edge:place-trade',
        exchange,
        action: 'test_connection',
        latencyMs,
        detail: success
          ? `Server connection test passed for ${exchange}`
          : `Server connection test failed for ${exchange}: ${error?.message ?? 'Unknown failure'}`,
      });
      if (error) {
        console.error('Test connection error:', error);
        return false;
      }
      return data?.success ?? false;
    } catch (err) {
      recordObservabilityEvent({
        kind: 'edge_invoke',
        severity: 'error',
        ok: false,
        source: 'edge:place-trade',
        exchange,
        action: 'test_connection',
        latencyMs: performance.now() - start,
        detail: `Server connection test exception for ${exchange}: ${err instanceof Error ? err.message : 'Network error'}`,
      });
      return false;
    }
  },

  async executeTrade(
    order: TradeOrder,
    dryRun: boolean,
    exchange: Exchange,
    options?: {
      clientOrderId?: string;
      idempotencyKey?: string;
      source?: string;
    },
  ): Promise<PlaceTradeResponse> {
    const start = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke<PlaceTradeResponse>('place-trade', {
        body: {
          order,
          dryRun,
          exchange,
          clientOrderId: options?.clientOrderId,
          idempotencyKey: options?.idempotencyKey,
          source: options?.source,
        },
      });
      const latencyMs = performance.now() - start;
      if (error) {
        recordObservabilityEvent({
          kind: 'edge_invoke',
          severity: 'error',
          ok: false,
          source: 'edge:place-trade',
          exchange,
          action: 'execute_trade',
          latencyMs,
          detail: `place-trade Edge Function error for ${exchange}: ${error.message}`,
        });
        throw error;
      }
      if (!data) {
        throw new Error('Empty response from place-trade');
      }
      recordObservabilityEvent({
        kind: 'edge_invoke',
        severity: data.success ? 'success' : 'error',
        ok: data.success,
        source: 'edge:place-trade',
        exchange,
        action: 'execute_trade',
        latencyMs,
        detail: data.success
          ? `place-trade Edge Function executed on ${exchange}: ${data.order_id ?? 'OK'}`
          : `place-trade Edge Function rejected on ${exchange}: ${data.error ?? 'Unknown'}`,
      });
      return data;
    } catch (err) {
      recordObservabilityEvent({
        kind: 'edge_invoke',
        severity: 'error',
        ok: false,
        source: 'edge:place-trade',
        exchange,
        action: 'execute_trade',
        latencyMs: performance.now() - start,
        detail: `place-trade Edge Function exception on ${exchange}: ${err instanceof Error ? err.message : 'Network error'}`,
      });
      throw err;
    }
  },

  async getOrderStatus(
    orderId: string,
    exchange: Exchange,
    productId: string,
  ): Promise<OrderStatusResult> {
    const start = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke<OrderStatusResult>('place-trade', {
        body: { action: 'status', orderId, exchange, productId },
      });
      const latencyMs = performance.now() - start;
      if (error) {
        recordObservabilityEvent({
          kind: 'edge_invoke',
          severity: 'error',
          ok: false,
          source: 'edge:place-trade',
          exchange,
          action: 'get_order_status',
          latencyMs,
          detail: `place-trade status query error for ${orderId}: ${error.message}`,
        });
        throw error;
      }
      return data ?? { status: 'unknown', error: 'Empty status response' };
    } catch (err) {
      recordObservabilityEvent({
        kind: 'edge_invoke',
        severity: 'warn',
        ok: false,
        source: 'edge:place-trade',
        exchange,
        action: 'get_order_status',
        latencyMs: performance.now() - start,
        detail: `place-trade status query exception for ${orderId}: ${err instanceof Error ? err.message : 'Network error'}`,
      });
      throw err;
    }
  },

  async cancelOrder(
    orderId: string,
    exchange: Exchange,
    productId: string,
  ): Promise<CancelOrderResult> {
    const start = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke<CancelOrderResult>('place-trade', {
        body: { action: 'cancel', orderId, exchange, productId },
      });
      const latencyMs = performance.now() - start;
      if (error) {
        recordObservabilityEvent({
          kind: 'edge_invoke',
          severity: 'error',
          ok: false,
          source: 'edge:place-trade',
          exchange,
          action: 'cancel_order',
          latencyMs,
          detail: `place-trade cancel query error for ${orderId}: ${error.message}`,
        });
        throw error;
      }
      return data ?? { success: false, error: 'Empty cancel response' };
    } catch (err) {
      recordObservabilityEvent({
        kind: 'edge_invoke',
        severity: 'error',
        ok: false,
        source: 'edge:place-trade',
        exchange,
        action: 'cancel_order',
        latencyMs: performance.now() - start,
        detail: `place-trade cancel exception for ${orderId}: ${err instanceof Error ? err.message : 'Network error'}`,
      });
      throw err;
    }
  },
};
