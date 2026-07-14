import { describe, expect, it } from 'vitest';
import type { BacktestTick } from './strategyEngine';
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
import { DEFAULT_REGIME_GATE_CONFIG } from './regime';

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

describe('createHoldStrategy', () => {
  it('emits no trades during the simulation', () => {
    const ticks = makeTicks({ 'pax-gold': [3300, 3301, 3302, 3303] });
    const result = runBacktest(ticks, createHoldStrategy(), 10_000);
    expect(result.trades.filter((t) => t.reason !== 'End of backtest — position closed')).toHaveLength(0);
  });
});

describe('createArbitrageStrategy + runBacktest', () => {
  it('opens on wide spread and closes on convergence', () => {
    const wide = { 'pax-gold': 3300, 'tether-gold': 3280 }; // ~0.61% spread
    const narrow = { 'pax-gold': 3290, 'tether-gold': 3288 }; // ~0.06% spread

    const ticks = makeTicks({
      'pax-gold': Array(5).fill(wide['pax-gold']).concat(Array(5).fill(narrow['pax-gold'])),
      'tether-gold': Array(5).fill(wide['tether-gold']).concat(Array(5).fill(narrow['tether-gold'])),
    });

    const strategy = createArbitrageStrategy({
      asset1: 'pax-gold',
      asset2: 'tether-gold',
      spreadThreshold: 0.25,
      tradeSize: 1000,
    });

    const result = runBacktest(ticks, strategy, 10_000);

    const buys = result.trades.filter((t) => t.side === 'BUY');
    const sells = result.trades.filter((t) => t.side === 'SELL' && t.reason.includes('converged'));

    expect(buys.length).toBeGreaterThanOrEqual(1);
    expect(buys[0].asset).toBe('tether-gold'); // cheaper asset when paxg > xaut
    expect(sells.length).toBeGreaterThanOrEqual(1);
  });

  it('blocks entries when regime gate disallows (low fidelity, no override)', () => {
    const wide = { 'pax-gold': 3300, 'tether-gold': 3280 };
    const ticks = makeTicks({
      'pax-gold': Array(10).fill(wide['pax-gold']),
      'tether-gold': Array(10).fill(wide['tether-gold']),
    }).map((t) => ({
      ...t,
      regime: {
        paxg: {
          score: 30,
          corrToGold: 0.4,
          corrToBtc: 0.5,
          corrToEth: 0.4,
          realizedVol: 15,
          maxDrawdown: 8,
          regimeLabel: 'Crypto-beta dominant',
        },
        xaut: {
          score: 28,
          corrToGold: 0.38,
          corrToBtc: 0.55,
          corrToEth: 0.42,
          realizedVol: 16,
          maxDrawdown: 9,
          regimeLabel: 'Crypto-beta dominant',
        },
      },
    }));

    const strategy = createArbitrageStrategy({
      asset1: 'pax-gold',
      asset2: 'tether-gold',
      spreadThreshold: 0.25,
      tradeSize: 1000,
      regimeGate: {
        enabled: true,
        config: { ...DEFAULT_REGIME_GATE_CONFIG, allowDivergenceOverride: false },
      },
    });

    const result = runBacktest(ticks, strategy, 10_000);
    expect(result.trades.filter((t) => t.side === 'BUY')).toHaveLength(0);
  });

  it('scales trade size when regime gate allows partial fidelity', () => {
    const wide = { 'pax-gold': 3300, 'tether-gold': 3280 };
    const ticks = makeTicks({
      'pax-gold': Array(3).fill(wide['pax-gold']),
      'tether-gold': Array(3).fill(wide['tether-gold']),
    }).map((t) => ({
      ...t,
      regime: {
        paxg: {
          score: 55,
          corrToGold: 0.8,
          corrToBtc: 0.45,
          corrToEth: 0.4,
          realizedVol: 12,
          maxDrawdown: 5,
          regimeLabel: 'Moderate gold tracking',
        },
        xaut: {
          score: 55,
          corrToGold: 0.79,
          corrToBtc: 0.44,
          corrToEth: 0.41,
          realizedVol: 12,
          maxDrawdown: 5,
          regimeLabel: 'Moderate gold tracking',
        },
      },
    }));

    const strategy = createArbitrageStrategy({
      asset1: 'pax-gold',
      asset2: 'tether-gold',
      spreadThreshold: 0.25,
      tradeSize: 1000,
      regimeGate: { enabled: true },
    });

    const result = runBacktest(ticks, strategy, 10_000);
    const buy = result.trades.find((t) => t.side === 'BUY');
    expect(buy).toBeDefined();
    expect(buy!.amountUSD).toBeLessThan(1000);
    expect(buy!.reason).toContain('Regime OK');
  });
});

describe('createMeanReversionStrategy + runBacktest', () => {
  it('buys below SMA and sells on take-profit', () => {
    // SMA(3) of [100,100,100] = 100; dip to 95 triggers buy; recovery to 103 triggers sell
    const prices = [100, 100, 100, 95, 95, 103, 103];
    const ticks = makeTicks({ bitcoin: prices });

    const strategy = createMeanReversionStrategy({
      asset: 'bitcoin',
      windowSize: 3,
      buyThreshold: 2,
      sellThreshold: 2,
      tradeSize: 500,
      stopLoss: 10,
    });

    const result = runBacktest(ticks, strategy, 10_000);

    const buys = result.trades.filter((t) => t.side === 'BUY');
    const takeProfits = result.trades.filter((t) => t.side === 'SELL' && t.reason.includes('Take-profit'));

    expect(buys.length).toBeGreaterThanOrEqual(1);
    expect(takeProfits.length).toBeGreaterThanOrEqual(1);
  });
});

describe('createGoldExposureRebalancer + runBacktest', () => {
  it('buys gold sleeve when under target allocation', () => {
    const ticks = makeTicks({
      bitcoin: Array(10).fill(10_000),
      'pax-gold': Array(10).fill(3_300),
    });

    const strategy = createGoldExposureRebalancer({
      goldAssetIds: ['pax-gold'],
      targetGoldPct: 0.6,
      rebalanceBandPct: 0.05,
      tradeSizeUsd: 2000,
    });

    // Cash-only portfolio: 0% gold → rebalancer buys from available USD
    const result = runBacktest(ticks, strategy, 10_000);

    const goldBuys = result.trades.filter((t) => t.side === 'BUY' && t.asset === 'pax-gold');
    expect(goldBuys.length).toBeGreaterThanOrEqual(1);
    expect(goldBuys[0].reason).toContain('Rebalance');
  });
});

describe('runBacktest cost model', () => {
  it('defaults to zero fees — gross and net returns match', () => {
    const ticks = makeTicks({ 'pax-gold': [3300, 3300, 3300] });
    const result = runBacktest(ticks, createHoldStrategy(['pax-gold']), 5000);

    expect(result.totalFeesUsd).toBe(0);
    expect(result.totalSlippageUsd).toBe(0);
    expect(result.grossTotalReturn).toBeCloseTo(result.totalReturn, 8);
    expect(result.grossFinalBalance).toBeCloseTo(result.finalBalance, 8);
    expect(result.costModel.feeBps).toBe(0);
  });

  it('deducts predictable fees on a single round-trip', () => {
    const prices = [100, 100, 100, 95, 95, 103, 103];
    const ticks = makeTicks({ bitcoin: prices });
    const strategy = createMeanReversionStrategy({
      asset: 'bitcoin',
      windowSize: 3,
      buyThreshold: 2,
      sellThreshold: 2,
      tradeSize: 1000,
      stopLoss: 10,
    });

    const gross = runBacktest(ticks, strategy, 10_000, undefined, EXCHANGE_COST_PRESETS.none);
    const net = runBacktest(ticks, strategy, 10_000, undefined, { feeBps: 60, slippageBps: 0 });

    expect(gross.trades.filter((t) => t.side === 'BUY').length).toBeGreaterThanOrEqual(1);
    expect(net.totalFeesUsd).toBeGreaterThan(0);
    expect(net.finalBalance).toBeLessThan(gross.finalBalance);
    expect(net.totalReturn).toBeLessThan(gross.totalReturn);
    expect(net.grossFinalBalance).toBeCloseTo(gross.finalBalance, 2);
    expect(net.trades.every((t) => t.feeUsd >= 0)).toBe(true);
    expect(net.trades.filter((t) => t.side === 'BUY').every((t) => t.feeUsd > 0)).toBe(true);
  });

  it('reduces arbitrage equity when Coinbase fees are applied', () => {
    const wide = { 'pax-gold': 3300, 'tether-gold': 3280 };
    const narrow = { 'pax-gold': 3290, 'tether-gold': 3288 };

    const ticks = makeTicks({
      'pax-gold': Array(5).fill(wide['pax-gold']).concat(Array(5).fill(narrow['pax-gold'])),
      'tether-gold': Array(5).fill(wide['tether-gold']).concat(Array(5).fill(narrow['tether-gold'])),
    });

    const strategy = createArbitrageStrategy({
      asset1: 'pax-gold',
      asset2: 'tether-gold',
      spreadThreshold: 0.25,
      tradeSize: 1000,
    });

    const noFees = runBacktest(ticks, strategy, 10_000, undefined, EXCHANGE_COST_PRESETS.none);
    const coinbase = runBacktest(ticks, strategy, 10_000, undefined, EXCHANGE_COST_PRESETS.coinbase);
    const kraken = runBacktest(ticks, strategy, 10_000, undefined, EXCHANGE_COST_PRESETS.kraken);

    expect(coinbase.finalBalance).toBeLessThan(noFees.finalBalance);
    expect(kraken.finalBalance).toBeLessThan(noFees.finalBalance);
    expect(kraken.finalBalance).toBeGreaterThan(coinbase.finalBalance);
    expect(coinbase.totalFeesUsd).toBeGreaterThan(kraken.totalFeesUsd);
    expect(coinbase.grossFinalBalance).toBeCloseTo(noFees.finalBalance, 1);
  });
});

describe('runBacktest', () => {
  it('tracks equity curve and computes return metrics', () => {
    const ticks = makeTicks({ 'pax-gold': [3300, 3300, 3300] });
    const result = runBacktest(ticks, createHoldStrategy(['pax-gold']), 5000);

    expect(result.equityCurve).toHaveLength(3);
    expect(result.initialBalance).toBe(5000);
    expect(result.finalBalance).toBe(5000);
    expect(result.totalReturn).toBeCloseTo(0, 5);
    expect(result.maxDrawdown).toBeGreaterThanOrEqual(0);
  });

  it('seeds initial positions and marks to market', () => {
    const ticks = makeTicks({ 'pax-gold': [3300, 3400, 3500] });
    const result = runBacktest(
      ticks,
      createHoldStrategy(),
      0,
      { 'pax-gold': { units: 1, avgCost: 3300 } },
    );

    expect(result.finalBalance).toBeGreaterThan(3300);
    expect(result.trades.some((t) => t.reason === 'End of backtest — position closed')).toBe(true);
  });
});

describe('applyShocksToTicks', () => {
  it('applies multiplicative shocks without mutating input', () => {
    const base: BacktestTick[] = [
      { timestamp: 1, prices: { 'pax-gold': 3300, bitcoin: 100_000 } },
      { timestamp: 2, prices: { 'pax-gold': 3310, bitcoin: 101_000 } },
    ];
    const shocked = applyShocksToTicks(base, { 'pax-gold': 1.1, bitcoin: 0.9 });

    expect(base[0].prices['pax-gold']).toBe(3300);
    expect(shocked[0].prices['pax-gold']).toBeCloseTo(3630, 5);
    expect(shocked[0].prices.bitcoin).toBeCloseTo(90_000, 5);
    expect(shocked[1].prices['pax-gold']).toBeCloseTo(3641, 5);
  });

  it('leaves unshocked assets unchanged', () => {
    const base: BacktestTick[] = [{ timestamp: 1, prices: { 'pax-gold': 3300, bitcoin: 100_000 } }];
    const shocked = applyShocksToTicks(base, { 'pax-gold': 1.05 });
    expect(shocked[0].prices.bitcoin).toBe(100_000);
  });
});

describe('generateBaseScenarioTicks', () => {
  it('produces the requested number of ticks with all base assets', () => {
    const ticks = generateBaseScenarioTicks(50, { 'pax-gold': 3300, bitcoin: 100_000 });
    expect(ticks).toHaveLength(50);
    expect(ticks[0].prices['pax-gold']).toBeGreaterThan(0);
    expect(ticks[0].prices.bitcoin).toBeGreaterThan(0);
    expect(ticks[49].timestamp).toBeGreaterThan(ticks[0].timestamp);
  });
});
