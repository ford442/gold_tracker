/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useMemo, useRef } from 'react';
import { usePriceStore } from '@/store/priceStore';
import { useCorrelations } from './useCorrelations';
import { fetchMarketChartSeries } from '@lib/api';
import {
  HORIZON_PARAMS,
  generateSyntheticSpotPrices,
  computeFidelityScores,
  rollingCorrelations,
  alignToRefLength,
  downsample,
  makeFallbackResult,
} from '@lib/regime';
import { sparklinePrices } from '@lib/utils';
import type { AnalysisHorizon, RegimeAnalysisResult } from '@/types';

const MAX_POINTS = 180; // downsample target for 1Y/MAX

/**
 * Hook powering the Fidelity & Regimes tab.
 * Fetches long-horizon market_chart for PAXG/XAUT/BTC/ETH, synthesizes spot gold path,
 * computes fidelity scores (50+50*delta formula), long matrix, rolling corrs for shift viz,
 * and surfaces tactical (short) corrs for live delta badges.
 *
 * Pure math lives in lib/regime.ts. Graceful fallback to sparklines + synth on any error.
 * Aborts in-flight requests when horizon changes. Does not poll on 60s price ticks (user-driven).
 */
export function useRegimeAnalysis(horizon: AnalysisHorizon): {
  result: RegimeAnalysisResult | null;
  loading: boolean;
  error: string | null;
  tactical: ReturnType<typeof useCorrelations>;
} {
  const { prices, goldSpot } = usePriceStore();
  const tactical = useCorrelations('7d'); // short-term baseline for "live vs structural" deltas

  const [result, setResult] = useState<RegimeAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const { days, interval } = HORIZON_PARAMS[horizon];
  const endSpot = goldSpot?.price ?? prices['pax-gold']?.price ?? 3290;

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const apiKey = import.meta.env.VITE_COINGECKO_API_KEY as string | undefined;

    setLoading(true);
    setError(null);

    const ids = ['pax-gold', 'tether-gold', 'bitcoin', 'ethereum'] as const;

    Promise.all(
      ids.map((id) => fetchMarketChartSeries(id, days, interval, controller.signal, apiKey))
    )
      .then(([paxgRaw, xautRaw, btcRaw, ethRaw]) => {
        if (controller.signal.aborted) return;

        // Downsample long series for perf (daily already for 30d+)
        const paxg = downsample(paxgRaw.length ? paxgRaw.map(([, p]) => p) : [], MAX_POINTS);
        const xaut = downsample(xautRaw.length ? xautRaw.map(([, p]) => p) : [], MAX_POINTS);
        const btc = downsample(btcRaw.length ? btcRaw.map(([, p]) => p) : [], MAX_POINTS);
        const eth = downsample(ethRaw.length ? ethRaw.map(([, p]) => p) : [], MAX_POINTS);

        let usedFallback = false;
        const warnings: string[] = [];

        // Fallbacks if any series too short (CG rate limit / error / free tier)
        const minReal = Math.min(paxg.length, xaut.length, btc.length, eth.length);
        if (minReal < 5) {
          usedFallback = true;
          warnings.push('Limited history from API — using sparkline fallback + synthetic spot');
          const fbPaxg = sparklinePrices(prices['pax-gold']?.sparkline ?? [], 90).length
            ? sparklinePrices(prices['pax-gold'].sparkline, 90)
            : [endSpot * 0.99, endSpot];
          const fbXaut = sparklinePrices(prices['tether-gold']?.sparkline ?? [], 90).length
            ? sparklinePrices(prices['tether-gold'].sparkline, 90)
            : [endSpot * 1.01, endSpot];
          const fbBtc = sparklinePrices(prices['bitcoin']?.sparkline ?? [], 90).length
            ? sparklinePrices(prices['bitcoin'].sparkline, 90)
            : [endSpot * 30, endSpot * 30.5];
          const fbEth = sparklinePrices(prices['ethereum']?.sparkline ?? [], 90).length
            ? sparklinePrices(prices['ethereum'].sparkline, 90)
            : [endSpot * 1.2, endSpot * 1.25];

          const n = Math.max(5, Math.min(fbPaxg.length, fbXaut.length));
          const g = generateSyntheticSpotPrices(endSpot, n);
          const { paxg: pF, xaut: xF, longCorrelations } = computeFidelityScores(g, fbPaxg.slice(-n), fbXaut.slice(-n), fbBtc.slice(-n), fbEth.slice(-n));
          const fallback: RegimeAnalysisResult = {
            horizon,
            paxg: pF,
            xaut: xF,
            longCorrelations,
            rollingCorrs: undefined,
            dataPoints: n,
            isEstimatedSpot: true,
            warnings,
          };
          setResult(fallback);
          setLoading(false);
          return;
        }

        // Real path: synth spot to match the (downsampled) paxg length
        const n = paxg.length;
        const gold = generateSyntheticSpotPrices(endSpot, n);

        // Align others just in case lengths drifted slightly after downsample
        // (downsampled lists used directly; proportional alignment is sufficient for daily-sampled data)
        const paxgAligned = paxg.length === n ? paxg : alignToRefLength(n, paxgRaw as [number, number][]);
        const xautAligned = xaut.length === n ? xaut : alignToRefLength(n, xautRaw as [number, number][]);
        const btcAligned = btc.length === n ? btc : alignToRefLength(n, btcRaw as [number, number][]);
        const ethAligned = eth.length === n ? eth : alignToRefLength(n, ethRaw as [number, number][]);

        const { paxg: pScore, xaut: xScore, longCorrelations } = computeFidelityScores(
          gold,
          paxgAligned,
          xautAligned,
          btcAligned,
          ethAligned
        );

        // Rolling corrs for the "shifts over time" chart (window ~10% of series or 20-30 pts)
        const rollWin = Math.max(10, Math.floor(n / 10));
        const paxgGoldRoll = rollingCorrelations(gold, paxgAligned, rollWin);
        const paxgBtcRoll = rollingCorrelations(btcAligned, paxgAligned, rollWin);

        // Build time labels for rolling (approximate daily labels from end)
        const rollLen = paxgGoldRoll.length;
        const rollingCorrs = Array.from({ length: rollLen }, (_, i) => {
          const stepsBack = rollLen - 1 - i;
          const d = new Date(Date.now() - stepsBack * 86400000);
          const t = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
          return {
            t,
            gold: Math.round(paxgGoldRoll[i] * 1000) / 1000,
            btc: Math.round(paxgBtcRoll[i] * 1000) / 1000,
          };
        });

        const finalResult: RegimeAnalysisResult = {
          horizon,
          paxg: pScore,
          xaut: xScore,
          longCorrelations,
          rollingCorrs: rollLen > 3 ? rollingCorrs : undefined,
          dataPoints: n,
          isEstimatedSpot: true, // always for spot in this feature
          warnings: usedFallback ? warnings : [],
        };

        setResult(finalResult);
        setLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        // Total fallback path
        const fb = makeFallbackResult(
          horizon,
          sparklinePrices(prices['pax-gold']?.sparkline ?? [], 60),
          sparklinePrices(prices['tether-gold']?.sparkline ?? [], 60),
          endSpot,
          ['API error — using sparkline + synthetic spot only']
        );
        setResult(fb);
        setError(err instanceof Error ? err.message : 'Failed to load structural data');
        setLoading(false);
      });

    return () => controller.abort();
  }, [horizon, days, interval, endSpot, prices, goldSpot?.price]);

  const memoResult = useMemo(() => result, [result]);

  return { result: memoResult, loading, error, tactical };
}
