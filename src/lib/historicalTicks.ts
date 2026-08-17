/**
 * Pure historical tick adapter for strategy backtesting (P1 Feature).
 *
 * Fetches real historical price series via shared `marketCache` and aligns
 * multi-asset timestamps (forward-fill / nearest time-bin) into `BacktestTick[]`.
 * Falls back gracefully to synthetic mock ticks on offline/rate-limit.
 *
 * Pure logic only — no React imports. Fully unit-tested with Vitest.
 */

import type { BacktestTick } from './strategyEngine';
import { generateMockTicks } from './strategyMockTicks';
import { getMarketChartSeries, type MarketFetcher, type MarketSeries } from './marketCache';
import { recordObservabilityEvent } from './observability';

export type HistoricalRange = '7d' | '30d' | '90d';
export type TickSource = 'synthetic' | 'historical';

export const HISTORICAL_RANGE_CONFIG: Record<
  HistoricalRange,
  { days: string; interval: string; label: string; maxTimeGapMs: number }
> = {
  '7d': { days: '7', interval: 'hourly', label: '7 Days', maxTimeGapMs: 4 * 3_600_000 },
  '30d': { days: '30', interval: 'hourly', label: '30 Days', maxTimeGapMs: 6 * 3_600_000 },
  '90d': { days: '90', interval: 'daily', label: '90 Days', maxTimeGapMs: 48 * 3_600_000 },
};

export interface AlignHistoricalOptions {
  /**
   * Assets that MUST have valid prices for a tick to be included.
   * Defaults to all asset keys present in seriesByAsset.
   */
  requiredAssets?: string[];
  /**
   * Primary asset whose timestamps define the master timeline.
   * If omitted, uses the required asset with the longest series.
   */
  baseAssetId?: string;
  /**
   * Maximum allowed time difference (in ms) when matching prices across assets.
   * Defaults to 4 hours (14,400,000 ms).
   */
  maxTimeGapMs?: number;
}

/**
 * Binary search for the closest element in a sorted series to target timestamp.
 */
function findClosestPrice(
  series: MarketSeries,
  targetTs: number,
  maxGapMs: number,
): number | null {
  if (series.length === 0) return null;

  let low = 0;
  let high = series.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midTs = series[mid][0];
    if (midTs === targetTs) {
      const p = series[mid][1];
      return Number.isFinite(p) && p > 0 ? p : null;
    }
    if (midTs < targetTs) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  // Check candidates around insertion point (high and low)
  let bestDist = Infinity;
  let bestPrice: number | null = null;

  for (const idx of [high, low]) {
    if (idx >= 0 && idx < series.length) {
      const [ts, p] = series[idx];
      const dist = Math.abs(ts - targetTs);
      if (dist <= maxGapMs && dist < bestDist && Number.isFinite(p) && p > 0) {
        bestDist = dist;
        bestPrice = p;
      }
    }
  }

  return bestPrice;
}

/**
 * Align raw multi-asset CoinGecko `[timestamp, price]` series into `BacktestTick[]`.
 * Ensures every resulting tick has all `requiredAssets` populated with valid prices.
 */
export function alignHistoricalSeriesToTicks(
  seriesByAsset: Record<string, MarketSeries>,
  options: AlignHistoricalOptions = {},
): BacktestTick[] {
  const assetKeys = Object.keys(seriesByAsset);
  if (assetKeys.length === 0) return [];

  const required = options.requiredAssets ?? assetKeys;
  if (required.length === 0) return [];

  // Filter and sort each series
  const cleanSeries: Record<string, MarketSeries> = {};
  for (const key of assetKeys) {
    const raw = seriesByAsset[key] ?? [];
    const valid = raw
      .filter(([ts, p]) => Number.isFinite(ts) && ts > 0 && Number.isFinite(p) && p > 0)
      .sort((a, b) => a[0] - b[0]);
    cleanSeries[key] = valid;
  }

  // Verify all required assets have at least one valid point
  for (const req of required) {
    if (!cleanSeries[req] || cleanSeries[req].length === 0) {
      return [];
    }
  }

  const maxGap = options.maxTimeGapMs ?? 4 * 3_600_000;

  // Determine master timeline asset
  let masterAsset = options.baseAssetId;
  if (!masterAsset || !cleanSeries[masterAsset] || cleanSeries[masterAsset].length === 0) {
    // Pick required asset with largest point count
    masterAsset = required.reduce((longest, current) => {
      const curLen = cleanSeries[current]?.length ?? 0;
      const longLen = cleanSeries[longest]?.length ?? 0;
      return curLen > longLen ? current : longest;
    }, required[0]);
  }

  const masterTimeline = cleanSeries[masterAsset];
  if (!masterTimeline || masterTimeline.length === 0) return [];

  const ticks: BacktestTick[] = [];

  for (const [t, masterPrice] of masterTimeline) {
    const prices: Record<string, number> = {
      [masterAsset]: masterPrice,
    };
    let missingRequired = false;

    for (const req of required) {
      if (req === masterAsset) continue;
      const matched = findClosestPrice(cleanSeries[req], t, maxGap);
      if (matched === null) {
        missingRequired = true;
        break;
      }
      prices[req] = matched;
    }

    if (!missingRequired) {
      // Also populate non-required assets if they match
      for (const optKey of assetKeys) {
        if (!prices[optKey] && cleanSeries[optKey]) {
          const matched = findClosestPrice(cleanSeries[optKey], t, maxGap);
          if (matched !== null) {
            prices[optKey] = matched;
          }
        }
      }

      ticks.push({
        timestamp: t,
        prices,
      });
    }
  }

  return ticks;
}

export interface FetchHistoricalTicksOptions {
  range: HistoricalRange;
  strategyType: 'arbitrage' | 'mean-reversion';
  arbAssets?: [string, string];
  mrAsset?: string;
  scenarioLabAssets?: string[];
  apiKey?: string;
  signal?: AbortSignal;
  fetcher?: MarketFetcher;
  forceRefresh?: boolean;
  persist?: boolean;
}

export interface FetchHistoricalTicksResult {
  ticks: BacktestTick[];
  isMock: boolean;
  source: 'historical' | 'synthetic_fallback';
  assetCount: number;
  range: HistoricalRange;
  tickCount: number;
  error?: string;
}

/**
 * Fetch historical price series via `marketCache.getMarketChartSeries`, align
 * timestamps into `BacktestTick[]`, and fall back to synthetic mock ticks on error.
 */
export async function fetchHistoricalBacktestTicks(
  options: FetchHistoricalTicksOptions,
): Promise<FetchHistoricalTicksResult> {
  const {
    range,
    strategyType,
    arbAssets = ['pax-gold', 'tether-gold'],
    mrAsset = 'bitcoin',
    scenarioLabAssets,
    apiKey,
    signal,
    fetcher,
    forceRefresh,
    persist,
  } = options;

  const cfg = HISTORICAL_RANGE_CONFIG[range] ?? HISTORICAL_RANGE_CONFIG['30d'];

  // Determine assets to fetch
  let targetAssets: string[];
  if (scenarioLabAssets && scenarioLabAssets.length > 0) {
    targetAssets = scenarioLabAssets;
  } else if (strategyType === 'arbitrage') {
    targetAssets = [...new Set(arbAssets)];
  } else {
    targetAssets = [mrAsset];
  }

  try {
    const fetchPromises = targetAssets.map(async (id) => {
      const series = await getMarketChartSeries(id, cfg.days, cfg.interval, {
        signal,
        apiKey,
        fetcher,
        forceRefresh,
        persist,
      });
      return { id, series };
    });

    const results = await Promise.all(fetchPromises);
    const seriesByAsset: Record<string, MarketSeries> = {};
    const failedAssets: string[] = [];

    for (const { id, series } of results) {
      if (series && series.length > 0) {
        seriesByAsset[id] = series;
      } else {
        failedAssets.push(id);
      }
    }

    if (failedAssets.length > 0) {
      const mockTicks = generateMockTicks(strategyType, mrAsset);
      recordObservabilityEvent({
        kind: 'price_fetch',
        severity: 'warn',
        ok: false,
        source: 'historical-ticks',
        action: 'historical_fetch_fallback',
        detail: `Historical fetch missing assets (${failedAssets.join(', ')}); fell back to synthetic ticks`,
      });
      return {
        ticks: mockTicks,
        isMock: true,
        source: 'synthetic_fallback',
        assetCount: targetAssets.length,
        range,
        tickCount: mockTicks.length,
        error: `CoinGecko returned no data for ${failedAssets.join(', ')} (${range}). Using synthetic ticks.`,
      };
    }

    const aligned = alignHistoricalSeriesToTicks(seriesByAsset, {
      requiredAssets: targetAssets,
      maxTimeGapMs: cfg.maxTimeGapMs,
    });

    if (aligned.length === 0) {
      const mockTicks = generateMockTicks(strategyType, mrAsset);
      return {
        ticks: mockTicks,
        isMock: true,
        source: 'synthetic_fallback',
        assetCount: targetAssets.length,
        range,
        tickCount: mockTicks.length,
        error: `Could not align timestamps across ${targetAssets.join(', ')}. Using synthetic ticks.`,
      };
    }

    recordObservabilityEvent({
      kind: 'price_fetch',
      severity: 'info',
      ok: true,
      source: 'historical-ticks',
      action: 'historical_ticks_aligned',
      detail: `Aligned ${aligned.length} historical ticks for [${targetAssets.join(', ')}] (${range})`,
    });

    return {
      ticks: aligned,
      isMock: false,
      source: 'historical',
      assetCount: targetAssets.length,
      range,
      tickCount: aligned.length,
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw err;
    }
    const mockTicks = generateMockTicks(strategyType, mrAsset);
    return {
      ticks: mockTicks,
      isMock: true,
      source: 'synthetic_fallback',
      assetCount: targetAssets.length,
      range,
      tickCount: mockTicks.length,
      error: `Network/API error fetching historical series: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
