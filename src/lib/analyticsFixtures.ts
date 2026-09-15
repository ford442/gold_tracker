import type { BacktestTick, BacktestResult } from './strategyEngine';
import {
  applyShocksToTicks,
  createArbitrageStrategy,
  createGoldExposureRebalancer,
  createHoldStrategy,
  createMeanReversionStrategy,
  EXCHANGE_COST_PRESETS,
  generateBaseScenarioTicks,
  runBacktest,
  type ArbConfig,
  type MRConfig,
  type RebalanceConfig,
} from './strategyEngine';
import { DEFAULT_REGIME_GATE_CONFIG } from './regime';
import type { RunBacktestPayload } from './analyticsWorkerProtocol';

export function makeTicks(
  pricesByAsset: Record<string, number[]>,
  startTs = 1_700_000_000_000,
): BacktestTick[] {
  const len = Math.max(...Object.values(pricesByAsset).map((a) => a.length));
  return Array.from({ length: len }, (_, i) => ({
    timestamp: startTs + i * 3_600_000,
    prices: Object.fromEntries(
      Object.entries(pricesByAsset).map(([id, series]) => [id, series[i]]),
    ),
  }));
}

export const ARB_TICKS = makeTicks({
  'pax-gold': Array(5).fill(3300).concat(Array(5).fill(3290)),
  'tether-gold': Array(5).fill(3280).concat(Array(5).fill(3288)),
});

export const ARB_CONFIG: ArbConfig = {
  asset1: 'pax-gold',
  asset2: 'tether-gold',
  spreadThreshold: 0.25,
  tradeSize: 1000,
};

export const MR_TICKS = makeTicks({
  bitcoin: [100, 99, 98, 97, 96, 95, 94, 93, 92, 91, 90, 89],
});

export const MR_CONFIG: MRConfig = {
  asset: 'bitcoin',
  windowSize: 4,
  buyThreshold: 1,
  sellThreshold: 1,
  tradeSize: 500,
  stopLoss: 5,
};

export const REBAL_CONFIG: RebalanceConfig = {
  goldAssetIds: ['pax-gold', 'tether-gold'],
  targetGoldPct: 0.55,
  rebalanceBandPct: 0.05,
};

/** Shared scenario ticks — generated once per process so TS and WASM see the same series. */
export const SCENARIO_FIXTURE = {
  ticks: applyShocksToTicks(generateBaseScenarioTicks(120), { 'pax-gold': 0.05, bitcoin: -0.1 }),
  initialBalance: 25_000,
  initialPositions: {
    'pax-gold': { units: 2, avgCost: 3200 },
    bitcoin: { units: 0.1, avgCost: 90_000 },
  },
  costModel: EXCHANGE_COST_PRESETS.kraken,
};

export const REGIME_ARB_TICKS: BacktestTick[] = makeTicks({
  'pax-gold': Array(8).fill(3300),
  'tether-gold': Array(8).fill(3280),
}).map((t) => ({
  ...t,
  regime: {
    paxg: {
      score: 75,
      corrToGold: 0.85,
      corrToBtc: 0.4,
      corrToEth: 0.35,
      realizedVol: 12,
      maxDrawdown: 5,
      regimeLabel: 'Strong gold proxy',
    },
    xaut: {
      score: 72,
      corrToGold: 0.82,
      corrToBtc: 0.42,
      corrToEth: 0.38,
      realizedVol: 13,
      maxDrawdown: 6,
      regimeLabel: 'Strong gold proxy',
    },
  },
}));

export const REGIME_ARB_CONFIG: ArbConfig = {
  asset1: 'pax-gold',
  asset2: 'tether-gold',
  spreadThreshold: 0.25,
  tradeSize: 1000,
  regimeGate: { enabled: true, config: DEFAULT_REGIME_GATE_CONFIG },
};

export const ROLLING_SERIES_A = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i / 3) * 5);
export const ROLLING_SERIES_B = Array.from({ length: 40 }, (_, i) => 200 + Math.cos(i / 3) * 8);
export const ROLLING_WINDOW = 12;

export const ROLLING_CLIENT_A = Array.from({ length: 60 }, (_, i) => 3290 + i * 0.5);
export const ROLLING_CLIENT_B = Array.from({ length: 60 }, (_, i) => 3285 + i * 0.48);
export const ROLLING_CLIENT_WINDOW = 15;

export function arbPayload(): RunBacktestPayload {
  return {
    ticks: ARB_TICKS,
    strategy: { kind: 'arbitrage', config: ARB_CONFIG },
    initialBalance: 10_000,
  };
}

export function mrPayload(): RunBacktestPayload {
  return {
    ticks: MR_TICKS,
    strategy: { kind: 'meanReversion', config: MR_CONFIG },
    initialBalance: 10_000,
  };
}

export function rebalPayload(): RunBacktestPayload {
  const { ticks, initialBalance, initialPositions, costModel } = SCENARIO_FIXTURE;
  return {
    ticks,
    strategy: { kind: 'goldExposureRebalancer', config: REBAL_CONFIG },
    initialBalance,
    initialPositions,
    costModel,
  };
}

export function holdPayload(): RunBacktestPayload {
  const { ticks, initialBalance, initialPositions, costModel } = SCENARIO_FIXTURE;
  return {
    ticks,
    strategy: { kind: 'hold' },
    initialBalance,
    initialPositions,
    costModel,
  };
}

export function regimeArbPayload(): RunBacktestPayload {
  return {
    ticks: REGIME_ARB_TICKS,
    strategy: { kind: 'arbitrage', config: REGIME_ARB_CONFIG },
    initialBalance: 10_000,
  };
}

export function directArb(): BacktestResult {
  return runBacktest(ARB_TICKS, createArbitrageStrategy(ARB_CONFIG), 10_000);
}

export function directMr(): BacktestResult {
  return runBacktest(MR_TICKS, createMeanReversionStrategy(MR_CONFIG), 10_000);
}

export function directRebal(): BacktestResult {
  const { ticks, initialBalance, initialPositions, costModel } = SCENARIO_FIXTURE;
  return runBacktest(
    ticks,
    createGoldExposureRebalancer(REBAL_CONFIG),
    initialBalance,
    initialPositions,
    costModel,
  );
}

export function directHold(): BacktestResult {
  const { ticks, initialBalance, initialPositions, costModel } = SCENARIO_FIXTURE;
  return runBacktest(ticks, createHoldStrategy(), initialBalance, initialPositions, costModel);
}

export function directRegimeArb(): BacktestResult {
  return runBacktest(REGIME_ARB_TICKS, createArbitrageStrategy(REGIME_ARB_CONFIG), 10_000);
}

export function stripTradeIds(result: BacktestResult): Omit<BacktestResult, 'trades'> & {
  trades: Array<Omit<BacktestResult['trades'][number], 'id'>>;
} {
  return {
    ...result,
    trades: result.trades.map(({ id: _id, ...trade }) => trade),
  };
}

/** Numeric + trade-leg equality (ids and reason strings excluded). */
export function numericBacktestSlice(result: BacktestResult) {
  return {
    initialBalance: result.initialBalance,
    finalBalance: result.finalBalance,
    totalReturn: result.totalReturn,
    grossTotalReturn: result.grossTotalReturn,
    grossFinalBalance: result.grossFinalBalance,
    totalFeesUsd: result.totalFeesUsd,
    totalSlippageUsd: result.totalSlippageUsd,
    costModel: result.costModel,
    maxDrawdown: result.maxDrawdown,
    totalTrades: result.totalTrades,
    winningTrades: result.winningTrades,
    equityCurve: result.equityCurve,
    trades: result.trades.map(({ id: _id, reason: _reason, ...leg }) => leg),
  };
}
