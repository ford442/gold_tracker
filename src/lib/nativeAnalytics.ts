/**
 * Optional WASM analytics kernel. UI must not import this for .wasm URLs —
 * the analytics worker calls initWasm() once; main-thread fallback stays
 * analyticsDispatch (pure TS).
 */
import { toSymbol } from './assets';
import { dispatchRollingCorrelations, dispatchRunBacktest } from './analyticsDispatch';
import { DEFAULT_REGIME_GATE_CONFIG } from './regime';
import { DEFAULT_COST_MODEL, type BacktestResult, type BacktestTick, type CostModel } from './strategyEngine';
import type {
  RollingCorrelationsPayload,
  RunBacktestPayload,
  StrategyPayload,
} from './analyticsWorkerProtocol';
import type { AlignHistoricalOptions } from './historicalTicks';

interface GtMathModule {
  _malloc: (bytes: number) => number;
  _free: (ptr: number) => void;
  _gt_pearson: (xPtr: number, yPtr: number, n: number) => number;
  _gt_rolling_pearson: (aPtr: number, bPtr: number, n: number, window: number, outPtr: number) => number;
  _gt_max_drawdown: (pPtr: number, n: number) => number;
  _gt_align_ticks: (
    nAssets: number,
    lengthsPtr: number,
    seriesTsPtr: number,
    seriesPxPtr: number,
    nRequired: number,
    requiredPtr: number,
    baseAssetIdx: number,
    maxGapMs: number,
    maxOut: number,
    outTsPtr: number,
    outPxPtr: number,
  ) => number;
  _gt_run_backtest: (
    nTicks: number,
    nAssets: number,
    tsPtr: number,
    pricesPtr: number,
    hasRegimePtr: number,
    regimePtr: number,
    stratKind: number,
    stratIntsPtr: number,
    nStratInts: number,
    stratDoublesPtr: number,
    nStratDoubles: number,
    initialBalance: number,
    nInitPos: number,
    initIdxPtr: number,
    initUnitsPtr: number,
    initAvgPtr: number,
    feeBps: number,
    slipBps: number,
    metricsPtr: number,
    equityTsPtr: number,
    equityValPtr: number,
    maxTrades: number,
    tradesPtr: number,
  ) => number;
  HEAPF64: Float64Array;
  HEAP32: Int32Array;
}

type GlueFactory = (arg?: Record<string, unknown>) => Promise<GtMathModule>;

const STRAT_HOLD = 0;
const STRAT_ARB = 1;
const STRAT_MR = 2;
const STRAT_REBAL = 3;
const SIDE_BUY = 0;

let wasmModule: GtMathModule | null = null;
let initPromise: Promise<boolean> | null = null;
let wasmReady = false;

class HeapSession {
  private readonly ptrs: number[] = [];
  private readonly mod: GtMathModule;

  constructor(mod: GtMathModule) {
    this.mod = mod;
  }

  f64(data: ArrayLike<number>): number {
    if (data.length === 0) return 0;
    const ptr = this.mod._malloc(data.length * 8);
    this.mod.HEAPF64.set(
      data instanceof Float64Array ? data : Float64Array.from(data),
      ptr / 8,
    );
    this.ptrs.push(ptr);
    return ptr;
  }

  i32(data: ArrayLike<number>): number {
    if (data.length === 0) return 0;
    const ptr = this.mod._malloc(data.length * 4);
    this.mod.HEAP32.set(data instanceof Int32Array ? data : Int32Array.from(data), ptr / 4);
    this.ptrs.push(ptr);
    return ptr;
  }

  allocF64(n: number): number {
    if (n <= 0) return 0;
    const ptr = this.mod._malloc(n * 8);
    this.ptrs.push(ptr);
    return ptr;
  }

  release(): void {
    for (const p of this.ptrs) this.mod._free(p);
    this.ptrs.length = 0;
  }
}

/** Public gt-math URL. Dev: Vite public/. Prod worker: sibling of assets/. */
export function publicGtMathUrl(file: string): string {
  if (import.meta.env.PROD) {
    return new URL(`../gt-math/${file}`, import.meta.url).href;
  }
  const base = import.meta.env.BASE_URL || '/';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}gt-math/${file}`;
}

async function loadBrowserGlueFactory(): Promise<GlueFactory | null> {
  try {
    const jsUrl = publicGtMathUrl('gt_math.js');
    const wasmUrl = publicGtMathUrl('gt_math.wasm');
    const imported: unknown = await import(/* @vite-ignore */ jsUrl);
    const factory = (imported as { default?: GlueFactory }).default;
    if (!factory) return null;
    return (arg) => factory({ locateFile: () => wasmUrl, ...arg });
  } catch {
    return null;
  }
}

function adoptModule(mod: GtMathModule): boolean {
  if (typeof mod._gt_pearson !== 'function' || typeof mod._malloc !== 'function') {
    wasmReady = false;
    wasmModule = null;
    return false;
  }
  wasmModule = mod;
  wasmReady = true;
  return true;
}

export function isWasmReady(): boolean {
  return wasmReady && wasmModule !== null;
}

/** Emscripten MODULARIZE factory (gt_math.js default export). */
export type GtMathFactory = GlueFactory;

/** Test/Node helper — inject the Emscripten factory without bundling `node:fs` into the worker. */
export async function initWasmWithFactory(factory: GtMathFactory): Promise<boolean> {
  try {
    const mod = await factory();
    return adoptModule(mod);
  } catch {
    wasmReady = false;
    wasmModule = null;
    return false;
  }
}

/** Idempotent. Never throws. Worker calls this once at module load. */
export function initWasm(): Promise<boolean> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const factory = await loadBrowserGlueFactory();
      if (!factory) {
        wasmReady = false;
        wasmModule = null;
        return false;
      }
      const mod = await factory();
      return adoptModule(mod);
    } catch {
      wasmReady = false;
      wasmModule = null;
      return false;
    }
  })();
  return initPromise;
}

/** @internal */
export function _resetWasmForTests(): void {
  wasmModule = null;
  wasmReady = false;
  initPromise = null;
}

function collectAssets(payload: RunBacktestPayload): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  const add = (id: string) => {
    if (!seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  };
  for (const tick of payload.ticks) {
    for (const id of Object.keys(tick.prices)) add(id);
  }
  if (payload.initialPositions) {
    for (const id of Object.keys(payload.initialPositions)) add(id);
  }
  const s = payload.strategy;
  if (s.kind === 'arbitrage') {
    add(s.config.asset1);
    add(s.config.asset2);
  } else if (s.kind === 'meanReversion') {
    add(s.config.asset);
  } else if (s.kind === 'goldExposureRebalancer') {
    for (const id of s.config.goldAssetIds) add(id);
  } else if (s.kind === 'hold') {
    for (const id of s.requiredAssets ?? []) add(id);
  }
  return order;
}

function packStrategy(
  strategy: StrategyPayload,
  assets: string[],
): { kind: number; ints: Int32Array; doubles: Float64Array } {
  const idx = (id: string) => assets.indexOf(id);
  switch (strategy.kind) {
    case 'hold':
      return { kind: STRAT_HOLD, ints: new Int32Array(0), doubles: new Float64Array(0) };
    case 'arbitrage': {
      const gate = strategy.config.regimeGate?.config ?? DEFAULT_REGIME_GATE_CONFIG;
      return {
        kind: STRAT_ARB,
        ints: Int32Array.from([
          idx(strategy.config.asset1),
          idx(strategy.config.asset2),
          strategy.config.regimeGate?.enabled ? 1 : 0,
        ]),
        doubles: Float64Array.from([
          strategy.config.spreadThreshold,
          strategy.config.tradeSize,
          gate.minFidelityScore,
          gate.fullSizeFidelityScore,
          gate.minSizeMultiplier,
          gate.cryptoDivergenceDelta,
          gate.allowDivergenceOverride ? 1 : 0,
        ]),
      };
    }
    case 'meanReversion':
      return {
        kind: STRAT_MR,
        ints: Int32Array.from([idx(strategy.config.asset), strategy.config.windowSize]),
        doubles: Float64Array.from([
          strategy.config.buyThreshold,
          strategy.config.sellThreshold,
          strategy.config.tradeSize,
          strategy.config.stopLoss,
        ]),
      };
    case 'goldExposureRebalancer': {
      const gold = strategy.config.goldAssetIds;
      const useSize = strategy.config.tradeSizeUsd != null ? 1 : 0;
      return {
        kind: STRAT_REBAL,
        ints: Int32Array.from([gold.length, ...gold.map(idx), useSize]),
        doubles: Float64Array.from([
          strategy.config.targetGoldPct,
          strategy.config.rebalanceBandPct,
          strategy.config.tradeSizeUsd ?? 0,
        ]),
      };
    }
    default: {
      const _exhaustive: never = strategy;
      return _exhaustive;
    }
  }
}

function resolveCost(costModel?: CostModel): CostModel {
  return {
    feeBps: costModel?.feeBps ?? DEFAULT_COST_MODEL.feeBps,
    slippageBps: costModel?.slippageBps ?? DEFAULT_COST_MODEL.slippageBps,
    exchange: costModel?.exchange ?? DEFAULT_COST_MODEL.exchange,
  };
}

function runBacktestWasm(mod: GtMathModule, payload: RunBacktestPayload): BacktestResult {
  const assets = collectAssets(payload);
  const nTicks = payload.ticks.length;
  const nAssets = assets.length;
  const packed = packStrategy(payload.strategy, assets);
  const costs = resolveCost(payload.costModel);
  const heap = new HeapSession(mod);

  try {
    const timestamps = new Float64Array(nTicks);
    const prices = new Float64Array(nTicks * Math.max(nAssets, 1));
    const hasRegime = new Int32Array(nTicks);
    const regimeScores = new Float64Array(nTicks * 6);

    for (let t = 0; t < nTicks; t++) {
      const tick = payload.ticks[t];
      timestamps[t] = tick.timestamp;
      for (let a = 0; a < nAssets; a++) {
        const p = tick.prices[assets[a]];
        // 0 / NaN / missing → 0 (C++ sentinel). Negative prices are stored (JS `if (p)` is truthy).
        prices[t * nAssets + a] =
          typeof p === 'number' && p !== 0 && !Number.isNaN(p) ? p : 0;
      }
      if (tick.regime) {
        hasRegime[t] = 1;
        const { paxg, xaut } = tick.regime;
        const base = t * 6;
        regimeScores[base] = paxg.score;
        regimeScores[base + 1] = paxg.corrToGold;
        regimeScores[base + 2] = paxg.corrToBtc;
        regimeScores[base + 3] = xaut.score;
        regimeScores[base + 4] = xaut.corrToGold;
        regimeScores[base + 5] = xaut.corrToBtc;
      }
    }

    const initEntries = payload.initialPositions
      ? Object.entries(payload.initialPositions)
      : [];
    const initIdx = Int32Array.from(initEntries.map(([id]) => assets.indexOf(id)));
    const initUnits = Float64Array.from(initEntries.map(([, p]) => p.units));
    const initAvg = Float64Array.from(initEntries.map(([, p]) => p.avgCost));

    const maxTrades = nTicks * 4 + initEntries.length + 8;
    const metricsPtr = heap.allocF64(9);
    const equityTsPtr = heap.allocF64(nTicks);
    const equityValPtr = heap.allocF64(nTicks);
    const tradesPtr = heap.allocF64(maxTrades * 8);

    const nTrades = mod._gt_run_backtest(
      nTicks,
      Math.max(nAssets, 1),
      heap.f64(timestamps),
      heap.f64(prices),
      heap.i32(hasRegime),
      heap.f64(regimeScores),
      packed.kind,
      heap.i32(packed.ints),
      packed.ints.length,
      heap.f64(packed.doubles),
      packed.doubles.length,
      payload.initialBalance,
      initEntries.length,
      heap.i32(initIdx),
      heap.f64(initUnits),
      heap.f64(initAvg),
      costs.feeBps,
      costs.slippageBps ?? 0,
      metricsPtr,
      equityTsPtr,
      equityValPtr,
      maxTrades,
      tradesPtr,
    );

    if (nTrades < 0) {
      throw new Error('gt_run_backtest failed');
    }

    const m = new Float64Array(mod.HEAPF64.buffer, metricsPtr, 9);
    const equityCurve =
      nTicks > 0
        ? Array.from({ length: nTicks }, (_, i) => ({
            timestamp: mod.HEAPF64[equityTsPtr / 8 + i],
            value: mod.HEAPF64[equityValPtr / 8 + i],
          }))
        : [];

    const trades: BacktestResult['trades'] = [];
    for (let i = 0; i < nTrades; i++) {
      const row = tradesPtr / 8 + i * 8;
      const assetIdx = Math.round(mod.HEAPF64[row + 1]);
      const side = Math.round(mod.HEAPF64[row + 2]) === SIDE_BUY ? 'BUY' : 'SELL';
      const asset = assets[assetIdx] ?? `asset-${assetIdx}`;
      trades.push({
        id: `wasm-${i}`,
        timestamp: mod.HEAPF64[row],
        asset,
        symbol: toSymbol(asset),
        side,
        price: mod.HEAPF64[row + 3],
        units: mod.HEAPF64[row + 4],
        amountUSD: mod.HEAPF64[row + 5],
        pnl: mod.HEAPF64[row + 6],
        feeUsd: mod.HEAPF64[row + 7],
        reason: '',
      });
    }

    return {
      initialBalance: payload.initialBalance,
      finalBalance: m[0],
      totalReturn: m[1],
      grossTotalReturn: m[2],
      grossFinalBalance: m[3],
      totalFeesUsd: m[4],
      totalSlippageUsd: m[5],
      costModel: costs,
      maxDrawdown: m[6],
      totalTrades: m[7],
      winningTrades: m[8],
      equityCurve,
      trades,
    };
  } finally {
    heap.release();
  }
}

export function runBacktestFromPayload(payload: RunBacktestPayload): BacktestResult {
  if (!isWasmReady() || !wasmModule) {
    return dispatchRunBacktest(payload);
  }
  try {
    return runBacktestWasm(wasmModule, payload);
  } catch {
    return dispatchRunBacktest(payload);
  }
}

export function rollingCorrelationsNative(payload: RollingCorrelationsPayload): number[] {
  if (!isWasmReady() || !wasmModule) {
    return dispatchRollingCorrelations(payload);
  }
  const { seriesA, seriesB, window } = payload;
  const n = Math.min(seriesA.length, seriesB.length);
  if (n < window || window <= 0) return [];
  const heap = new HeapSession(wasmModule);
  try {
    const outLen = n - window + 1;
    const outPtr = heap.allocF64(outLen);
    const written = wasmModule._gt_rolling_pearson(
      heap.f64(seriesA.slice(0, n)),
      heap.f64(seriesB.slice(0, n)),
      n,
      window,
      outPtr,
    );
    if (written <= 0) return [];
    return Array.from(new Float64Array(wasmModule.HEAPF64.buffer, outPtr, written));
  } catch {
    return dispatchRollingCorrelations(payload);
  } finally {
    heap.release();
  }
}

export function pearsonNative(x: number[], y: number[]): number {
  if (!isWasmReady() || !wasmModule) {
    return Number.NaN;
  }
  const n = Math.min(x.length, y.length);
  const heap = new HeapSession(wasmModule);
  try {
    return wasmModule._gt_pearson(heap.f64(x.slice(0, n)), heap.f64(y.slice(0, n)), n);
  } finally {
    heap.release();
  }
}

export function maxDrawdownNative(prices: number[]): number {
  if (!isWasmReady() || !wasmModule) {
    return Number.NaN;
  }
  const heap = new HeapSession(wasmModule);
  try {
    return wasmModule._gt_max_drawdown(heap.f64(prices), prices.length);
  } finally {
    heap.release();
  }
}

export function alignTicksNative(
  seriesByAsset: Record<string, Array<[number, number]>>,
  options: AlignHistoricalOptions = {},
): BacktestTick[] | null {
  if (!isWasmReady() || !wasmModule) return null;
  const assetKeys = Object.keys(seriesByAsset);
  if (assetKeys.length === 0) return [];
  const required = options.requiredAssets ?? assetKeys;
  if (required.length === 0) return [];

  const heap = new HeapSession(wasmModule);
  try {
    const lengths: number[] = [];
    const ts: number[] = [];
    const px: number[] = [];
    for (const key of assetKeys) {
      const series = seriesByAsset[key] ?? [];
      lengths.push(series.length);
      for (const [t, p] of series) {
        ts.push(t);
        px.push(p);
      }
    }
    const requiredIdx = required.map((id) => assetKeys.indexOf(id));
    if (requiredIdx.some((i) => i < 0)) return [];
    const base = options.baseAssetId ? assetKeys.indexOf(options.baseAssetId) : -1;
    const maxGap = options.maxTimeGapMs ?? 4 * 3_600_000;
    const maxOut = Math.max(
      1,
      ...lengths,
    );
    const outTsPtr = heap.allocF64(maxOut);
    const outPxPtr = heap.allocF64(maxOut * assetKeys.length);
    const nOut = wasmModule._gt_align_ticks(
      assetKeys.length,
      heap.i32(lengths),
      heap.f64(ts),
      heap.f64(px),
      required.length,
      heap.i32(requiredIdx),
      base,
      maxGap,
      maxOut,
      outTsPtr,
      outPxPtr,
    );
    const ticks: BacktestTick[] = [];
    for (let i = 0; i < nOut; i++) {
      const prices: Record<string, number> = {};
      for (let a = 0; a < assetKeys.length; a++) {
        const p = wasmModule.HEAPF64[outPxPtr / 8 + i * assetKeys.length + a];
        if (p > 0) prices[assetKeys[a]] = p;
      }
      ticks.push({
        timestamp: wasmModule.HEAPF64[outTsPtr / 8 + i],
        prices,
      });
    }
    return ticks;
  } catch {
    return null;
  } finally {
    heap.release();
  }
}
