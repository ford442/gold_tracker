import { useCallback, useMemo } from 'react';
import { resolvePortfolioAssetId } from '@lib/assets';
import {
  assembleRiskCheckInput,
  evaluateTradeRisk,
  riskLimitsFromSettings,
  RISK_ENGINE_NFA_COPY,
  type ProposedOrderRisk,
  type RiskCheckResult,
} from '@lib/riskEngine';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useSettingsStore } from '@/store/settingsStore';
import { usePriceStore } from '@/store/priceStore';
import { useOrderStore } from '@/store/orderStore';
import { usePaperTradeStore } from '@/store/paperTradeStore';
import { isStablecoin } from '@lib/assets';

function buildPriceMap(
  prices: Record<string, { price: number }>,
  goldPrice: number | null,
): Record<string, number> {
  const map: Record<string, number> = {};
  if (goldPrice != null && goldPrice > 0) map.gold = goldPrice;
  for (const [id, data] of Object.entries(prices)) {
    if (data?.price > 0) map[id] = data.price;
  }
  if (!map['usd-coin']) map['usd-coin'] = 1;
  for (const id of Object.keys(map)) {
    if (isStablecoin(id)) map[id] = 1;
  }
  return map;
}

export function useRiskContext() {
  const entries = usePortfolioStore((s) => s.entries);
  const {
    maxTradeSize,
    maxSingleTradeNotionalUsd,
    maxGoldSleevePct,
    dailyLossLimit,
    maxOpenOrders,
    killSwitch,
    allowPaperDespiteKillSwitch,
    riskDayAnchor,
    setRiskDayAnchor,
  } = useSettingsStore();
  const { prices, goldSpot } = usePriceStore();
  const orders = useOrderStore((s) => s.orders);
  const paperFills = usePaperTradeStore((s) => s.fills);

  const goldPrice = goldSpot?.price ?? null;
  const priceMap = useMemo(
    () => buildPriceMap(prices, goldPrice),
    [prices, goldPrice],
  );

  const holdings = useMemo(() => {
    const list: { assetId: string; units: number }[] = [];
    for (const e of entries) {
      const assetId = resolvePortfolioAssetId(e.symbol);
      if (assetId) list.push({ assetId, units: e.amount });
    }
    return list;
  }, [entries]);

  const limits = useMemo(
    () =>
      riskLimitsFromSettings({
        maxTradeSize,
        maxSingleTradeNotionalUsd,
        maxGoldSleevePct,
        dailyLossLimit,
        maxOpenOrders,
        killSwitch,
        allowPaperDespiteKillSwitch,
      }),
    [
      maxTradeSize,
      maxSingleTradeNotionalUsd,
      maxGoldSleevePct,
      dailyLossLimit,
      maxOpenOrders,
      killSwitch,
      allowPaperDespiteKillSwitch,
    ],
  );

  const checkOrderRisk = useCallback(
    (order: ProposedOrderRisk): RiskCheckResult => {
      const { input, nextAnchor } = assembleRiskCheckInput({
        limits,
        holdings,
        prices: priceMap,
        order,
        orders,
        paperFills,
        anchor: riskDayAnchor,
      });

      if (
        !riskDayAnchor ||
        riskDayAnchor.date !== nextAnchor.date ||
        riskDayAnchor.startEquityUsd !== nextAnchor.startEquityUsd
      ) {
        setRiskDayAnchor(nextAnchor);
      }

      return evaluateTradeRisk(input);
    },
    [
      limits,
      holdings,
      priceMap,
      orders,
      paperFills,
      riskDayAnchor,
      setRiskDayAnchor,
    ],
  );

  return { checkOrderRisk, nfaCopy: RISK_ENGINE_NFA_COPY, priceMap };
}
