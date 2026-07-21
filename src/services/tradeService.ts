import { supabase } from '@lib/supabase';
import type { TradeOrder, PlaceTradeResponse, OrderStatusResult, CancelOrderResult } from '@lib/orderTypes';
import type { Exchange } from '@/store/settingsStore';

export const tradeService = {
  async storeKeys(exchange: Exchange, keys: Record<string, string>) {
    const { data, error } = await supabase.functions.invoke<{ success?: boolean }>('store-key', {
      body: { exchange, ...keys },
    });
    if (error) throw error;
    return data;
  },

  async testConnectionServerSide(exchange: Exchange): Promise<boolean> {
    const { data, error } = await supabase.functions.invoke<PlaceTradeResponse>('place-trade', {
      body: { exchange, testOnly: true },
    });
    if (error) {
      console.error('Test connection error:', error);
      return false;
    }
    return data?.success ?? false;
  },

  async executeTrade(
    order: TradeOrder,
    dryRun: boolean,
    exchange: Exchange,
  ): Promise<PlaceTradeResponse> {
    const { data, error } = await supabase.functions.invoke<PlaceTradeResponse>('place-trade', {
      body: { order, dryRun, exchange },
    });
    if (error) throw error;
    if (!data) {
      throw new Error('Empty response from place-trade');
    }
    return data;
  },

  async getOrderStatus(
    orderId: string,
    exchange: Exchange,
    productId: string,
  ): Promise<OrderStatusResult> {
    const { data, error } = await supabase.functions.invoke<OrderStatusResult>('place-trade', {
      body: { action: 'status', orderId, exchange, productId },
    });
    if (error) throw error;
    return data ?? { status: 'unknown', error: 'Empty status response' };
  },

  async cancelOrder(
    orderId: string,
    exchange: Exchange,
    productId: string,
  ): Promise<CancelOrderResult> {
    const { data, error } = await supabase.functions.invoke<CancelOrderResult>('place-trade', {
      body: { action: 'cancel', orderId, exchange, productId },
    });
    if (error) throw error;
    return data ?? { success: false, error: 'Empty cancel response' };
  },
};
