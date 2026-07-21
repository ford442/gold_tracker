/**
 * Pre-live trade risk guardrails — PURE logic (no React, no network).
 *
 * Educational limits checked before venue submission. Not a regulated risk system.
 */

import { fromSymbol, isGoldSleeve } from './assets';
import type { OrderRecord } from './orderLifecycle';
import { RECONCILE_STATES } from './orderLifecycle';
import { baseSymbolFromProductId, summarizePaperLedger, type PaperFill } from './paperTrade';

export const RISK_ENGINE_NFA_COPY =
  'Educational guardrails only — not a regulated risk-management system. Limits are best-effort and based on local portfolio/journal data.';

export interface RiskDayAnchor {
  /** Local calendar date YYYY-MM-DD */
  date: string;
  startEquityUsd: number;
}

export interface RiskLimits {
  maxTradeSizeOz: number;
  /** 0 = disabled (oz-only cap) */
  maxSingleTradeNotionalUsd: number;
  /** 0–100 */
  maxGoldSleevePct: number;
  dailyLossLimitPct: number;
  maxOpenOrders: number;
  killSwitch: boolean;
  allowPaperDespiteKillSwitch: boolean;
}

export interface PortfolioHolding {
  assetId: string;
  units: number;
}

export interface PortfolioSnapshot {
  holdings: PortfolioHolding[];
  prices: Record<string, number>;
}

export interface PortfolioMetrics {
  totalValueUsd: number;
  goldValueUsd: number;
  goldPct: number;
  cryptoPct: number;
}

export interface ProposedOrderRisk {
  productId: string;
  side: 'BUY' | 'SELL';
  requestedQty: number;
  unitPriceUsd: number;
  mode: 'live' | 'paper';
}

export interface RiskCheckResult {
  allowed: boolean;
  reasons: string[];
  adjustedQty?: number;
}

export interface RiskCheckInput {
  limits: RiskLimits;
  portfolio: PortfolioSnapshot;
  order: ProposedOrderRisk;
  openLiveOrderCount: number;
  dailyLossPct: number;
}

/** Local calendar date string YYYY-MM-DD. */
export function localDateKey(now = Date.now()): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Roll or initialize the day anchor at local midnight. */
export function resolveDayAnchor(
  dateKey: string,
  currentEquityUsd: number,
  prev: RiskDayAnchor | null,
): RiskDayAnchor {
  if (prev?.date === dateKey) return prev;
  return {
    date: dateKey,
    startEquityUsd: Math.max(0, currentEquityUsd),
  };
}

export function holdingValueUsd(holding: PortfolioHolding, prices: Record<string, number>): number {
  const price = prices[holding.assetId] ?? 0;
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(holding.units)) return 0;
  return holding.units * price;
}

export function computePortfolioMetrics(snapshot: PortfolioSnapshot): PortfolioMetrics {
  let totalValueUsd = 0;
  let goldValueUsd = 0;

  for (const h of snapshot.holdings) {
    const v = holdingValueUsd(h, snapshot.prices);
    totalValueUsd += v;
    if (isGoldSleeve(h.assetId)) goldValueUsd += v;
  }

  const goldPct = totalValueUsd > 0 ? (goldValueUsd / totalValueUsd) * 100 : 0;
  return {
    totalValueUsd,
    goldValueUsd,
    goldPct,
    cryptoPct: totalValueUsd > 0 ? 100 - goldPct : 0,
  };
}

export function assetIdFromProductId(productId: string): string {
  const symbol = baseSymbolFromProductId(productId);
  return fromSymbol(symbol)?.id ?? symbol.toLowerCase();
}

/** Post-trade gold sleeve % after a BUY (educational estimate). */
export function projectGoldPctAfterBuy(
  snapshot: PortfolioSnapshot,
  assetId: string,
  qty: number,
  priceUsd: number,
): number {
  if (!isGoldSleeve(assetId) || qty <= 0 || priceUsd <= 0) {
    return computePortfolioMetrics(snapshot).goldPct;
  }

  const holdings = [...snapshot.holdings];
  const idx = holdings.findIndex((h) => h.assetId === assetId);
  if (idx >= 0) {
    holdings[idx] = { ...holdings[idx], units: holdings[idx].units + qty };
  } else {
    holdings.push({ assetId, units: qty });
  }

  const buyNotional = qty * priceUsd;
  const next = computePortfolioMetrics({ holdings, prices: snapshot.prices });
  if (next.totalValueUsd <= 0 && buyNotional > 0) return 100;
  return next.goldPct;
}

export function countOpenLiveOrders(orders: OrderRecord[]): number {
  return orders.filter(
    (o) =>
      o.mode === 'live' &&
      (RECONCILE_STATES as readonly string[]).includes(o.state),
  ).length;
}

export function isSameLocalDay(isoOrMs: string | number, now = Date.now()): boolean {
  const ts = typeof isoOrMs === 'string' ? Date.parse(isoOrMs) : isoOrMs;
  if (!Number.isFinite(ts)) return false;
  return localDateKey(ts) === localDateKey(now);
}

/** Daily loss % vs start-of-day equity, including paper + live journal drag today. */
export function computeDailyLossPct(params: {
  anchor: RiskDayAnchor | null;
  currentEquityUsd: number;
  paperFillsToday: PaperFill[];
  liveOrdersToday: OrderRecord[];
}): number {
  const { anchor, currentEquityUsd, paperFillsToday, liveOrdersToday } = params;
  if (!anchor || anchor.startEquityUsd <= 0) return 0;

  const start = anchor.startEquityUsd;
  let lossUsd = Math.max(0, start - currentEquityUsd);

  const paperSummary = summarizePaperLedger(paperFillsToday);
  if (paperSummary.realizedPnl < 0) {
    lossUsd += Math.abs(paperSummary.realizedPnl);
  }
  lossUsd += paperSummary.totalFees;

  for (const o of liveOrdersToday) {
    if (o.mode === 'live' && o.state === 'filled') {
      lossUsd += o.feeUsd;
    }
  }

  return (lossUsd / start) * 100;
}

/**
 * Evaluate proposed order against configured limits.
 * Live-only gates (sizing, exposure, open orders, daily loss) are skipped for paper mode.
 */
export function evaluateTradeRisk(input: RiskCheckInput): RiskCheckResult {
  const { limits, portfolio, order, openLiveOrderCount, dailyLossPct } = input;
  const reasons: string[] = [];
  let adjustedQty: number | undefined;

  const { killSwitch, allowPaperDespiteKillSwitch } = limits;
  const isLive = order.mode === 'live';

  if (killSwitch && isLive) {
    reasons.push('Trading kill switch is ON');
  }
  if (killSwitch && !isLive && !allowPaperDespiteKillSwitch) {
    reasons.push('Kill switch is ON — paper practice is disabled');
  }

  if (!isLive) {
    return { allowed: reasons.length === 0, reasons };
  }

  const qty = order.requestedQty;
  const notional = qty * order.unitPriceUsd;

  if (limits.maxTradeSizeOz > 0 && qty > limits.maxTradeSizeOz) {
    reasons.push(`Trade size ${qty.toFixed(4)} oz exceeds max ${limits.maxTradeSizeOz.toFixed(4)} oz`);
    adjustedQty = limits.maxTradeSizeOz;
  }

  if (
    limits.maxSingleTradeNotionalUsd > 0 &&
    notional > limits.maxSingleTradeNotionalUsd
  ) {
    const capQty = order.unitPriceUsd > 0
      ? limits.maxSingleTradeNotionalUsd / order.unitPriceUsd
      : 0;
    reasons.push(
      `Notional $${notional.toFixed(2)} exceeds max $${limits.maxSingleTradeNotionalUsd.toFixed(2)}`,
    );
    if (capQty > 0) {
      adjustedQty =
        adjustedQty !== undefined ? Math.min(adjustedQty, capQty) : capQty;
    }
  }

  if (order.side === 'BUY') {
    const assetId = assetIdFromProductId(order.productId);
    if (isGoldSleeve(assetId) && limits.maxGoldSleevePct < 100) {
      const projected = projectGoldPctAfterBuy(
        portfolio,
        assetId,
        qty,
        order.unitPriceUsd,
      );
      if (projected > limits.maxGoldSleevePct) {
        reasons.push(
          `Gold sleeve would reach ${projected.toFixed(1)}% (max ${limits.maxGoldSleevePct.toFixed(1)}%)`,
        );
      }
    }
  }

  if (limits.maxOpenOrders > 0 && openLiveOrderCount >= limits.maxOpenOrders) {
    reasons.push(
      `Open live orders (${openLiveOrderCount}) at limit (${limits.maxOpenOrders})`,
    );
  }

  if (limits.dailyLossLimitPct > 0 && dailyLossPct >= limits.dailyLossLimitPct) {
    reasons.push(
      `Daily loss ${dailyLossPct.toFixed(2)}% at or above limit ${limits.dailyLossLimitPct.toFixed(2)}%`,
    );
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    adjustedQty: adjustedQty !== undefined && adjustedQty > 0 ? adjustedQty : undefined,
  };
}

/** Map settings store fields into RiskLimits. */
export function riskLimitsFromSettings(settings: {
  maxTradeSize: number;
  maxSingleTradeNotionalUsd: number;
  maxGoldSleevePct: number;
  dailyLossLimit: number;
  maxOpenOrders: number;
  killSwitch: boolean;
  allowPaperDespiteKillSwitch: boolean;
}): RiskLimits {
  return {
    maxTradeSizeOz: settings.maxTradeSize,
    maxSingleTradeNotionalUsd: settings.maxSingleTradeNotionalUsd,
    maxGoldSleevePct: settings.maxGoldSleevePct,
    dailyLossLimitPct: settings.dailyLossLimit,
    maxOpenOrders: settings.maxOpenOrders,
    killSwitch: settings.killSwitch,
    allowPaperDespiteKillSwitch: settings.allowPaperDespiteKillSwitch,
  };
}

/** Assemble full risk check input from store snapshots (pure). */
export function assembleRiskCheckInput(params: {
  limits: RiskLimits;
  holdings: PortfolioHolding[];
  prices: Record<string, number>;
  order: ProposedOrderRisk;
  orders: OrderRecord[];
  paperFills: PaperFill[];
  anchor: RiskDayAnchor | null;
  now?: number;
}): { input: RiskCheckInput; nextAnchor: RiskDayAnchor } {
  const now = params.now ?? Date.now();
  const portfolio: PortfolioSnapshot = {
    holdings: params.holdings,
    prices: params.prices,
  };
  const metrics = computePortfolioMetrics(portfolio);
  const dateKey = localDateKey(now);
  const nextAnchor = resolveDayAnchor(dateKey, metrics.totalValueUsd, params.anchor);

  const paperFillsToday = params.paperFills.filter((f) => isSameLocalDay(f.timestamp, now));
  const liveOrdersToday = params.orders.filter(
    (o) => o.mode === 'live' && isSameLocalDay(o.createdAt, now),
  );

  const dailyLossPct = computeDailyLossPct({
    anchor: nextAnchor,
    currentEquityUsd: metrics.totalValueUsd,
    paperFillsToday,
    liveOrdersToday,
  });

  return {
    input: {
      limits: params.limits,
      portfolio,
      order: params.order,
      openLiveOrderCount: countOpenLiveOrders(params.orders),
      dailyLossPct,
    },
    nextAnchor,
  };
}
