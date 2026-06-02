// ─────────────────────────────────────────────────────────────────────────────
// GoldTrackr – Strategy Engine
// Pure TypeScript; no React imports. All simulation logic lives here.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Public Types ────────────────────────────────────────────────────────────

/** A single price snapshot across one or more assets at a given moment. */
export interface BacktestTick {
  timestamp: number;                 // Unix ms
  prices: Record<string, number>;   // assetId → USD price
}

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
  pnl: number;       // 0 for BUYs; realised P&L for SELLs
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
  finalBalance: number;
  totalReturn: number;    // percent
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

let _idCounter = 0;
function nextId(): string {
  return `trade-${Date.now()}-${++_idCounter}`;
}

const ASSET_SYMBOLS: Record<string, string> = {
  'pax-gold':    'PAXG',
  'tether-gold': 'XAUT',
  'bitcoin':     'BTC',
  'ethereum':    'ETH',
  'bitcoin-cash':'BCH',
  'gold':        'XAU',
};

function toSymbol(assetId: string): string {
  return ASSET_SYMBOLS[assetId] ?? assetId.toUpperCase();
}

// ─── Strategy: Arbitrage ─────────────────────────────────────────────────────

export interface ArbConfig {
  asset1: string;           // e.g. 'pax-gold'
  asset2: string;           // e.g. 'tether-gold'
  spreadThreshold: number;  // percent, e.g. 0.25
  tradeSize: number;        // USD per entry
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
  const { asset1, asset2, spreadThreshold, tradeSize } = config;

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
          if (spread > 0) {
            // asset1 is expensive → buy the cheaper asset2
            if (state.balanceUSD >= 1) {
              signals.push({
                asset: asset2,
                symbol: toSymbol(asset2),
                side: 'BUY',
                amountUSD: Math.min(tradeSize, state.balanceUSD),
                reason: `Spread +${spread.toFixed(3)}% — buying cheaper ${toSymbol(asset2)}`,
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
                amountUSD: Math.min(tradeSize, state.balanceUSD),
                reason: `Spread ${spread.toFixed(3)}% — buying cheaper ${toSymbol(asset1)}`,
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
 */
export function runBacktest(
  ticks: BacktestTick[],
  strategy: TradingStrategy,
  initialBalance: number,
  initialPositions?: Record<string, { units: number; avgCost: number }>,
): BacktestResult {
  _idCounter = 0; // reset for deterministic IDs per run

  const state: EngineState = {
    balanceUSD: initialBalance,
    positions: initialPositions ? JSON.parse(JSON.stringify(initialPositions)) : {},
  };

  const trades: TradeLog[] = [];
  const equityCurve: EquityPoint[] = [];

  let peakEquity = initialBalance;
  let maxDrawdown = 0;
  let winningTrades = 0;

  for (const tick of ticks) {
    const signals = strategy.onTick(tick, state);

    for (const signal of signals) {
      const price = tick.prices[signal.asset];
      if (!price || price <= 0) continue;

      if (signal.side === 'BUY') {
        const spend = Math.min(signal.amountUSD, state.balanceUSD);
        if (spend < 0.01) continue;

        const units = spend / price;
        state.balanceUSD -= spend;

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
          reason: signal.reason,
        });

      } else {
        // SELL – liquidate full position
        const pos = state.positions[signal.asset];
        if (!pos || pos.units < 0.000001) continue;

        const proceeds = pos.units * price;
        const costBasis = pos.units * pos.avgCost;
        const pnl = proceeds - costBasis;

        if (pnl > 0) winningTrades++;

        state.balanceUSD += proceeds;

        trades.push({
          id: nextId(),
          timestamp: tick.timestamp,
          asset: signal.asset,
          symbol: signal.symbol,
          side: 'SELL',
          price,
          units: pos.units,
          amountUSD: proceeds,
          pnl,
          reason: signal.reason,
        });

        delete state.positions[signal.asset];
      }
    }

    // ── Equity snapshot ──────────────────────────────────────────────────
    let equity = state.balanceUSD;
    for (const [assetId, pos] of Object.entries(state.positions)) {
      const price = tick.prices[assetId];
      if (price) equity += pos.units * price;
    }

    equityCurve.push({ timestamp: tick.timestamp, value: equity });

    if (equity > peakEquity) peakEquity = equity;
    const drawdown = ((peakEquity - equity) / peakEquity) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  // Liquidate any remaining open positions at last tick prices
  const lastTick = ticks[ticks.length - 1];
  if (lastTick) {
    for (const [assetId, pos] of Object.entries(state.positions)) {
      const price = lastTick.prices[assetId];
      if (price && pos.units > 0.000001) {
        const proceeds = pos.units * price;
        const pnl = proceeds - pos.units * pos.avgCost;
        if (pnl > 0) winningTrades++;
        trades.push({
          id: nextId(),
          timestamp: lastTick.timestamp,
          asset: assetId,
          symbol: toSymbol(assetId),
          side: 'SELL',
          price,
          units: pos.units,
          amountUSD: proceeds,
          pnl,
          reason: 'End of backtest — position closed',
        });
        state.balanceUSD += proceeds;
      }
    }
  }

  const finalBalance = equityCurve.length > 0
    ? equityCurve[equityCurve.length - 1].value
    : initialBalance;

  const totalReturn = ((finalBalance - initialBalance) / initialBalance) * 100;
  const sellTrades = trades.filter((t) => t.side === 'SELL');

  return {
    initialBalance,
    finalBalance,
    totalReturn,
    maxDrawdown,
    totalTrades: sellTrades.length,
    winningTrades,
    equityCurve,
    trades,
  };
}
