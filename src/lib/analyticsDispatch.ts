import {
  runBacktest,
  createArbitrageStrategy,
  createMeanReversionStrategy,
  createHoldStrategy,
  createGoldExposureRebalancer,
  type TradingStrategy,
} from './strategyEngine';
import { rollingCorrelations } from './regime';
import type {
  RunBacktestPayload,
  RollingCorrelationsPayload,
  StrategyPayload,
} from './analyticsWorkerProtocol';

export function createStrategyFromPayload(payload: StrategyPayload): TradingStrategy {
  switch (payload.kind) {
    case 'arbitrage':
      return createArbitrageStrategy(payload.config);
    case 'meanReversion':
      return createMeanReversionStrategy(payload.config);
    case 'hold':
      return createHoldStrategy(payload.requiredAssets ?? []);
    case 'goldExposureRebalancer':
      return createGoldExposureRebalancer(payload.config);
    default: {
      const _exhaustive: never = payload;
      return _exhaustive;
    }
  }
}

/** Main-thread reference implementation — also used as worker fallback. */
export function dispatchRunBacktest(payload: RunBacktestPayload) {
  const strategy = createStrategyFromPayload(payload.strategy);
  return runBacktest(
    payload.ticks,
    strategy,
    payload.initialBalance,
    payload.initialPositions,
    payload.costModel,
  );
}

/** Main-thread reference implementation — also used as worker fallback. */
export function dispatchRollingCorrelations(payload: RollingCorrelationsPayload): number[] {
  return rollingCorrelations(payload.seriesA, payload.seriesB, payload.window);
}
