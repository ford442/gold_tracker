import { describe, it, expect, beforeEach } from 'vitest';
import {
  alignHistoricalSeriesToTicks,
  fetchHistoricalBacktestTicks,
  HISTORICAL_RANGE_CONFIG,
} from './historicalTicks';
import { invalidateMarketCache, type MarketFetcher, type MarketSeries } from './marketCache';

describe('historicalTicks', () => {
  beforeEach(() => {
    invalidateMarketCache();
  });

  describe('HISTORICAL_RANGE_CONFIG', () => {
    it('defines 7d, 30d, and 90d configurations', () => {
      expect(HISTORICAL_RANGE_CONFIG['7d']).toBeDefined();
      expect(HISTORICAL_RANGE_CONFIG['30d']).toBeDefined();
      expect(HISTORICAL_RANGE_CONFIG['90d']).toBeDefined();
      expect(HISTORICAL_RANGE_CONFIG['7d'].days).toBe('7');
      expect(HISTORICAL_RANGE_CONFIG['30d'].days).toBe('30');
      expect(HISTORICAL_RANGE_CONFIG['90d'].days).toBe('90');
    });
  });

  describe('alignHistoricalSeriesToTicks', () => {
    it('returns empty array when given empty input or missing series', () => {
      expect(alignHistoricalSeriesToTicks({})).toEqual([]);
      expect(alignHistoricalSeriesToTicks({ 'pax-gold': [] })).toEqual([]);
      expect(
        alignHistoricalSeriesToTicks({
          'pax-gold': [[1000, 3280]],
          'tether-gold': [],
        }, { requiredAssets: ['pax-gold', 'tether-gold'] })
      ).toEqual([]);
    });

    it('aligns single asset series directly', () => {
      const btcSeries: MarketSeries = [
        [1000, 95000],
        [2000, 96000],
        [3000, 95500],
      ];
      const ticks = alignHistoricalSeriesToTicks({ bitcoin: btcSeries });
      expect(ticks).toHaveLength(3);
      expect(ticks[0]).toEqual({
        timestamp: 1000,
        prices: { bitcoin: 95000 },
      });
      expect(ticks[1]).toEqual({
        timestamp: 2000,
        prices: { bitcoin: 96000 },
      });
      expect(ticks[2]).toEqual({
        timestamp: 3000,
        prices: { bitcoin: 95500 },
      });
    });

    it('aligns dual-asset series with slight timestamp offsets within tolerance', () => {
      const paxgSeries: MarketSeries = [
        [1000, 3280],
        [2000, 3285],
        [3000, 3290],
      ];
      const xautSeries: MarketSeries = [
        [1005, 3282], // 5ms off
        [1990, 3284], // 10ms off
        [3010, 3291], // 10ms off
      ];

      const ticks = alignHistoricalSeriesToTicks(
        { 'pax-gold': paxgSeries, 'tether-gold': xautSeries },
        { requiredAssets: ['pax-gold', 'tether-gold'], maxTimeGapMs: 100 }
      );

      expect(ticks).toHaveLength(3);
      expect(ticks[0].timestamp).toBe(1000);
      expect(ticks[0].prices['pax-gold']).toBe(3280);
      expect(ticks[0].prices['tether-gold']).toBe(3282);

      expect(ticks[1].timestamp).toBe(2000);
      expect(ticks[1].prices['pax-gold']).toBe(3285);
      expect(ticks[1].prices['tether-gold']).toBe(3284);

      expect(ticks[2].timestamp).toBe(3000);
      expect(ticks[2].prices['pax-gold']).toBe(3290);
      expect(ticks[2].prices['tether-gold']).toBe(3291);
    });

    it('skips ticks where another required asset has no price within maxTimeGapMs', () => {
      const paxgSeries: MarketSeries = [
        [1000, 3280],
        [2000, 3285],
        [10000, 3300], // Gap of 8000ms
      ];
      const xautSeries: MarketSeries = [
        [1000, 3281],
        [2000, 3286],
        // No point around 10000
      ];

      const ticks = alignHistoricalSeriesToTicks(
        { 'pax-gold': paxgSeries, 'tether-gold': xautSeries },
        { requiredAssets: ['pax-gold', 'tether-gold'], maxTimeGapMs: 500 }
      );

      expect(ticks).toHaveLength(2);
      expect(ticks.map((t) => t.timestamp)).toEqual([1000, 2000]);
    });

    it('filters out invalid or non-positive price values', () => {
      const paxgSeries: MarketSeries = [
        [1000, 3280],
        [2000, -100], // invalid negative price
        [3000, 3290],
        [4000, NaN],  // invalid NaN
      ];
      const ticks = alignHistoricalSeriesToTicks({ 'pax-gold': paxgSeries });
      expect(ticks).toHaveLength(2);
      expect(ticks.map((t) => t.timestamp)).toEqual([1000, 3000]);
    });

    it('supports custom baseAssetId', () => {
      const paxgSeries: MarketSeries = [
        [1000, 3280],
        [2000, 3285],
      ];
      const xautSeries: MarketSeries = [
        [1050, 3281],
        [2050, 3286],
      ];

      const ticks = alignHistoricalSeriesToTicks(
        { 'pax-gold': paxgSeries, 'tether-gold': xautSeries },
        { baseAssetId: 'tether-gold', maxTimeGapMs: 100 }
      );

      expect(ticks).toHaveLength(2);
      expect(ticks[0].timestamp).toBe(1050);
      expect(ticks[1].timestamp).toBe(2050);
    });

    it('includes non-required optional assets when available', () => {
      const paxgSeries: MarketSeries = [
        [1000, 3280],
        [2000, 3285],
      ];
      const btcSeries: MarketSeries = [
        [1000, 95000],
      ];

      const ticks = alignHistoricalSeriesToTicks(
        { 'pax-gold': paxgSeries, bitcoin: btcSeries },
        { requiredAssets: ['pax-gold'], maxTimeGapMs: 500 }
      );

      expect(ticks).toHaveLength(2);
      expect(ticks[0].prices.bitcoin).toBe(95000);
      expect(ticks[1].prices.bitcoin).toBeUndefined();
    });
  });

  describe('fetchHistoricalBacktestTicks', () => {
    it('fetches and aligns arbitrage assets using injectable fetcher', async () => {
      const mockFetcher: MarketFetcher = async (cgId) => {
        const base = cgId === 'pax-gold' ? 3280 : 3282;
        return [
          [1_000_000, base],
          [2_000_000, base + 2],
          [3_000_000, base + 4],
        ];
      };

      const res = await fetchHistoricalBacktestTicks({
        range: '7d',
        strategyType: 'arbitrage',
        arbAssets: ['pax-gold', 'tether-gold'],
        fetcher: mockFetcher,
        persist: false,
        forceRefresh: true,
      });

      expect(res.isMock).toBe(false);
      expect(res.source).toBe('historical');
      expect(res.assetCount).toBe(2);
      expect(res.tickCount).toBe(3);
      expect(res.ticks[0].prices['pax-gold']).toBe(3280);
      expect(res.ticks[0].prices['tether-gold']).toBe(3282);
    });

    it('fetches and aligns mean-reversion asset', async () => {
      const mockFetcher: MarketFetcher = async (_cgId) => {
        return [
          [1_000_000, 95000],
          [2_000_000, 95500],
        ];
      };

      const res = await fetchHistoricalBacktestTicks({
        range: '30d',
        strategyType: 'mean-reversion',
        mrAsset: 'bitcoin',
        fetcher: mockFetcher,
        persist: false,
        forceRefresh: true,
      });

      expect(res.isMock).toBe(false);
      expect(res.source).toBe('historical');
      expect(res.assetCount).toBe(1);
      expect(res.tickCount).toBe(2);
      expect(res.ticks[0].prices.bitcoin).toBe(95000);
    });

    it('falls back to synthetic mock ticks when fetcher returns empty series', async () => {
      const mockFetcher: MarketFetcher = async () => [];

      const res = await fetchHistoricalBacktestTicks({
        range: '7d',
        strategyType: 'arbitrage',
        arbAssets: ['pax-gold', 'tether-gold'],
        fetcher: mockFetcher,
        persist: false,
        forceRefresh: true,
      });

      expect(res.isMock).toBe(true);
      expect(res.source).toBe('synthetic_fallback');
      expect(res.error).toBeDefined();
      expect(res.ticks.length).toBeGreaterThan(0);
      expect(res.ticks[0].prices['pax-gold']).toBeDefined();
    });

    it('falls back to synthetic mock ticks when alignment yields 0 ticks', async () => {
      const mockFetcher: MarketFetcher = async (cgId) => {
        if (cgId === 'pax-gold') return [[1_000_000, 3280]];
        return [[999_000_000, 3282]]; // Far in future -> gap exceeded
      };

      const res = await fetchHistoricalBacktestTicks({
        range: '7d',
        strategyType: 'arbitrage',
        arbAssets: ['pax-gold', 'tether-gold'],
        fetcher: mockFetcher,
        persist: false,
        forceRefresh: true,
      });

      expect(res.isMock).toBe(true);
      expect(res.source).toBe('synthetic_fallback');
      expect(res.error).toContain('Could not align');
      expect(res.ticks.length).toBeGreaterThan(0);
    });

    it('propagates abort error if signal is aborted', async () => {
      const ctrl = new AbortController();
      ctrl.abort();

      const mockFetcher: MarketFetcher = async () => [];

      await expect(
        fetchHistoricalBacktestTicks({
          range: '7d',
          strategyType: 'arbitrage',
          arbAssets: ['pax-gold', 'tether-gold'],
          signal: ctrl.signal,
          fetcher: mockFetcher,
          persist: false,
          forceRefresh: true,
        })
      ).rejects.toThrow();
    });
  });
});
