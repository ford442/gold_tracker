// ─────────────────────────────────────────────────────────────────────────────
// GoldTrackr – Strategy Engine
// Pure TypeScript; no React imports. All simulation logic lives here.
// ─────────────────────────────────────────────────────────────────────────────

import { takerFeeBps } from './exchanges';

// ─── Public Types ────────────────────────────────────────────────────────────

/** A single price snapshot across one or more assets at a given moment. */
export interface BacktestTick {
  timestamp: number;                 // Unix ms
  prices: Record<string, number>;   // assetId → USD price
  /** Optional regime context for gated strategies (e.g. PAXG/XAUT arb). */
  regime?: {
    paxg: import('@/types').FidelityScore;
    xaut: import('@/types').FidelityScore;
  };
}

/** Per-leg trading cost assumptions applied inside runBacktest. */
export interface CostModel {
  /** Exchange fee in basis points charged on each fill (BUY or SELL leg). */
  feeBps: number;
  /** Optional adverse slippage in bps (worse fill vs mid price). */
  slippageBps?: number;
  exchange?: 'coinbase' | 'kraken' | 'custom';
}

/** Zero-cost default — preserves pre-fee backtest behaviour. */
export const DEFAULT_COST_MODEL: CostModel = { feeBps: 0, slippageBps: 0, exchange: 'custom' };

/**
 * Exchange fee presets, sourced from the venue registry (`exchanges.ts`) so
 * fees live in one config: Coinbase ~0.6% per leg (≈1.2% round-trip
 * PAXG→USD→XAUT); Kraken ~0.26% for a direct PAXG/XAUT leg.
 */
export const EXCHANGE_COST_PRESETS = {
  none: { feeBps: 0, slippageBps: 0, exchange: 'custom' } satisfies CostModel,
  coinbase: { feeBps: takerFeeBps('coinbase'), slippageBps: 0, exchange: 'coinbase' } satisfies CostModel,
  kraken: { feeBps: takerFeeBps('kraken'), slippageBps: 0, exchange: 'kraken' } satisfies CostModel,
} as const;

export type ExchangeCostPreset = keyof typeof EXCHANGE_COST_PRESETS;

/** One executed trade recorded in the simulation log. */
export interface TradeLog {
  id: string;
  timestamp: number;
  asset: string;     // CoinGecko ID e.g. 'pax-gold', 'bitcoin'
  symbol: string;    // Display ticker e.g. 'PAXG', 'BTC'
  side: 'BUY' | 'SELL';
  price: number;
  units: number;
  amountUSD: number;
  pnl: number;       // 0 for BUYs; realised P&L for SELLs (net of fees when costs enabled)
  feeUsd: number;    // exchange fee charged on this leg
  reason: string;
}

/** One equity sample recorded per tick. */
export interface EquityPoint {
  timestamp: number;
  value: number;
}

/** Complete result returned by runBacktest. */
export interface BacktestResult {
  initialBalance: number;
  /** Net final equity after fees/slippage (same as equityCurve terminus). */
  finalBalance: number;
  /** Net return % — primary metric when costs are enabled. */
  totalReturn: number;
  /** Return % before fees/slippage drag (equals totalReturn when feeBps = 0). */
  grossTotalReturn: number;
  /** Final equity before fee/slippage drag is added back. */
  grossFinalBalance: number;
  /** Sum of exchange fees paid across all legs. */
  totalFeesUsd: number;
  /** Sum of slippage cost (mid vs effective fill) across all legs. */
  totalSlippageUsd: number;
  /** Cost model used for this run (always present; defaults to zero fees). */
  costModel: CostModel;
  maxDrawdown: number;    // percent (positive number)
  totalTrades: number;    // completed round trips (SELL count)
  winningTrades: number;
  equityCurve: EquityPoint[];
  trades: TradeLog[];
}

/** Mutable engine state exposed (read-only) to strategies each tick. */
export interface EngineState {
  balanceUSD: number;
  positions: Record<string, { units: number; avgCost: number }>;
}

/** A signal emitted by a strategy asking the engine to execute a trade. */
export interface TradeSignal {
  asset: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  /** USD amount to spend on a BUY; unused for SELL (full position is liquidated). */
  amountUSD: number;
  reason: string;
}

/** Interface every concrete strategy must implement. */
export interface TradingStrategy {
  name: string;
  description: string;
  requiredAssets: string[];
  onTick: (tick: BacktestTick, state: Readonly<EngineState>) => TradeSignal[];
}

// ─── Internal helpers ────────────────────────────────────────────────────────

import { toSymbol } from './assets';
import {
  DEFAULT_REGIME_GATE_CONFIG,
  evaluateArbRegimeGate,
  type RegimeGateConfig,
} from './regime';

let _idCounter = 0;
function nextId(): string {
  return `trade-${Date.now()}-${++_idCounter}`;
}

function effectiveBuyPrice(midPrice: number, slippageBps: number): number {
  return midPrice * (1 + slippageBps / 10_000);
}

function effectiveSellPrice(midPrice: number, slippageBps: number): number {
  return midPrice * (1 - slippageBps / 10_000);
}

function legFee(notionalUsd: number, feeBps: number): number {
  return notionalUsd * feeBps / 10_000;
}

function resolveCostModel(costModel?: CostModel): CostModel {
  return {
    feeBps: costModel?.feeBps ?? 0,
    slippageBps: costModel?.slippageBps ?? 0,
    exchange: costModel?.exchange ?? 'custom',
  };
}
// ─── Strategy: Arbitrage ─────────────────────────────────────────────────────

export interface ArbConfig {
  asset1: string;           // e.g. 'pax-gold'
  asset2: string;           // e.g. 'tether-gold'
  spreadThreshold: number;  // percent, e.g. 0.25
  tradeSize: number;        // USD per entry
  /** Optional structural fidelity gate — blocks/scales entries only. */
  regimeGate?: {
    enabled: boolean;
    config?: RegimeGateConfig;
  };
}

/**
 * Arbitrage Strategy
 *
 * When the spread between two correlated assets (PAXG / XAUT) exceeds
 * `spreadThreshold` %, buy the cheaper one.  Sell when the spread
 * collapses to ≤ threshold/2 %, locking in the convergence profit.
 *
 * Only one position may be open at a time (long the cheaper asset).
 */
export function createArbitrageStrategy(config: ArbConfig): TradingStrategy {
  const { asset1, asset2, spreadThreshold, tradeSize, regimeGate } = config;
  const gateConfig = regimeGate?.config ?? DEFAULT_REGIME_GATE_CONFIG;

  // Closure state
  let openSide: 'long1' | 'long2' | null = null;

  return {
    name: 'Arbitrage',
    description: `${toSymbol(asset1)} ↔ ${toSymbol(asset2)} spread arb (threshold ${spreadThreshold}%)`,
    requiredAssets: [asset1, asset2],

    onTick(tick, state): TradeSignal[] {
      const p1 = tick.prices[asset1];
      const p2 = tick.prices[asset2];
      if (!p1 || !p2) return [];

      // spread: positive means asset1 is MORE expensive than asset2
      const spread = ((p1 - p2) / p2) * 100;
      const signals: TradeSignal[] = [];

      if (openSide === null) {
        // Open a new position if spread is wide enough
        if (Math.abs(spread) > spreadThreshold) {
          let effectiveTradeSize = tradeSize;
          let regimeSuffix = '';

          if (regimeGate?.enabled && tick.regime) {
            const gate = evaluateArbRegimeGate(tick.regime.paxg, tick.regime.xaut, gateConfig);
            if (!gate.allowed) return [];
            effectiveTradeSize = tradeSize * gate.sizeMultiplier;
            regimeSuffix = ` · ${gate.reason}`;
          }

          if (spread > 0) {
            // asset1 is expensive → buy the cheaper asset2
            if (state.balanceUSD >= 1) {
              signals.push({
                asset: asset2,
                symbol: toSymbol(asset2),
                side: 'BUY',
                amountUSD: Math.min(effectiveTradeSize, state.balanceUSD),
                reason: `Spread +${spread.toFixed(3)}% — buying cheaper ${toSymbol(asset2)}${regimeSuffix}`,
              });
              openSide = 'long2';
            }
          } else {
            // asset2 is expensive → buy the cheaper asset1
            if (state.balanceUSD >= 1) {
              signals.push({
                asset: asset1,
                symbol: toSymbol(asset1),
                side: 'BUY',
                amountUSD: Math.min(effectiveTradeSize, state.balanceUSD),
                reason: `Spread ${spread.toFixed(3)}% — buying cheaper ${toSymbol(asset1)}${regimeSuffix}`,
              });
              openSide = 'long1';
            }
          }
        }
      } else {
        // Close position when spread has mean-reverted to < threshold/2
        if (Math.abs(spread) < spreadThreshold / 2) {
          const assetToSell = openSide === 'long1' ? asset1 : asset2;
          const pos = state.positions[assetToSell];
          if (pos && pos.units > 0) {
            signals.push({
              asset: assetToSell,
              symbol: toSymbol(assetToSell),
              side: 'SELL',
              amountUSD: 0,
              reason: `Spread converged to ${spread.toFixed(3)}% — closing ${toSymbol(assetToSell)}`,
            });
            openSide = null;
          }
        }
      }

      return signals;
    },
  };
}

// ─── Strategy: Mean Reversion ─────────────────────────────────────────────────

export interface MRConfig {
  asset: string;
  windowSize: number;    // SMA period in ticks
  buyThreshold: number;  // % below SMA to trigger BUY
  sellThreshold: number; // % above SMA to trigger SELL (take-profit)
  tradeSize: number;     // USD per entry
  stopLoss: number;      // % below entry price to force-sell
}

/**
 * Mean-Reversion Strategy
 *
 * Maintains a rolling price history of `windowSize` ticks and computes a
 * Simple Moving Average.  Enters long when price dips `buyThreshold` %
 * below SMA.  Exits at take-profit (`sellThreshold` % above SMA) or
 * emergency stop-loss (`stopLoss` % below entry).
 *
 * Only one position is held at a time.
 */
export function createMeanReversionStrategy(config: MRConfig): TradingStrategy {
  const { asset, windowSize, buyThreshold, sellThreshold, tradeSize, stopLoss } = config;

  // Closure state
  const priceHistory: number[] = [];
  let entryPrice: number | null = null;

  return {
    name: 'Mean Reversion',
    description: `${toSymbol(asset)} SMA-${windowSize} reversion (buy ${buyThreshold}% below, sell ${sellThreshold}% above)`,
    requiredAssets: [asset],

    onTick(tick, state): TradeSignal[] {
      const currentPrice = tick.prices[asset];
      if (!currentPrice) return [];

      // Maintain rolling window
      priceHistory.push(currentPrice);
      if (priceHistory.length > windowSize) priceHistory.shift();

      // Need a full window before acting
      if (priceHistory.length < windowSize) return [];

      const sma = priceHistory.reduce((a, b) => a + b, 0) / priceHistory.length;
      const signals: TradeSignal[] = [];
      const hasPosition = !!state.positions[asset] && state.positions[asset].units > 0.000001;

      if (!hasPosition) {
        // BUY: price dropped X% below SMA
        if (currentPrice < sma * (1 - buyThreshold / 100)) {
          if (state.balanceUSD >= 1) {
            signals.push({
              asset,
              symbol: toSymbol(asset),
              side: 'BUY',
              amountUSD: Math.min(tradeSize, state.balanceUSD),
              reason: `Price ${((currentPrice / sma - 1) * 100).toFixed(2)}% below SMA-${windowSize} (${currentPrice.toFixed(2)} vs ${sma.toFixed(2)})`,
            });
            entryPrice = currentPrice;
          }
        }
      } else {
        // SELL: take-profit
        if (currentPrice > sma * (1 + sellThreshold / 100)) {
          signals.push({
            asset,
            symbol: toSymbol(asset),
            side: 'SELL',
            amountUSD: 0,
            reason: `Take-profit: price ${((currentPrice / sma - 1) * 100).toFixed(2)}% above SMA-${windowSize}`,
          });
          entryPrice = null;
        }
        // SELL: stop-loss
        else if (entryPrice !== null && currentPrice < entryPrice * (1 - stopLoss / 100)) {
          signals.push({
            asset,
            symbol: toSymbol(asset),
            side: 'SELL',
            amountUSD: 0,
            reason: `Stop-loss triggered at ${((currentPrice / entryPrice - 1) * 100).toFixed(2)}% from entry ${entryPrice.toFixed(2)}`,
          });
          entryPrice = null;
        }
      }

      return signals;
    },
  };
}

// ─── Benchmark / Scenario Strategies (Feature 3) ─────────────────────────────

/**
 * Hold (no-trade) strategy.
 * Useful as a pure "buy & hold under scenario" benchmark.
 * requiredAssets can be empty (or list the assets you still want price snapshots for).
 */
export function createHoldStrategy(requiredAssets: string[] = []): TradingStrategy {
  return {
    name: 'Hold',
    description: 'Buy & hold benchmark — no rebalancing or signals',
    requiredAssets,
    onTick: () => [],
  };
}

export interface RebalanceConfig {
  /** Asset ids considered part of the "gold sleeve" (e.g. ['pax-gold', 'tether-gold', 'gold']) */
  goldAssetIds: string[];
  /** Target fraction of total equity in the gold sleeve (0.0–1.0), e.g. 0.60 */
  targetGoldPct: number;
  /** Rebalance only when |actual - target| exceeds this band (e.g. 0.05 = 5%) */
  rebalanceBandPct: number;
  /** Optional fixed USD size per rebalance trade; if omitted a proportional adjustment is used */
  tradeSizeUsd?: number;
}

/**
 * Gold Exposure Rebalancer.
 *
 * On every tick computes current gold-sleeve % of total equity (cash + all positions).
 * If outside the band around target, emits BUY (into a gold asset using cash) or
 * SELL (from a gold asset, proceeds become cash / reduce risk sleeve).
 *
 * Works with pre-seeded positions (via runBacktest initialPositions) and with
 * additional cash for DCA-style top-ups.
 *
 * One or more gold assets supported; picks the first for the adjustment (simple).
 */
export function createGoldExposureRebalancer(config: RebalanceConfig): TradingStrategy {
  const { goldAssetIds, targetGoldPct, rebalanceBandPct, tradeSizeUsd } = config;

  return {
    name: 'Gold Exposure Rebalancer',
    description: `Target ${Math.round(targetGoldPct * 100)}% gold sleeve (±${rebalanceBandPct}%)`,
    requiredAssets: goldAssetIds.length ? goldAssetIds : ['pax-gold', 'tether-gold'],

    onTick(tick, state): TradeSignal[] {
      const prices = tick.prices;
      if (!goldAssetIds.length) return [];

      // Total equity (cash + mark-to-market)
      let totalEquity = state.balanceUSD;
      for (const [assetId, pos] of Object.entries(state.positions)) {
        const p = prices[assetId];
        if (p && pos.units > 0) totalEquity += pos.units * p;
      }
      if (totalEquity <= 0) return [];

      // Gold sleeve value
      let goldValue = 0;
      for (const gid of goldAssetIds) {
        const p = prices[gid];
        const pos = state.positions[gid];
        if (p && pos && pos.units > 0) goldValue += pos.units * p;
      }
      const actualPct = goldValue / totalEquity;
      const deviation = Math.abs(actualPct - targetGoldPct);

      const signals: TradeSignal[] = [];
      if (deviation <= rebalanceBandPct) return signals;

      // Pick a gold asset to adjust (first one with a price)
      const targetGoldId = goldAssetIds.find((id) => prices[id] != null) ?? goldAssetIds[0];
      const targetPrice = prices[targetGoldId];
      if (!targetPrice || targetPrice <= 0) return signals;

      const desiredGoldValue = totalEquity * targetGoldPct;
      const deltaValue = desiredGoldValue - goldValue; // >0 → buy gold

      if (Math.abs(deltaValue) < 1) return signals;

      if (deltaValue > 0) {
        // Buy gold sleeve using available cash
        const spend = tradeSizeUsd
          ? Math.min(tradeSizeUsd, state.balanceUSD, deltaValue)
          : Math.min(state.balanceUSD, deltaValue * 0.98); // small buffer
        if (spend >= 1) {
          signals.push({
            asset: targetGoldId,
            symbol: toSymbol(targetGoldId),
            side: 'BUY',
            amountUSD: spend,
            reason: `Rebalance: gold sleeve ${ (actualPct * 100).toFixed(1) }% → target ${ (targetGoldPct * 100).toFixed(1) }% (buy)`,
          });
        }
      } else {
        // Sell gold sleeve (proceeds reduce risk sleeve / become cash)
        const pos = state.positions[targetGoldId];
        if (pos && pos.units > 0.000001) {
          const sellValue = tradeSizeUsd
            ? Math.min(tradeSizeUsd, Math.abs(deltaValue))
            : Math.abs(deltaValue) * 0.98;
          // We liquidate a dollar amount worth of units
          const unitsToSell = Math.min(pos.units, sellValue / targetPrice);
          if (unitsToSell * targetPrice >= 1) {
            signals.push({
              asset: targetGoldId,
              symbol: toSymbol(targetGoldId),
              side: 'SELL',
              amountUSD: 0,
              reason: `Rebalance: gold sleeve ${ (actualPct * 100).toFixed(1) }% → target ${ (targetGoldPct * 100).toFixed(1) }% (sell)`,
            });
          }
        }
      }

      return signals;
    },
  };
}

/**
 * Simple periodic DCA into a target gold asset.
 * Emits a small BUY every `everyNTicks` ticks (using available cash).
 * Can be used standalone or combined with a rebalancer in UI orchestration.
 */
export interface DcaConfig {
  targetAsset: string;
  usdPerPeriod: number;
  everyNTicks: number; // e.g. 24 for "daily" in an hourly-tick simulation
}

export function createPeriodicDcaStrategy(config: DcaConfig): TradingStrategy {
  const { targetAsset, usdPerPeriod, everyNTicks } = config;
  let tickCounter = 0;

  return {
    name: 'Periodic DCA',
    description: `DCA $${usdPerPeriod} into ${toSymbol(targetAsset)} every ${everyNTicks} ticks`,
    requiredAssets: [targetAsset],

    onTick(tick, state): TradeSignal[] {
      tickCounter++;
      const signals: TradeSignal[] = [];
      if (tickCounter % everyNTicks === 0) {
        const p = tick.prices[targetAsset];
        if (p && p > 0 && state.balanceUSD >= 1) {
          const spend = Math.min(usdPerPeriod, state.balanceUSD);
          if (spend >= 1) {
            signals.push({
              asset: targetAsset,
              symbol: toSymbol(targetAsset),
              side: 'BUY',
              amountUSD: spend,
              reason: `DCA period — buying ${toSymbol(targetAsset)}`,
            });
          }
        }
      }
      return signals;
    },
  };
}

// ─── Pure Scenario Helpers (Feature 3) ────────────────────────────────────────

/**
 * Apply per-asset multiplicative shocks to an existing tick series.
 * shocks = { 'pax-gold': 1.10, 'bitcoin': 0.75, ... }
 * Returns a *new* array (does not mutate input).
 */
export function applyShocksToTicks(
  baseTicks: BacktestTick[],
  shocks: Record<string, number>
): BacktestTick[] {
  return baseTicks.map((t) => {
    const newPrices: Record<string, number> = {};
    for (const [id, price] of Object.entries(t.prices)) {
      const factor = shocks[id];
      newPrices[id] = factor != null ? price * factor : price;
    }
    return { timestamp: t.timestamp, prices: newPrices };
  });
}

/**
 * Generate a basic multi-asset synthetic base series (used for scenario shocks
 * when no historical data is chosen). Simple GBM-style walks per asset with a
 * little shared noise for realism. Anchored to the provided basePrices.
 */
export function generateBaseScenarioTicks(
  numTicks = 720,
  basePrices: Record<string, number> = {
    'pax-gold': 3280.5,
    'tether-gold': 3284.2,
    bitcoin: 97450,
    ethereum: 3850,
    gold: 3290,
  }
): BacktestTick[] {
  const now = Date.now();
  const ticks: BacktestTick[] = [];
  const current: Record<string, number> = { ...basePrices };

  for (let i = 0; i < numTicks; i++) {
    const timestamp = now - (numTicks - i) * 3_600_000;
    const prices: Record<string, number> = {};
    // Small shared market factor + asset-specific vol
    const marketFactor = 1 + 0.0002 * (Math.random() - 0.5);
    for (const id of Object.keys(basePrices)) {
      const vol = id.includes('gold') || id === 'gold' ? 0.0008 : 0.008;
      const drift = id.includes('gold') || id === 'gold' ? 0.00005 : 0.0001;
      current[id] = current[id] * (1 + drift + (Math.random() - 0.5) * vol) * marketFactor;
      prices[id] = parseFloat(current[id].toFixed(4));
    }
    ticks.push({ timestamp, prices });
  }
  return ticks;
}

// ─── Back-test Runner ────────────────────────────────────────────────────────

/**
 * Runs a strategy over a historical tick sequence and returns a complete
 * BacktestResult including equity curve, trade log, and performance metrics.
 *
 * @param ticks            Chronologically ordered price ticks
 * @param strategy         A TradingStrategy instance
 * @param initialBalance   Starting USD cash balance (extra cash for buys/DCA)
 * @param initialPositions Optional starting positions (units + avgCost) to seed
 *                         from a real portfolio snapshot. Equity and P&L are
 *                         computed from the first tick's prices onward.
 * @param costModel        Optional per-leg fee/slippage model (default: zero fees).
 */
export function runBacktest(
  ticks: BacktestTick[],
  strategy: TradingStrategy,
  initialBalance: number,
  initialPositions?: Record<string, { units: number; avgCost: number }>,
  costModel?: CostModel,
): BacktestResult {
  _idCounter = 0; // reset for deterministic IDs per run

  const costs = resolveCostModel(costModel);
  const slipBps = costs.slippageBps ?? 0;
  const feeBps = costs.feeBps;

  const state: EngineState = {
    balanceUSD: initialBalance,
    positions: initialPositions ? structuredClone(initialPositions) : {},
  };

  const trades: TradeLog[] = [];
  const equityCurve: EquityPoint[] = [];

  let peakEquity = initialBalance;
  let maxDrawdown = 0;
  let winningTrades = 0;
  let totalFeesUsd = 0;
  let totalSlippageUsd = 0;

  for (const tick of ticks) {
    const signals = strategy.onTick(tick, state);

    for (const signal of signals) {
      const price = tick.prices[signal.asset];
      if (!price || price <= 0) continue;

      if (signal.side === 'BUY') {
        const maxSpendBeforeFee = feeBps > 0
          ? state.balanceUSD / (1 + feeBps / 10_000)
          : state.balanceUSD;
        const spend = Math.min(signal.amountUSD, maxSpendBeforeFee);
        if (spend < 0.01) continue;

        const effPrice = effectiveBuyPrice(price, slipBps);
        const fee = legFee(spend, feeBps);
        const totalDebit = spend + fee;
        if (totalDebit > state.balanceUSD + 0.0001) continue;

        const units = spend / effPrice;
        const slippageCost = spend - units * price;

        state.balanceUSD -= totalDebit;
        totalFeesUsd += fee;
        totalSlippageUsd += Math.max(0, slippageCost);

        const existing = state.positions[signal.asset];
        if (existing) {
          const totalCost = existing.units * existing.avgCost + spend;
          existing.units += units;
          existing.avgCost = totalCost / existing.units;
        } else {
          state.positions[signal.asset] = { units, avgCost: price };
        }

        trades.push({
          id: nextId(),
          timestamp: tick.timestamp,
          asset: signal.asset,
          symbol: signal.symbol,
          side: 'BUY',
          price,
          units,
          amountUSD: spend,
          pnl: 0,
          feeUsd: fee,
          reason: signal.reason,
        });

      } else {
        // SELL – liquidate full position
        const pos = state.positions[signal.asset];
        if (!pos || pos.units < 0.000001) continue;

        const effPrice = effectiveSellPrice(price, slipBps);
        const grossProceeds = pos.units * effPrice;
        const fee = legFee(grossProceeds, feeBps);
        const netProceeds = grossProceeds - fee;
        const midProceeds = pos.units * price;
        const slippageCost = midProceeds - grossProceeds;

        const costBasis = pos.units * pos.avgCost;
        const pnl = netProceeds - costBasis;

        if (pnl > 0) winningTrades++;

        state.balanceUSD += netProceeds;
        totalFeesUsd += fee;
        totalSlippageUsd += Math.max(0, slippageCost);

        trades.push({
          id: nextId(),
          timestamp: tick.timestamp,
          asset: signal.asset,
          symbol: signal.symbol,
          side: 'SELL',
          price,
          units: pos.units,
          amountUSD: grossProceeds,
          pnl,
          feeUsd: fee,
          reason: signal.reason,
        });

        delete state.positions[signal.asset];
      }
    }

    // ── Equity snapshot ──────────────────────────────────────────────────
    let equity = state.balanceUSD;
    for (const [assetId, pos] of Object.entries(state.positions)) {
      const p = tick.prices[assetId];
      if (p) equity += pos.units * p;
    }

    equityCurve.push({ timestamp: tick.timestamp, value: equity });

    if (equity > peakEquity) peakEquity = equity;
    const drawdown = ((peakEquity - equity) / peakEquity) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  // Liquidate any remaining open positions at last tick prices
  const lastTick = ticks[ticks.length - 1];
  if (lastTick) {
    for (const [assetId, pos] of Object.entries({ ...state.positions })) {
      const price = lastTick.prices[assetId];
      if (price && pos.units > 0.000001) {
        const effPrice = effectiveSellPrice(price, slipBps);
        const grossProceeds = pos.units * effPrice;
        const fee = legFee(grossProceeds, feeBps);
        const netProceeds = grossProceeds - fee;
        const midProceeds = pos.units * price;
        const slippageCost = midProceeds - grossProceeds;
        const pnl = netProceeds - pos.units * pos.avgCost;

        if (pnl > 0) winningTrades++;
        totalFeesUsd += fee;
        totalSlippageUsd += Math.max(0, slippageCost);

        trades.push({
          id: nextId(),
          timestamp: lastTick.timestamp,
          asset: assetId,
          symbol: toSymbol(assetId),
          side: 'SELL',
          price,
          units: pos.units,
          amountUSD: grossProceeds,
          pnl,
          feeUsd: fee,
          reason: 'End of backtest — position closed',
        });
        state.balanceUSD += netProceeds;
        delete state.positions[assetId];
      }
    }
  }

  const resolvedFinalBalance = ticks.length > 0 ? state.balanceUSD : initialBalance;
  if (equityCurve.length > 0) {
    equityCurve[equityCurve.length - 1].value = resolvedFinalBalance;
  }

  const grossFinalBalance = resolvedFinalBalance + totalFeesUsd + totalSlippageUsd;
  const totalReturn = ((resolvedFinalBalance - initialBalance) / initialBalance) * 100;
  const grossTotalReturn = ((grossFinalBalance - initialBalance) / initialBalance) * 100;
  const sellTrades = trades.filter((t) => t.side === 'SELL');

  return {
    initialBalance,
    finalBalance: resolvedFinalBalance,
    totalReturn,
    grossTotalReturn,
    grossFinalBalance,
    totalFeesUsd,
    totalSlippageUsd,
    costModel: costs,
    maxDrawdown,
    totalTrades: sellTrades.length,
    winningTrades,
    equityCurve,
    trades,
  };
}
