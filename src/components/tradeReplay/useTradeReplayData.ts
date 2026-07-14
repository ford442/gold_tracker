/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useMemo, useRef, useEffect } from 'react';
import { usePriceStore } from '@/store/priceStore';
import type { ChartRange, ScenarioMode, SparklinePoint } from '@/types';
import { RANGE_PARAMS } from './constants';
import { addProjections, computeReplayStats, generateReplayData } from './replayData';

export function useTradeReplayData(
  selectedAssetId: string,
  range: ChartRange,
  scenario: ScenarioMode,
) {
  const { prices, goldSpot } = usePriceStore();
  const [historicalData, setHistoricalData] = useState<SparklinePoint[] | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const { days, interval } = RANGE_PARAMS[range];
    const apiKey = import.meta.env.VITE_COINGECKO_API_KEY as string | undefined;
    const headers: HeadersInit = apiKey ? { 'x-cg-demo-api-key': apiKey } : {};

    setIsLoadingHistory(true);
    setHistoricalData(null);

    fetch(
      `https://api.coingecko.com/api/v3/coins/${selectedAssetId}/market_chart?vs_currency=usd&days=${days}&interval=${interval}`,
      { signal: controller.signal, headers },
    )
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: { prices: [number, number][] }) => {
        const pts: SparklinePoint[] = json.prices.map(([time, price]) => ({ time, price }));
        setHistoricalData(pts);
        setIsLoadingHistory(false);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setIsLoadingHistory(false);
      });

    return () => controller.abort();
  }, [selectedAssetId, range]);

  const localSparkline = useMemo(
    () => prices[selectedAssetId]?.sparkline ?? goldSpot?.sparkline ?? [],
    [prices, selectedAssetId, goldSpot?.sparkline],
  );

  const sparkline = historicalData ?? localSparkline;

  const { chartData, trades, entryPrice, stats } = useMemo(() => {
    const { data, trades } = generateReplayData(sparkline, range);

    const withForecast = scenario !== 'realized' ? addProjections(data) : data;
    const displayData =
      scenario === 'forecast'
        ? withForecast.filter((d) => d.forecastBase !== undefined || d.event)
        : withForecast;

    const { entryPrice, stats } = computeReplayStats(data, trades);

    return {
      chartData: displayData,
      trades,
      entryPrice,
      stats,
    };
  }, [sparkline, range, scenario]);

  return {
    sparkline,
    chartData,
    trades,
    entryPrice,
    stats,
    isLoadingHistory,
  };
}

export function useContainerWidth() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return { containerRef, containerWidth, isMobile: containerWidth > 0 && containerWidth < 640 };
}
