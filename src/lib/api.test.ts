import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCryptoPrices, fetchMarketChartSeries } from './api';
import { resetCoinGeckoClient } from './coingeckoClient';

/**
 * These exercise the real default client (direct mode: no VITE_* vars in the
 * test environment) against a stubbed global `fetch`, to prove `api.ts` now
 * routes through `coingeckoClient` and still honours its documented fallbacks.
 */

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const urlOf = (input: Parameters<typeof fetch>[0]): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

describe('api.ts → coingeckoClient', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    resetCoinGeckoClient();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('fetchMarketChartSeries', () => {
    it('requests the market_chart endpoint and returns the price series', async () => {
      fetchMock.mockResolvedValueOnce(json(200, { prices: [[1, 10], [2, 11]] }));

      const series = await fetchMarketChartSeries('pax-gold', '30', 'daily');

      expect(series).toEqual([[1, 10], [2, 11]]);
      expect(urlOf(fetchMock.mock.calls[0][0])).toBe(
        'https://api.coingecko.com/api/v3/coins/pax-gold/market_chart?vs_currency=usd&days=30&interval=daily',
      );
    });

    it('returns [] (caller falls back) when CoinGecko refuses', async () => {
      fetchMock.mockResolvedValueOnce(json(400, { error: 'bad' }));
      await expect(fetchMarketChartSeries('pax-gold', '30', 'daily')).resolves.toEqual([]);
    });

    it('returns [] when the payload has no prices', async () => {
      fetchMock.mockResolvedValueOnce(json(200, {}));
      await expect(fetchMarketChartSeries('pax-gold', '30', 'daily')).resolves.toEqual([]);
    });

    it('still propagates an abort', async () => {
      const ctrl = new AbortController();
      ctrl.abort();
      await expect(fetchMarketChartSeries('pax-gold', '30', 'daily', ctrl.signal)).rejects.toMatchObject({
        name: 'AbortError',
      });
    });
  });

  describe('fetchCryptoPrices', () => {
    it('maps /coins/markets into PriceData and flags it as live', async () => {
      fetchMock.mockResolvedValueOnce(
        json(200, [
          {
            id: 'pax-gold',
            symbol: 'paxg',
            name: 'PAX Gold',
            current_price: 3300,
            price_change_percentage_24h: 0.5,
            price_change_percentage_7d_in_currency: 2,
            sparkline_in_7d: { price: [3290, 3300] },
            total_volume: 1,
            market_cap: 2,
          },
        ]),
      );

      const prices = await fetchCryptoPrices();

      expect(prices.__mock).toBeUndefined();
      expect(prices['pax-gold']).toMatchObject({ symbol: 'PAXG', price: 3300, change24h: 0.5, change7d: 2 });
      const url = new URL(urlOf(fetchMock.mock.calls[0][0]));
      expect(url.pathname).toBe('/api/v3/coins/markets');
      expect(url.searchParams.get('sparkline')).toBe('true');
      expect(url.searchParams.get('price_change_percentage')).toBe('24h,7d');
      expect(url.searchParams.get('ids')).toContain('pax-gold');
    });

    it('falls back to flagged mock data on a hard failure', async () => {
      fetchMock.mockResolvedValueOnce(json(401, { error: 'nope' }));

      const prices = await fetchCryptoPrices();

      expect(prices.__mock).toBe(true);
      expect(prices['pax-gold']).toBeDefined();
    });
  });
});
