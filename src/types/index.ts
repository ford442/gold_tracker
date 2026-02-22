export interface SparklinePoint {
  time: number;
  price: number;
}

export interface PriceData {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  change7d: number;
  sparkline: SparklinePoint[];
  volume24h?: number;
  marketCap?: number;
}

export interface GoldSpot {
  price: number;
  change24h: number;
  change7d: number;
  unit: string; // e.g. "USD/oz"
  sparkline: SparklinePoint[];
}

export type CorrelationPeriod = '1h' | '1d' | '7d' | '30d';

export interface CorrelationMatrix {
  period: CorrelationPeriod;
  assets: string[];
  matrix: number[][];
}

export interface PortfolioEntry {
  id: string;
  symbol: string;
  name: string;
  amount: number;
  buyPrice: number;
}

export interface AlertItem {
  id: string;
  message: string;
  type: 'arbitrage' | 'price' | 'info';
  timestamp: number;
  spread?: number;
  dismissed: boolean;
}

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  snippet?: string;
}

export type ThemeMode = 'dark' | 'light';
