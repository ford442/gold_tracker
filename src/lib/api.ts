import type { PriceData, GoldSpot, NewsItem, SparklinePoint } from '../types';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

// Generate mock sparkline for fallback/testing
function mockSparkline(basePrice: number, points = 24): SparklinePoint[] {
  const now = Date.now();
  return Array.from({ length: points }, (_, i) => ({
    time: now - (points - i) * 3600000,
    price: basePrice * (1 + (Math.random() - 0.5) * 0.02),
  }));
}

export async function fetchCryptoPrices(apiKey?: string): Promise<Record<string, PriceData>> {
  const ids = 'pax-gold,tether-gold,bitcoin,ethereum,bitcoin-cash';
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
    const data = await res.json();

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
    return getMockCryptoPrices();
  }
}

export async function fetchSpotGold(apiKey?: string): Promise<GoldSpot> {
  if (apiKey) {
    try {
      const res = await fetch(
        `https://api.metalpriceapi.com/v1/latest?api_key=${apiKey}&base=XAU&currencies=USD`
      );
      if (res.ok) {
        const data = await res.json();
        const pricePerGram = 1 / data.rates.USD;
        const pricePerOz = pricePerGram * 31.1035;
        return {
          price: pricePerOz,
          change24h: 0,
          change7d: 0,
          unit: 'USD/oz',
          sparkline: mockSparkline(pricePerOz),
        };
      }
    } catch (err) {
      console.warn('MetalPrice fetch failed:', err);
    }
  }
  return getMockSpotGold();
}

// Note: RSS fetching disabled due to CORS proxy reliability issues
// News updates can be added via Supabase in the future
export async function fetchGoldNews(): Promise<NewsItem[]> {
  return getMockNews();
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
  };
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
