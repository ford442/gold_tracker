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
  /** 'coinbase' entries are auto-synced; 'manual' entries are user-added */
  source?: 'coinbase' | 'manual';
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

// Chart / Trade Decision Types

export interface TradeEvent {
  id: string;
  timestamp: string; // ISO string
  type: 'buy' | 'sell';
  price: number;
  size: number;
  note?: string;
}

export interface TimeSeriesPoint {
  t: string; // ISO string
  v: number;
}

export interface PriceSeries {
  points: TimeSeriesPoint[];
  label: string;
}

export interface Projections {
  base: TimeSeriesPoint[];
  low?: TimeSeriesPoint[];
  high?: TimeSeriesPoint[];
  metadata?: { source: string; generated_at: string };
}

export interface PnLSeries {
  cumulative: TimeSeriesPoint[];
  drawdown?: TimeSeriesPoint[];
  currency: string;
}

export type ChartRange = '1D' | '1W' | '1M' | '3M' | '1Y' | 'MAX' | 'SINCE_TRADE';
export type ScenarioMode = 'realized' | 'forecast' | 'both';

export interface ChartConfig {
  range: ChartRange;
  showProjection: boolean;
  baselinePrice?: number;
  compareTo?: 'spot' | 'benchmark' | 'basket';
  scenario: ScenarioMode;
}
