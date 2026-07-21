import { describe, it, expect } from 'vitest';
import type { OrderRecord } from './orderLifecycle';
import { createPendingOrder } from './orderLifecycle';
import {
  computeDailyLossPct,
  computePortfolioMetrics,
  countOpenLiveOrders,
  evaluateTradeRisk,
  projectGoldPctAfterBuy,
  resolveDayAnchor,
  type PortfolioSnapshot,
  type RiskLimits,
} from './riskEngine';

const BASE_LIMITS: RiskLimits = {
  maxTradeSizeOz: 0.5,
  maxSingleTradeNotionalUsd: 0,
  maxGoldSleevePct: 80,
  dailyLossLimitPct: 2,
  maxOpenOrders: 3,
  killSwitch: false,
  allowPaperDespiteKillSwitch: true,
};

const EMPTY_PORTFOLIO: PortfolioSnapshot = { holdings: [], prices: { 'pax-gold': 3200 } };

function liveOrder(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    ...createPendingOrder({
      clientOrderId: 'gt-1',
      exchange: 'coinbase',
      mode: 'live',
      productId: 'PAXG-USD',
      side: 'BUY',
      requestedQty: 0.5,
      idempotencyKey: 'k1',
    }),
    ...overrides,
  };
}

describe('riskEngine', () => {
  describe('computePortfolioMetrics', () => {
    it('returns zero metrics for empty portfolio', () => {
      const m = computePortfolioMetrics(EMPTY_PORTFOLIO);
      expect(m.totalValueUsd).toBe(0);
      expect(m.goldPct).toBe(0);
    });

    it('computes gold exposure for gold sleeve holdings', () => {
      const snap: PortfolioSnapshot = {
        holdings: [
          { assetId: 'pax-gold', units: 1 },
          { assetId: 'bitcoin', units: 0.01 },
        ],
        prices: { 'pax-gold': 3200, bitcoin: 100_000 },
      };
      const m = computePortfolioMetrics(snap);
      expect(m.totalValueUsd).toBe(4200);
      expect(m.goldPct).toBeCloseTo((3200 / 4200) * 100, 4);
    });
  });

  describe('projectGoldPctAfterBuy', () => {
    it('empty portfolio BUY gold is 100%', () => {
      const pct = projectGoldPctAfterBuy(EMPTY_PORTFOLIO, 'pax-gold', 0.5, 3200);
      expect(pct).toBe(100);
    });
  });

  describe('countOpenLiveOrders', () => {
    it('counts non-terminal live orders only', () => {
      const orders = [
        liveOrder({ state: 'open' }),
        liveOrder({ clientOrderId: 'gt-2', state: 'filled' }),
        liveOrder({ clientOrderId: 'gt-3', mode: 'paper', state: 'open' }),
      ];
      expect(countOpenLiveOrders(orders)).toBe(1);
    });
  });

  describe('computeDailyLossPct', () => {
    it('returns 0 without anchor', () => {
      expect(
        computeDailyLossPct({
          anchor: null,
          currentEquityUsd: 1000,
          paperFillsToday: [],
          liveOrdersToday: [],
        }),
      ).toBe(0);
    });

    it('computes equity drawdown vs anchor', () => {
      const pct = computeDailyLossPct({
        anchor: { date: '2026-07-20', startEquityUsd: 10_000 },
        currentEquityUsd: 9800,
        paperFillsToday: [],
        liveOrdersToday: [],
      });
      expect(pct).toBeCloseTo(2, 4);
    });
  });

  describe('evaluateTradeRisk', () => {
    const baseInput = {
      limits: BASE_LIMITS,
      portfolio: EMPTY_PORTFOLIO,
      openLiveOrderCount: 0,
      dailyLossPct: 0,
    };

    it('blocks live when kill switch is on', () => {
      const result = evaluateTradeRisk({
        ...baseInput,
        limits: { ...BASE_LIMITS, killSwitch: true },
        order: {
          productId: 'PAXG-USD',
          side: 'BUY',
          requestedQty: 0.1,
          unitPriceUsd: 3200,
          mode: 'live',
        },
      });
      expect(result.allowed).toBe(false);
      expect(result.reasons.some((r) => r.includes('kill switch'))).toBe(true);
    });

    it('allows paper when kill switch on and practice toggle enabled', () => {
      const result = evaluateTradeRisk({
        ...baseInput,
        limits: { ...BASE_LIMITS, killSwitch: true, allowPaperDespiteKillSwitch: true },
        order: {
          productId: 'PAXG-USD',
          side: 'BUY',
          requestedQty: 10,
          unitPriceUsd: 3200,
          mode: 'paper',
        },
      });
      expect(result.allowed).toBe(true);
    });

    it('allows at max trade size oz', () => {
      const result = evaluateTradeRisk({
        ...baseInput,
        limits: { ...BASE_LIMITS, maxGoldSleevePct: 100 },
        order: {
          productId: 'PAXG-USD',
          side: 'BUY',
          requestedQty: 0.5,
          unitPriceUsd: 3200,
          mode: 'live',
        },
      });
      expect(result.allowed).toBe(true);
    });

    it('blocks over max trade size oz with adjustedQty', () => {
      const result = evaluateTradeRisk({
        ...baseInput,
        order: {
          productId: 'PAXG-USD',
          side: 'BUY',
          requestedQty: 1.0,
          unitPriceUsd: 3200,
          mode: 'live',
        },
      });
      expect(result.allowed).toBe(false);
      expect(result.adjustedQty).toBe(0.5);
    });

    it('blocks empty portfolio gold BUY over max gold sleeve', () => {
      const result = evaluateTradeRisk({
        ...baseInput,
        order: {
          productId: 'PAXG-USD',
          side: 'BUY',
          requestedQty: 0.1,
          unitPriceUsd: 3200,
          mode: 'live',
        },
      });
      expect(result.allowed).toBe(false);
      expect(result.reasons.some((r) => r.includes('Gold sleeve'))).toBe(true);
    });

    it('skips gold sleeve check on SELL', () => {
      const snap: PortfolioSnapshot = {
        holdings: [{ assetId: 'pax-gold', units: 1 }],
        prices: { 'pax-gold': 3200 },
      };
      const result = evaluateTradeRisk({
        ...baseInput,
        portfolio: snap,
        order: {
          productId: 'PAXG-USD',
          side: 'SELL',
          requestedQty: 0.5,
          unitPriceUsd: 3200,
          mode: 'live',
        },
      });
      expect(result.reasons.some((r) => r.includes('Gold sleeve'))).toBe(false);
    });

    it('blocks live when daily loss at limit', () => {
      const result = evaluateTradeRisk({
        ...baseInput,
        dailyLossPct: 2.5,
        order: {
          productId: 'PAXG-USD',
          side: 'BUY',
          requestedQty: 0.1,
          unitPriceUsd: 3200,
          mode: 'live',
        },
      });
      expect(result.allowed).toBe(false);
      expect(result.reasons.some((r) => r.includes('Daily loss'))).toBe(true);
    });

    it('blocks live when open orders at max', () => {
      const result = evaluateTradeRisk({
        ...baseInput,
        openLiveOrderCount: 3,
        limits: { ...BASE_LIMITS, maxGoldSleevePct: 100 },
        order: {
          productId: 'PAXG-USD',
          side: 'BUY',
          requestedQty: 0.1,
          unitPriceUsd: 3200,
          mode: 'live',
        },
      });
      expect(result.allowed).toBe(false);
      expect(result.reasons.some((r) => r.includes('Open live orders'))).toBe(true);
    });
  });

  describe('resolveDayAnchor', () => {
    it('rolls anchor on new date', () => {
      const prev = { date: '2026-07-19', startEquityUsd: 5000 };
      const next = resolveDayAnchor('2026-07-20', 8000, prev);
      expect(next.date).toBe('2026-07-20');
      expect(next.startEquityUsd).toBe(8000);
    });

    it('keeps anchor on same date', () => {
      const prev = { date: '2026-07-20', startEquityUsd: 5000 };
      const next = resolveDayAnchor('2026-07-20', 8000, prev);
      expect(next).toBe(prev);
    });
  });
});
