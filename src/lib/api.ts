import type { PriceData, GoldSpot, MetalSpot, NewsItem, SparklinePoint } from '@/types';
import {
  changesFromTimeframe,
  isPlausibleGoldUsdPerOz,
  parseGoldUsdPerOz,
  parseMetalUsdPerOz,
  sparklineFromTimeframe,
  timeframeDateRange,
  type MetalpriceRatesResponse,
  type MetalpriceTimeframeResponse,
} from './metalprice';
import { COINGECKO_MARKET_IDS } from './assets';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const METALPRICE_BASE = 'https://api.metalpriceapi.com/v1';

interface CoinGeckoMarketCoin {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h?: number;
  price_change_percentage_7d_in_currency?: number;
  sparkline_in_7d?: { price?: number[] };
  total_volume?: number;
  market_cap?: number;
}

function parseCoinGeckoMarkets(raw: unknown): CoinGeckoMarketCoin[] {
  if (!Array.isArray(raw)) return [];
  return raw as CoinGeckoMarketCoin[];
}

/**
 * Reusable thin wrapper for CoinGecko /coins/{id}/market_chart.
 * Returns the raw [ts, price][] or [] on error (caller decides fallback).
 * Respects AbortSignal and optional demo API key header.
 * Used by overlay, trade replay, performance, and new regime/fidelity analysis.
 */
export async function fetchMarketChartSeries(
  cgId: string,
  days: string,
  interval: string,
  signal?: AbortSignal,
  apiKey?: string
): Promise<[number, number][]> {
  const headers: HeadersInit = apiKey ? { 'x-cg-demo-api-key': apiKey } : {};
  try {
    const res = await fetch(
      `${COINGECKO_BASE}/coins/${cgId}/market_chart?vs_currency=usd&days=${days}&interval=${interval}`,
      { signal, headers }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as { prices: [number, number][] };
    return json.prices ?? [];
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    return [];
  }
}

// Generate mock sparkline for fallback/testing
function mockSparkline(basePrice: number, points = 24): SparklinePoint[] {
  const now = Date.now();
  return Array.from({ length: points }, (_, i) => ({
    time: now - (points - i) * 3600000,
    price: basePrice * (1 + (Math.random() - 0.5) * 0.02),
  }));
}

export async function fetchCryptoPrices(apiKey?: string): Promise<Record<string, PriceData> & { __mock?: boolean }> {
  const ids = COINGECKO_MARKET_IDS;
  const headers: Record<string, string> = {};
  if (apiKey) headers['x-cg-demo-api-key'] = apiKey;

  try {
    const res = await fetch(`${COINGECKO_BASE}/coins/markets?${new URLSearchParams({
      vs_currency: 'usd',
      ids,
      sparkline: 'true',
      price_change_percentage: '24h,7d',
    })}`, { headers });

    if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
    const data = parseCoinGeckoMarkets(await res.json());

    const result: Record<string, PriceData> = {};
    for (const coin of data) {
      const sparkline: SparklinePoint[] = (coin.sparkline_in_7d?.price ?? []).map(
        (p: number, i: number) => ({
          time: Date.now() - (168 - i) * 3600000,
          price: p,
        })
      );
      result[coin.id] = {
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        price: coin.current_price,
        change24h: coin.price_change_percentage_24h ?? 0,
        change7d: coin.price_change_percentage_7d_in_currency ?? 0,
        sparkline: sparkline.length > 0 ? sparkline : mockSparkline(coin.current_price),
        volume24h: coin.total_volume,
        marketCap: coin.market_cap,
      };
    }
    return result;
  } catch (err) {
    console.warn('CoinGecko fetch failed, using mock data:', err);
    const mock = getMockCryptoPrices();
    return Object.assign(mock, { __mock: true });
  }
}

async function fetchMetalpriceJson<T extends { success: boolean }>(
  path: string,
  apiKey: string,
): Promise<T | null> {
  try {
    const separator = path.includes('?') ? '&' : '?';
    const res = await fetch(`${METALPRICE_BASE}${path}${separator}api_key=${encodeURIComponent(apiKey)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as T;
    return data.success ? data : null;
  } catch {
    return null;
  }
}

export async function fetchSpotGold(apiKey?: string): Promise<GoldSpot & { __mock?: boolean }> {
  if (!apiKey) {
    return { ...getMockSpotGold(), __mock: true };
  }

  try {
    const latest = await fetchMetalpriceJson<MetalpriceRatesResponse>(
      '/latest?base=USD&currencies=XAU',
      apiKey,
    );

    let pricePerOz = latest ? parseGoldUsdPerOz(latest.rates, latest.base) : null;

    // Fallback: legacy base=XAU shape if USD-base parse fails
    if (pricePerOz === null || !isPlausibleGoldUsdPerOz(pricePerOz)) {
      const xauBase = await fetchMetalpriceJson<MetalpriceRatesResponse>(
        '/latest?base=XAU&currencies=USD',
        apiKey,
      );
      const alt = xauBase ? parseGoldUsdPerOz(xauBase.rates, xauBase.base) : null;
      if (alt !== null && isPlausibleGoldUsdPerOz(alt)) {
        pricePerOz = alt;
      }
    }

    if (pricePerOz === null || !isPlausibleGoldUsdPerOz(pricePerOz)) {
      console.warn('MetalPrice spot gold failed sanity check, using mock data');
      return { ...getMockSpotGold(), __mock: true };
    }

    const { start, end } = timeframeDateRange(7);
    const history = await fetchMetalpriceJson<MetalpriceTimeframeResponse>(
      `/timeframe?base=USD&currencies=XAU&start_date=${start}&end_date=${end}`,
      apiKey,
    );

    const sparkline = history && Object.keys(history.rates).length > 0
      ? sparklineFromTimeframe(history)
      : mockSparkline(pricePerOz);

    const { change24h, change7d } = history
      ? changesFromTimeframe(history)
      : { change24h: 0, change7d: 0 };

    return {
      price: pricePerOz,
      change24h,
      change7d,
      unit: 'USD/oz',
      sparkline: sparkline.length > 1 ? sparkline : mockSparkline(pricePerOz),
      isMock: false,
    };
  } catch (err) {
    console.warn('MetalPrice fetch failed:', err);
    return { ...getMockSpotGold(), __mock: true };
  }
}

// Fetch silver, platinum, and palladium spot prices
export async function fetchOtherMetals(apiKey?: string): Promise<MetalSpot[]> {
  const metals: Array<{ id: string; symbol: string; name: string; base: string }> = [
    { id: 'silver',    symbol: 'XAG', name: 'Silver',    base: 'XAG' },
    { id: 'platinum',  symbol: 'XPT', name: 'Platinum',  base: 'XPT' },
    { id: 'palladium', symbol: 'XPD', name: 'Palladium', base: 'XPD' },
  ];

  if (apiKey) {
    try {
      // Batch request: base=USD gives how many grams of each metal per USD
      const symbols = metals.map((m) => m.symbol).join(',');
      const res = await fetch(
        `https://api.metalpriceapi.com/v1/latest?api_key=${apiKey}&base=USD&currencies=${symbols}`
      );
      if (res.ok) {
        const data = (await res.json()) as MetalpriceRatesResponse;
        return metals.map((m) => {
          // MetalPrice API returns troy oz of metal per 1 USD when base=USD (see metalprice.ts).
          const pricePerOz = parseMetalUsdPerOz(data.rates, m.symbol, data.base) ?? 0;
          return {
            id: m.id,
            symbol: m.symbol,
            name: m.name,
            price: pricePerOz,
            change24h: 0,
            change7d: 0,
            unit: 'USD/oz',
            sparkline: mockSparkline(pricePerOz),
          } as MetalSpot;
        });
      }
    } catch (err) {
      console.warn('MetalPrice other metals fetch failed:', err);
    }
  }
  return getMockOtherMetals();
}

/** @deprecated Use fetchLiveNews from services/newsService */
export async function fetchGoldNews(): Promise<NewsItem[]> {
  const { fetchLiveNews } = await import('@/services/newsService');
  const result = await fetchLiveNews();
  return result.items;
}

// Mock data for development / API-key-free usage

export function getMockCryptoPrices(): Record<string, PriceData> {
  const base: Array<[string, string, string, number, number, number]> = [
    ['pax-gold', 'PAXG', 'PAX Gold', 3280.5, -0.12, 2.4],
    ['tether-gold', 'XAUT', 'Tether Gold', 3284.2, 0.08, 2.1],
    ['bitcoin', 'BTC', 'Bitcoin', 97450.0, -1.8, 5.6],
    ['ethereum', 'ETH', 'Ethereum', 3850.0, -2.1, 3.2],
    ['bitcoin-cash', 'BCH', 'Bitcoin Cash', 504.0, 0.5, 1.2],
  ];
  return Object.fromEntries(
    base.map(([id, symbol, name, price, c24, c7]) => [
      id,
      {
        id,
        symbol,
        name,
        price,
        change24h: c24,
        change7d: c7,
        sparkline: mockSparkline(price),
        volume24h: price * 10000,
        marketCap: price * 1000000,
      } as PriceData,
    ])
  );
}

export function getMockSpotGold(): GoldSpot {
  const price = 3290.0;
  return {
    price,
    change24h: 0.35,
    change7d: 1.8,
    unit: 'USD/oz',
    sparkline: mockSparkline(price),
    isMock: true,
  };
}

export function getMockOtherMetals(): MetalSpot[] {
  const metals: Array<[string, string, string, number, number, number]> = [
    ['silver',    'XAG', 'Silver',    32.5,  -0.42,  1.2],
    ['platinum',  'XPT', 'Platinum',  960.0,  0.65, -0.8],
    ['palladium', 'XPD', 'Palladium', 950.0, -1.10,  2.3],
  ];
  return metals.map(([id, symbol, name, price, c24, c7]) => ({
    id,
    symbol,
    name,
    price,
    change24h: c24,
    change7d: c7,
    unit: 'USD/oz',
    sparkline: mockSparkline(price),
  }));
}

export function getMockNews(): NewsItem[] {
  return [
    {
      id: 'n1',
      title: 'Gold rallies as Fed signals rate cut pause amid inflation concerns',
      url: 'https://www.kitco.com',
      source: 'Kitco',
      publishedAt: new Date().toISOString(),
      snippet: 'Gold prices surged past $3,290/oz as the Federal Reserve signaled a cautious approach to rate cuts...',
    },
    {
      id: 'n2',
      title: 'PAXG vs XAUT: Arbitrage opportunity widens to 0.8% on Coinbase',
      url: 'https://www.kitco.com',
      source: 'Kitco',
      publishedAt: new Date(Date.now() - 3600000).toISOString(),
      snippet: 'Traders have spotted a growing spread between PAXG and XAUT on major exchanges...',
    },
    {
      id: 'n3',
      title: 'China increases gold reserves for third consecutive month amid tariff uncertainty',
      url: 'https://www.kitco.com',
      source: 'Kitco',
      publishedAt: new Date(Date.now() - 7200000).toISOString(),
      snippet: "China's central bank added to its gold reserves again as trade tensions with the US persist...",
    },
    {
      id: 'n4',
      title: 'Bitcoin correlation with gold reaches 6-month high during Fed uncertainty',
      url: 'https://www.kitco.com',
      source: 'Kitco',
      publishedAt: new Date(Date.now() - 10800000).toISOString(),
      snippet: 'The 30-day rolling correlation between BTC and gold has hit 0.68, the highest since August...',
    },
    {
      id: 'n5',
      title: 'Dollar weakens on tariff news, gold benefits as safe-haven demand rises',
      url: 'https://www.kitco.com',
      source: 'Kitco',
      publishedAt: new Date(Date.now() - 14400000).toISOString(),
      snippet: 'The US dollar index fell 0.4% after new tariff announcements spooked currency markets...',
    },
  ];
}
