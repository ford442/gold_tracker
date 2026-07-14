import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/useAuthStore';
import { usePriceStore } from '@/store/priceStore';
import { usePaperTradeStore } from '@/store/paperTradeStore';
import { tradeService } from '@/services/tradeService';
import type { TradeOrder, OrderResult } from '@lib/coinbaseTrader';
import { getAdapter } from '@lib/exchangeAdapters';
import { baseSymbolFromProductId, buildPaperFill } from '@lib/paperTrade';
import { fromSymbol } from '@lib/assets';
import type { TradeSuggestion } from '@/types/TradeSuggestion';

interface UseTradeExecutionOptions {
  onKrakenAuthRequired: () => void;
}

export function useTradeExecution({ onKrakenAuthRequired }: UseTradeExecutionOptions) {
  const { dryRun, maxTradeSize, selectedExchange } = useSettingsStore();
  const { user } = useAuthStore();
  const { prices, goldSpot } = usePriceStore();
  const recordFill = usePaperTradeStore((s) => s.recordFill);
  const [executingId, setExecutingId] = useState<string | null>(null);

  const priceForProduct = (productId: string): number => {
    const asset = fromSymbol(baseSymbolFromProductId(productId));
    if (!asset) return 0;
    if (asset.id === 'gold') return goldSpot?.price ?? 0;
    return prices[asset.id]?.price ?? 0;
  };

  const handleExecuteTrade = async (suggestion: TradeSuggestion) => {
    if (executingId) return;

    setExecutingId(suggestion.id);

    // Dry run == PAPER trade: record a simulated fill to the local ledger and
    // return without touching any exchange API, so practice needs no live keys
    // and can never be mistaken for a real order.
    if (dryRun) {
      const fill = buildPaperFill({
        suggestion,
        units: maxTradeSize,
        price: priceForProduct(suggestion.productId),
        exchange: selectedExchange,
      });
      recordFill(fill);
      toast.success(
        <div className="flex flex-col">
          <span className="font-semibold">🧪 PAPER TRADE recorded</span>
          <span className="text-sm">
            {fill.side} {fill.units} {fill.symbol} @ ${fill.price.toLocaleString()} · est. fee ${fill.feeUsd.toFixed(2)}
          </span>
          <span className="text-xs text-gray-500 mt-1">
            Simulated only — no funds moved. See the Paper Ledger on the Portfolio tab.
          </span>
        </div>,
        { duration: 5000, icon: '🧪' },
      );
      setExecutingId(null);
      return;
    }

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
        const adapter = getAdapter(selectedExchange);
        if (!adapter || !adapter.config.canTrade || selectedExchange === 'kraken') {
          toast.error(
            `${adapter?.config.label ?? selectedExchange} trading requires Supabase login. Please sign in in Settings.`,
            { id: toastId },
          );
          setExecutingId(null);
          onKrakenAuthRequired();
          return;
        }
        result = await adapter.placeOrder(order, dryRun, {});
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
