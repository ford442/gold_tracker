export interface ChartDataPoint {
  time: string;
  price: number;
  benchmark?: number;
  forecastBase?: number;
  forecastLow?: number;
  forecastHigh?: number;
  event?: 'buy' | 'sell';
  eventNote?: string;
  eventPrice?: number;
}

export interface ReplayStats {
  sinceEntry: number;
  maxDD: number;
  current: number;
  high: number;
}
