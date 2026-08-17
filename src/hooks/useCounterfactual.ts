import { useState, useEffect, useMemo, useCallback } from 'react';
import { useCounterfactualStore } from '@/store/counterfactualStore';
import { usePriceStore } from '@/store/priceStore';
import { usePortfolioStore } from '@/store/portfolioStore';
import { getMarketChartSeries, type MarketSeries } from '@lib/marketCache';
import {
  evaluateCounterfactualTrade,
  type CounterfactualEvaluation,
  type HypotheticalTrade,
  COUNTERFACTUAL_RANGE_DAYS,
} from '@lib/counterfactual';
import { getCurrentPrice } from '@components/portfolio/portfolioUtils';
import { resolvePortfolioAssetId } from '@lib/assets';
import { recordObservabilityEvent } from '@lib/observability';

export function useCounterfactual() {
  const store = useCounterfactualStore();
  const { prices, goldSpot } = usePriceStore();
  const { entries: portfolioEntries } = usePortfolioStore();

  const [fromSeries, setFromSeries] = useState<MarketSeries>([]);
  const [toSeries, setToSeries] = useState<MarketSeries>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goldPrice = goldSpot?.price ?? null;

  // Resolve current live prices
  const curPriceFrom = useMemo(() => {
    if (store.fromAsset === 'usd') return 1;
    return getCurrentPrice(store.fromAsset, prices, goldPrice) ?? 0;
  }, [store.fromAsset, prices, goldPrice]);

  const curPriceTo = useMemo(() => {
    if (store.toAsset === 'usd') return 1;
    return getCurrentPrice(store.toAsset, prices, goldPrice) ?? 0;
  }, [store.toAsset, prices, goldPrice]);

  // Compute trade timestamp
  const tradeTimestamp = useMemo(() => {
    if (store.customTimestamp) return store.customTimestamp;
    const daysAgo = COUNTERFACTUAL_RANGE_DAYS[store.selectedRange] ?? 30;
    return Date.now() - daysAgo * 86_400_000;
  }, [store.customTimestamp, store.selectedRange]);

  // Determine fetch days and interval for CoinGecko
  const { daysParam, intervalParam } = useMemo(() => {
    const daysAgo = Math.ceil((Date.now() - tradeTimestamp) / 86_400_000);
    if (daysAgo <= 7) return { daysParam: '7' as const, intervalParam: 'hourly' as const };
    if (daysAgo <= 14) return { daysParam: '14' as const, intervalParam: 'hourly' as const };
    if (daysAgo <= 30) return { daysParam: '30' as const, intervalParam: 'hourly' as const };
    if (daysAgo <= 60) return { daysParam: '60' as const, intervalParam: 'hourly' as const };
    if (daysAgo <= 90) return { daysParam: '90' as const, intervalParam: 'daily' as const };
    if (daysAgo <= 180) return { daysParam: '180' as const, intervalParam: 'daily' as const };
    return { daysParam: '365' as const, intervalParam: 'daily' as const };
  }, [tradeTimestamp]);

  // Fetch historical series when assets or horizon change
  useEffect(() => {
    let active = true;
    const ctrl = new AbortController();

    async function fetchSeries() {
      setIsLoading(true);
      setError(null);

      try {
        const promises: [Promise<MarketSeries>, Promise<MarketSeries>] = [
          store.fromAsset === 'usd'
            ? Promise.resolve([])
            : getMarketChartSeries(store.fromAsset, daysParam, intervalParam, { signal: ctrl.signal }),
          store.toAsset === 'usd'
            ? Promise.resolve([])
            : getMarketChartSeries(store.toAsset, daysParam, intervalParam, { signal: ctrl.signal }),
        ];

        const [fromRes, toRes] = await Promise.all(promises);

        if (!active) return;
        setFromSeries(fromRes);
        setToSeries(toRes);

        recordObservabilityEvent({
          kind: 'price_fetch',
          severity: 'info',
          ok: true,
          source: 'coingecko',
          detail: `Fetched historical series for ${store.fromAsset} -> ${store.toAsset} (${daysParam}d)`,
        });
      } catch (err: unknown) {
        if (!active) return;
        if (err instanceof Error && err.name === 'AbortError') return;
        const msg = err instanceof Error ? err.message : 'Failed to fetch historical prices';
        setError(msg);
        recordObservabilityEvent({
          kind: 'price_fetch',
          severity: 'warn',
          ok: false,
          source: 'coingecko',
          detail: `Failed to fetch historical series: ${msg}`,
        });
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void fetchSeries();

    return () => {
      active = false;
      ctrl.abort();
    };
  }, [store.fromAsset, store.toAsset, daysParam, intervalParam]);

  // Evaluate counterfactual result
  const evaluation: CounterfactualEvaluation | null = useMemo(() => {
    if (store.fromAmount <= 0) return null;

    const trade: HypotheticalTrade = {
      id: `cf-${store.fromAsset}-${store.toAsset}-${tradeTimestamp}`,
      fromAsset: store.fromAsset,
      toAsset: store.toAsset,
      fromAmount: store.fromAmount,
      timestamp: tradeTimestamp,
      feeBps: store.customFeeBps,
      exchangePreset: store.costPreset,
    };

    return evaluateCounterfactualTrade({
      trade,
      fromSeries,
      toSeries,
      currentPriceFrom: curPriceFrom,
      currentPriceTo: curPriceTo,
      currentTimestamp: Date.now(),
    });
  }, [
    store.fromAsset,
    store.toAsset,
    store.fromAmount,
    store.customFeeBps,
    store.costPreset,
    tradeTimestamp,
    fromSeries,
    toSeries,
    curPriceFrom,
    curPriceTo,
  ]);

  // Quick helper to seed from user's actual portfolio balance
  const seedFromHolding = useCallback((holdingId: string, percentage = 1.0) => {
    const entry = portfolioEntries.find((e) => e.id === holdingId);
    if (!entry) return;
    const assetId = resolvePortfolioAssetId(entry.symbol);
    const amount = entry.amount * percentage;
    store.seedFromPortfolio(assetId, amount);
  }, [portfolioEntries, store]);

  return {
    ...store,
    curPriceFrom,
    curPriceTo,
    tradeTimestamp,
    evaluation,
    isLoading,
    error,
    portfolioEntries,
    seedFromHolding,
  };
}
