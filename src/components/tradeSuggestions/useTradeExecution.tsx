import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/useAuthStore';
import { tradeService } from '@/services/tradeService';
import { placeOrder } from '@lib/coinbaseTrader';
import type { TradeOrder, OrderResult } from '@lib/coinbaseTrader';
import type { TradeSuggestion } from '@/types/TradeSuggestion';

interface UseTradeExecutionOptions {
  onKrakenAuthRequired: () => void;
}

export function useTradeExecution({ onKrakenAuthRequired }: UseTradeExecutionOptions) {
  const { dryRun, maxTradeSize, selectedExchange } = useSettingsStore();
  const { user } = useAuthStore();
  const [executingId, setExecutingId] = useState<string | null>(null);

  const handleExecuteTrade = async (suggestion: TradeSuggestion) => {
    if (executingId) return;

    setExecutingId(suggestion.id);

    const toastId = toast.loading(
      `Executing ${suggestion.action} on ${selectedExchange.toUpperCase()}...`,
      { duration: 30000 },
    );

    try {
      const order: TradeOrder = {
        product_id: suggestion.productId,
        side: suggestion.side,
        order_configuration: {
          market_market_ioc: { base_size: maxTradeSize.toString() },
        },
      };

      let result: OrderResult & { message?: string; exchange?: string };

      if (user) {
        result = await tradeService.executeTrade(order, dryRun, selectedExchange);
      } else {
        if (selectedExchange === 'kraken') {
          toast.error('Kraken trading requires Supabase login. Please sign in in Settings.', {
            id: toastId,
          });
          setExecutingId(null);
          onKrakenAuthRequired();
          return;
        }
        result = await placeOrder(order, dryRun);
      }

      if (result.success) {
        const message = result.message || `Trade executed on ${result.exchange || selectedExchange}`;
        toast.success(
          <div className="flex flex-col">
            <span className="font-semibold">✅ {dryRun ? 'DRY RUN' : 'Success'}!</span>
            <span className="text-sm">{message}</span>
            {result.order_id && (
              <span className="text-xs text-gray-500 font-mono mt-1">
                Order: {result.order_id.slice(0, 20)}...
              </span>
            )}
          </div>,
          {
            id: toastId,
            duration: 5000,
            icon: dryRun ? '🔒' : '✅',
          },
        );
      } else {
        toast.error(
          <div className="flex flex-col">
            <span className="font-semibold">❌ Trade Failed</span>
            <span className="text-sm">{result.error || 'Unknown error'}</span>
          </div>,
          {
            id: toastId,
            duration: 6000,
          },
        );
      }
    } catch (err) {
      toast.error(
        <div className="flex flex-col">
          <span className="font-semibold">❌ Execution Error</span>
          <span className="text-sm">{err instanceof Error ? err.message : 'Unknown error'}</span>
        </div>,
        {
          id: toastId,
          duration: 6000,
        },
      );
    } finally {
      setExecutingId(null);
    }
  };

  return { executingId, handleExecuteTrade, dryRun, selectedExchange };
}
