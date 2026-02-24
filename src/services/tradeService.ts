import { supabase } from '../lib/supabase';
import type { TradeOrder, OrderResult } from '../lib/coinbaseTrader';
import type { Exchange } from '../store/settingsStore';

export const tradeService = {
  async storeKeys(exchange: Exchange, keys: Record<string, string>) {
    const { data, error } = await supabase.functions.invoke('store-key', {
      body: { exchange, ...keys },
    });
    if (error) throw error;
    return data;
  },

  async testConnectionServerSide(exchange: Exchange): Promise<boolean> {
    const { data, error } = await supabase.functions.invoke('place-trade', {
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
    exchange: Exchange
  ): Promise<OrderResult & { message?: string; exchange?: string }> {
    const { data, error } = await supabase.functions.invoke('place-trade', {
      body: { order, dryRun, exchange },
    });
    if (error) throw error;
    return data;
  },
};
