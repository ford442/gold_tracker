import { describe, it, expect } from 'vitest';
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
} from './strategyEngine';
import { rollingCorrelations } from './regime';
import { dispatchRunBacktest, dispatchRollingCorrelations } from './analyticsDispatch';
import { runBacktestAsync, rollingCorrelationsAsync } from './workerClient';
import { DEFAULT_REGIME_GATE_CONFIG } from './regime';

function stripTradeIds(result: BacktestResult): Omit<BacktestResult, 'trades'> & {
  trades: Array<Omit<BacktestResult['trades'][number], 'id'>>;
} {
  return {
    ...result,
    trades: result.trades.map(({ id: _id, ...trade }) => trade),
  };
}

function expectBacktestParity(a: BacktestResult, b: BacktestResult) {
  expect(stripTradeIds(a)).toEqual(stripTradeIds(b));
}

function makeTicks(
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

const SCENARIO_FIXTURE = {
  ticks: applyShocksToTicks(generateBaseScenarioTicks(120), { 'pax-gold': 0.05, bitcoin: -0.1 }),
  initialBalance: 25_000,
  initialPositions: {
    'pax-gold': { units: 2, avgCost: 3200 },
    bitcoin: { units: 0.1, avgCost: 90_000 },
  },
  costModel: EXCHANGE_COST_PRESETS.kraken,
};

describe('dispatchRunBacktest', () => {
  it('matches direct runBacktest for arbitrage', () => {
    const ticks = makeTicks({
      'pax-gold': Array(5).fill(3300).concat(Array(5).fill(3290)),
      'tether-gold': Array(5).fill(3280).concat(Array(5).fill(3288)),
    });
    const config = {
      asset1: 'pax-gold',
      asset2: 'tether-gold',
      spreadThreshold: 0.25,
      tradeSize: 1000,
    };
    const direct = runBacktest(ticks, createArbitrageStrategy(config), 10_000);
    const dispatched = dispatchRunBacktest({
      ticks,
      strategy: { kind: 'arbitrage', config },
      initialBalance: 10_000,
    });
    expectBacktestParity(dispatched, direct);
  });

  it('matches direct runBacktest for mean reversion', () => {
    const ticks = makeTicks({ bitcoin: [100, 99, 98, 97, 96, 95, 94, 93, 92, 91, 90, 89] });
    const config = {
      asset: 'bitcoin',
      windowSize: 4,
      buyThreshold: 1,
      sellThreshold: 1,
      tradeSize: 500,
      stopLoss: 5,
    };
    const direct = runBacktest(ticks, createMeanReversionStrategy(config), 10_000);
    const dispatched = dispatchRunBacktest({
      ticks,
      strategy: { kind: 'meanReversion', config },
      initialBalance: 10_000,
    });
    expectBacktestParity(dispatched, direct);
  });

  it('matches direct runBacktest for scenario lab rebalancer + hold', () => {
    const rebalCfg = {
      goldAssetIds: ['pax-gold', 'tether-gold'],
      targetGoldPct: 0.55,
      rebalanceBandPct: 0.05,
    };
    const { ticks, initialBalance, initialPositions, costModel } = SCENARIO_FIXTURE;

    const directPrimary = runBacktest(
      ticks,
      createGoldExposureRebalancer(rebalCfg),
      initialBalance,
      initialPositions,
      costModel,
    );
    const directHold = runBacktest(
      ticks,
      createHoldStrategy(),
      initialBalance,
      initialPositions,
      costModel,
    );

    const dispatchedPrimary = dispatchRunBacktest({
      ticks,
      strategy: { kind: 'goldExposureRebalancer', config: rebalCfg },
      initialBalance,
      initialPositions,
      costModel,
    });
    const dispatchedHold = dispatchRunBacktest({
      ticks,
      strategy: { kind: 'hold' },
      initialBalance,
      initialPositions,
      costModel,
    });

    expectBacktestParity(dispatchedPrimary, directPrimary);
    expectBacktestParity(dispatchedHold, directHold);
  });

  it('matches direct runBacktest with regime gate config', () => {
    const ticks = makeTicks({
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

    const config = {
      asset1: 'pax-gold',
      asset2: 'tether-gold',
      spreadThreshold: 0.25,
      tradeSize: 1000,
      regimeGate: { enabled: true, config: DEFAULT_REGIME_GATE_CONFIG },
    };

    const direct = runBacktest(ticks, createArbitrageStrategy(config), 10_000);
    const dispatched = dispatchRunBacktest({
      ticks,
      strategy: { kind: 'arbitrage', config },
      initialBalance: 10_000,
    });
    expectBacktestParity(dispatched, direct);
  });
});

describe('dispatchRollingCorrelations', () => {
  const seriesA = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i / 3) * 5);
  const seriesB = Array.from({ length: 40 }, (_, i) => 200 + Math.cos(i / 3) * 8);
  const window = 12;

  it('matches direct rollingCorrelations', () => {
    const direct = rollingCorrelations(seriesA, seriesB, window);
    const dispatched = dispatchRollingCorrelations({ seriesA, seriesB, window });
    expect(dispatched).toEqual(direct);
  });
});

describe('workerClient main-thread fallback', () => {
  it('runBacktestAsync with forceMainThread matches dispatch', async () => {
    const { ticks, initialBalance, initialPositions, costModel } = SCENARIO_FIXTURE;
    const rebalCfg = {
      goldAssetIds: ['pax-gold', 'tether-gold'],
      targetGoldPct: 0.55,
      rebalanceBandPct: 0.05,
    };

    const dispatched = dispatchRunBacktest({
      ticks,
      strategy: { kind: 'goldExposureRebalancer', config: rebalCfg },
      initialBalance,
      initialPositions,
      costModel,
    });
    const viaClient = await runBacktestAsync(
      {
        ticks,
        strategy: { kind: 'goldExposureRebalancer', config: rebalCfg },
        initialBalance,
        initialPositions,
        costModel,
      },
      { forceMainThread: true },
    );
    expectBacktestParity(viaClient, dispatched);
  });

  it('rollingCorrelationsAsync with forceMainThread matches dispatch', async () => {
    const seriesA = Array.from({ length: 60 }, (_, i) => 3290 + i * 0.5);
    const seriesB = Array.from({ length: 60 }, (_, i) => 3285 + i * 0.48);
    const window = 15;

    const dispatched = dispatchRollingCorrelations({ seriesA, seriesB, window });
    const viaClient = await rollingCorrelationsAsync(
      { seriesA, seriesB, window },
      { forceMainThread: true },
    );
    expect(viaClient).toEqual(dispatched);
  });
});
