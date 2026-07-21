import type { BacktestTick, BacktestResult, CostModel, ArbConfig, MRConfig, RebalanceConfig } from './strategyEngine';

/** Serializable strategy descriptor — reconstructed in worker or main-thread fallback. */
export type StrategyPayload =
  | { kind: 'arbitrage'; config: ArbConfig }
  | { kind: 'meanReversion'; config: MRConfig }
  | { kind: 'hold'; requiredAssets?: string[] }
  | { kind: 'goldExposureRebalancer'; config: RebalanceConfig };

export interface RunBacktestPayload {
  ticks: BacktestTick[];
  strategy: StrategyPayload;
  initialBalance: number;
  initialPositions?: Record<string, { units: number; avgCost: number }>;
  costModel?: CostModel;
}

export interface RollingCorrelationsPayload {
  seriesA: number[];
  seriesB: number[];
  window: number;
}

export type AnalyticsWorkerRequest =
  | { id: string; type: 'runBacktest'; payload: RunBacktestPayload }
  | { id: string; type: 'rollingCorrelations'; payload: RollingCorrelationsPayload };

export type AnalyticsWorkerResponse =
  | { id: string; ok: true; result: BacktestResult | number[] }
  | { id: string; ok: false; error: string };

export type AnalyticsWorkerRequestType = AnalyticsWorkerRequest['type'];

export type AnalyticsWorkerResultMap = {
  runBacktest: BacktestResult;
  rollingCorrelations: number[];
};
