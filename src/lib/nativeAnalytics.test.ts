import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, it, expect, beforeAll } from 'vitest';
import { pearsonCorrelation } from './utils';
import { rollingCorrelations, maxDrawdownFromPrices } from './regime';
import { alignHistoricalSeriesToTicks } from './historicalTicks';
import { dispatchRunBacktest, dispatchRollingCorrelations } from './analyticsDispatch';
import {
  alignTicksNative,
  initWasmWithFactory,
  isWasmReady,
  maxDrawdownNative,
  pearsonNative,
  rollingCorrelationsNative,
  runBacktestFromPayload,
  _resetWasmForTests,
} from './nativeAnalytics';
import {
  arbPayload,
  holdPayload,
  mrPayload,
  numericBacktestSlice,
  rebalPayload,
  regimeArbPayload,
  ROLLING_SERIES_A,
  ROLLING_SERIES_B,
  ROLLING_WINDOW,
} from './analyticsFixtures';

const wasmPath = resolve(process.cwd(), 'public/gt-math/gt_math.wasm');
const hasWasm = existsSync(wasmPath);
const requireWasm = process.env.GT_MATH_REQUIRE_WASM === '1';

if (requireWasm && !hasWasm) {
  throw new Error(
    'GT_MATH_REQUIRE_WASM=1 but public/gt-math/gt_math.wasm is missing. Run npm run build:wasm.',
  );
}

describe('nativeAnalytics TS fallback', () => {
  it('runBacktestFromPayload matches dispatch when WASM is not loaded', () => {
    _resetWasmForTests();
    expect(isWasmReady()).toBe(false);
    expect(numericBacktestSlice(runBacktestFromPayload(arbPayload()))).toEqual(
      numericBacktestSlice(dispatchRunBacktest(arbPayload())),
    );
  });

  it('rollingCorrelationsNative matches dispatch when WASM is not loaded', () => {
    _resetWasmForTests();
    const payload = { seriesA: ROLLING_SERIES_A, seriesB: ROLLING_SERIES_B, window: ROLLING_WINDOW };
    expect(rollingCorrelationsNative(payload)).toEqual(dispatchRollingCorrelations(payload));
  });
});

describe.skipIf(!hasWasm)('nativeAnalytics WASM parity', () => {
  beforeAll(async () => {
    const jsPath = resolve(process.cwd(), 'public/gt-math/gt_math.js');
    const imported: unknown = await import(pathToFileURL(jsPath).href);
    const factory = (imported as { default: Parameters<typeof initWasmWithFactory>[0] }).default;
    const ok = await initWasmWithFactory(factory);
    expect(ok).toBe(true);
    expect(isWasmReady()).toBe(true);
  });

  it('pearson matches TS', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 6, 8, 10];
    expect(pearsonNative(x, y)).toBeCloseTo(pearsonCorrelation(x, y), 12);
  });

  it('max drawdown matches TS', () => {
    const prices = [100, 110, 90, 95, 80, 120];
    expect(maxDrawdownNative(prices)).toBe(maxDrawdownFromPrices(prices));
  });

  it('rolling correlations match dispatch', () => {
    const payload = { seriesA: ROLLING_SERIES_A, seriesB: ROLLING_SERIES_B, window: ROLLING_WINDOW };
    expect(rollingCorrelationsNative(payload)).toEqual(rollingCorrelations(payload.seriesA, payload.seriesB, payload.window));
  });

  it('align ticks match TS reference', () => {
    const seriesByAsset = {
      'pax-gold': [
        [1000, 3280],
        [2000, 3285],
        [3000, 3290],
      ] as Array<[number, number]>,
      'tether-gold': [
        [1005, 3282],
        [1990, 3284],
        [3010, 3291],
      ] as Array<[number, number]>,
    };
    const opts = { requiredAssets: ['pax-gold', 'tether-gold'], maxTimeGapMs: 100 };
    const wasm = alignTicksNative(seriesByAsset, opts);
    const ts = alignHistoricalSeriesToTicks(seriesByAsset, opts);
    expect(wasm).toEqual(ts);
  });

  it('arbitrage backtest matches TS numeric legs', () => {
    expect(numericBacktestSlice(runBacktestFromPayload(arbPayload()))).toEqual(
      numericBacktestSlice(dispatchRunBacktest(arbPayload())),
    );
  });

  it('mean-reversion backtest matches TS numeric legs', () => {
    expect(numericBacktestSlice(runBacktestFromPayload(mrPayload()))).toEqual(
      numericBacktestSlice(dispatchRunBacktest(mrPayload())),
    );
  });

  it('rebalancer + hold backtests match TS numeric legs', () => {
    expect(numericBacktestSlice(runBacktestFromPayload(rebalPayload()))).toEqual(
      numericBacktestSlice(dispatchRunBacktest(rebalPayload())),
    );
    expect(numericBacktestSlice(runBacktestFromPayload(holdPayload()))).toEqual(
      numericBacktestSlice(dispatchRunBacktest(holdPayload())),
    );
  });

  it('regime-gated arbitrage matches TS numeric legs', () => {
    expect(numericBacktestSlice(runBacktestFromPayload(regimeArbPayload()))).toEqual(
      numericBacktestSlice(dispatchRunBacktest(regimeArbPayload())),
    );
  });

  it('synthetic stress: 10k rolling corr and 5k-tick hold (timing only)', () => {
    const n = 10_000;
    const a = Array.from({ length: n }, (_, i) => Math.sin(i / 17) * 10 + 100);
    const b = Array.from({ length: n }, (_, i) => Math.cos(i / 19) * 8 + 200);
    const window = 60;

    const t0 = performance.now();
    const tsRoll = rollingCorrelations(a, b, window);
    const tsRollMs = performance.now() - t0;

    const t1 = performance.now();
    const wasmRoll = rollingCorrelationsNative({ seriesA: a, seriesB: b, window });
    const wasmRollMs = performance.now() - t1;

    expect(wasmRoll).toEqual(tsRoll);

    const ticks = Array.from({ length: 5_000 }, (_, i) => ({
      timestamp: 1_700_000_000_000 + i * 3_600_000,
      prices: { 'pax-gold': 3300 + Math.sin(i / 50), 'tether-gold': 3295 + Math.cos(i / 50) },
    }));
    const hold = {
      ticks,
      strategy: { kind: 'hold' as const },
      initialBalance: 10_000,
    };

    const t2 = performance.now();
    const tsHold = dispatchRunBacktest(hold);
    const tsHoldMs = performance.now() - t2;

    const t3 = performance.now();
    const wasmHold = runBacktestFromPayload(hold);
    const wasmHoldMs = performance.now() - t3;

    expect(numericBacktestSlice(wasmHold)).toEqual(numericBacktestSlice(tsHold));

    console.info(
      `[gt-math bench] rolling 10k w=60  TS=${tsRollMs.toFixed(2)}ms WASM=${wasmRollMs.toFixed(2)}ms | hold 5k ticks  TS=${tsHoldMs.toFixed(2)}ms WASM=${wasmHoldMs.toFixed(2)}ms`,
    );
  });
});

if (!hasWasm) {
  it('skips WASM parity because public/gt-math/gt_math.wasm is missing (run npm run build:wasm)', () => {
    expect(requireWasm).toBe(false);
  });
}
