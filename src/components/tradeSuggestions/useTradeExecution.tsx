import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/useAuthStore';
import { usePriceStore } from '@/store/priceStore';
import { usePaperTradeStore } from '@/store/paperTradeStore';
import { useRiskContext } from '@/hooks/useRiskContext';
import { buildMarketIocOrder } from '@lib/orderTypes';
import { executeOrderWithLifecycle, OrderExecutionError } from '@lib/executeOrder';
import { baseSymbolFromProductId, buildPaperFill } from '@lib/paperTrade';
import { fromSymbol } from '@lib/assets';
import type { TradeSuggestion } from '@/types/TradeSuggestion';

interface UseTradeExecutionOptions {
  onKrakenAuthRequired: () => void;
}

function showRiskBlockToast(reasons: string[], nfaCopy: string) {
  toast.error(
    <div className="flex flex-col">
      <span className="font-semibold">Risk guardrail blocked trade</span>
      <ul className="text-sm mt-1 list-disc pl-4">
        {reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <span className="text-xs text-gray-500 mt-2">{nfaCopy}</span>
    </div>,
    { duration: 7000 },
  );
}

export function useTradeExecution({ onKrakenAuthRequired }: UseTradeExecutionOptions) {
  const { dryRun, maxTradeSize, selectedExchange } = useSettingsStore();
  const { user } = useAuthStore();
  const { prices, goldSpot } = usePriceStore();
  const recordFill = usePaperTradeStore((s) => s.recordFill);
  const { checkOrderRisk, nfaCopy, priceMap } = useRiskContext();
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

    const unitPrice = priceForProduct(suggestion.productId);
    const mode = dryRun ? 'paper' : 'live';
    let qty = maxTradeSize;

    const risk = checkOrderRisk({
      productId: suggestion.productId,
      side: suggestion.side,
      requestedQty: qty,
      unitPriceUsd: unitPrice,
      mode,
    });

    if (!risk.allowed) {
      showRiskBlockToast(risk.reasons, nfaCopy);
      setExecutingId(null);
      return;
    }

    if (risk.adjustedQty !== undefined && risk.adjustedQty > 0) {
      qty = risk.adjustedQty;
    }

    const order = buildMarketIocOrder(suggestion.productId, suggestion.side, qty);

    if (dryRun) {
      const fill = buildPaperFill({
        suggestion,
        units: qty,
        price: unitPrice,
        exchange: selectedExchange,
      });
      recordFill(fill);

      await executeOrderWithLifecycle({
        order,
        dryRun: true,
        exchange: selectedExchange,
        user,
        source: suggestion.id,
        mode: 'paper',
        paperFillId: fill.id,
        riskPrices: priceMap,
        unitPriceUsd: unitPrice,
      });

      toast.success(
        <div className="flex flex-col">
          <span className="font-semibold">🧪 PAPER TRADE recorded</span>
          <span className="text-sm">
            {fill.side} {fill.units} {fill.symbol} @ ${fill.price.toLocaleString()} · est. fee ${fill.feeUsd.toFixed(2)}
          </span>
          <span className="text-xs text-gray-500 mt-1">
            Simulated only — no funds moved. See Order Journal and Paper Ledger on Portfolio.
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
      const { result } = await executeOrderWithLifecycle({
        order,
        dryRun: false,
        exchange: selectedExchange,
        user,
        source: suggestion.id,
        mode: 'live',
        riskPrices: priceMap,
        unitPriceUsd: unitPrice,
      });

      if (result.success) {
        const message = result.message || `Trade executed on ${result.exchange || selectedExchange}`;
        toast.success(
          <div className="flex flex-col">
            <span className="font-semibold">✅ Success!</span>
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
            icon: '✅',
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
      if (err instanceof OrderExecutionError) {
        toast.error(err.message, { id: toastId, duration: 6000 });
        onKrakenAuthRequired();
      } else {
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
      }
    } finally {
      setExecutingId(null);
    }
  };

  return { executingId, handleExecuteTrade, dryRun, selectedExchange };
}
