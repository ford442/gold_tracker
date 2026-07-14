import { describe, expect, it } from 'vitest';
import {
  computeGoldPremiumPct,
  createDefaultSpreadRule,
  evaluateGoldPremiumRule,
  evaluatePriceCross,
  evaluatePriceCrossRule,
  evaluateRule,
  evaluateSpreadRule,
  evaluateFidelityRule,
  exportRulesJson,
  isCooldownActive,
  isInQuietHours,
  parseRulesImport,
  shouldFireRule,
  validateRule,
  type AlertEvalContext,
  type FidelityAlertRule,
  type GoldPremiumAlertRule,
  type PriceCrossAlertRule,
  type SpreadAlertRule,
} from './alertRules';
import type { FidelityScore } from '@/types';

const baseCtx = (): AlertEvalContext => ({
  prices: {
    'pax-gold': { id: 'pax-gold', symbol: 'PAXG', name: 'PAX Gold', price: 3300, change24h: 0, change7d: 0, sparkline: [] },
    'tether-gold': { id: 'tether-gold', symbol: 'XAUT', name: 'Tether Gold', price: 3317, change24h: 0, change7d: 0, sparkline: [] },
    bitcoin: { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', price: 95000, change24h: 0, change7d: 0, sparkline: [] },
  },
  goldSpot: { price: 3290, change24h: 0, change7d: 0, unit: 'USD/oz', sparkline: [] },
  previousPrices: {},
  now: Date.UTC(2026, 6, 14, 12, 0, 0),
});

describe('computeGoldPremiumPct', () => {
  it('computes positive premium', () => {
    expect(computeGoldPremiumPct(3316.5, 3290)).toBeCloseTo(0.805, 2);
  });

  it('returns 0 when spot is zero', () => {
    expect(computeGoldPremiumPct(100, 0)).toBe(0);
  });
});

describe('isInQuietHours', () => {
  it('returns false when quiet hours undefined', () => {
    expect(isInQuietHours(undefined, new Date('2026-07-14T12:00:00'))).toBe(false);
  });

  it('detects same-day quiet window', () => {
    const q = { start: '09:00', end: '17:00' };
    expect(isInQuietHours(q, new Date('2026-07-14T10:00:00'))).toBe(true);
    expect(isInQuietHours(q, new Date('2026-07-14T18:00:00'))).toBe(false);
  });

  it('detects overnight quiet window', () => {
    const q = { start: '22:00', end: '07:00' };
    expect(isInQuietHours(q, new Date('2026-07-14T23:00:00'))).toBe(true);
    expect(isInQuietHours(q, new Date('2026-07-14T06:30:00'))).toBe(true);
    expect(isInQuietHours(q, new Date('2026-07-14T12:00:00'))).toBe(false);
  });
});

describe('isCooldownActive', () => {
  it('is inactive when never fired', () => {
    expect(isCooldownActive(undefined, 5, 1000)).toBe(false);
  });

  it('respects cooldown window', () => {
    const last = 1000;
    expect(isCooldownActive(last, 5, last + 4 * 60_000)).toBe(true);
    expect(isCooldownActive(last, 5, last + 6 * 60_000)).toBe(false);
  });
});

describe('evaluatePriceCross', () => {
  it('detects cross above', () => {
    expect(evaluatePriceCross(3290, 3305, 3300, 'above')).toBe(true);
    expect(evaluatePriceCross(3305, 3310, 3300, 'above')).toBe(false);
  });

  it('detects cross below', () => {
    expect(evaluatePriceCross(3310, 3295, 3300, 'below')).toBe(true);
  });

  it('requires previous price', () => {
    expect(evaluatePriceCross(undefined, 3300, 3300, 'either')).toBe(false);
  });
});

describe('evaluateSpreadRule', () => {
  it('triggers when spread exceeds threshold', () => {
    const rule: SpreadAlertRule = { ...createDefaultSpreadRule(), thresholdPct: 0.5 };
    const result = evaluateSpreadRule(rule, baseCtx());
    expect(result.triggered).toBe(true);
    expect(result.value).toBeGreaterThan(0.5);
  });

  it('does not trigger below threshold', () => {
    const ctx = baseCtx();
    ctx.prices['tether-gold']!.price = 3301;
    const rule: SpreadAlertRule = { ...createDefaultSpreadRule(), thresholdPct: 1 };
    expect(evaluateSpreadRule(rule, ctx).triggered).toBe(false);
  });
});

describe('evaluatePriceCrossRule', () => {
  it('fires on level cross', () => {
    const ctx = baseCtx();
    ctx.previousPrices = { 'pax-gold': 3295 };
    ctx.prices['pax-gold']!.price = 3305;
    const rule: PriceCrossAlertRule = {
      ...createDefaultSpreadRule(),
      type: 'price_cross',
      asset: 'pax-gold',
      level: 3300,
      direction: 'above',
    };
    const result = evaluatePriceCrossRule(rule, ctx);
    expect(result.triggered).toBe(true);
    expect(result.message).toContain('3,300');
  });
});

describe('evaluateFidelityRule', () => {
  it('fires when score below threshold', () => {
    const score: FidelityScore = {
      score: 42,
      corrToGold: 0.8,
      corrToBtc: 0.2,
      corrToEth: 0.1,
      realizedVol: 12,
      maxDrawdown: 5,
      regimeLabel: 'Test',
    };
    const ctx = baseCtx();
    ctx.fidelityScores = { 'pax-gold': score };
    const rule: FidelityAlertRule = {
      ...createDefaultSpreadRule(),
      type: 'fidelity',
      asset: 'pax-gold',
      threshold: 50,
      horizon: '30d',
    };
    expect(evaluateFidelityRule(rule, ctx).triggered).toBe(true);
  });
});

describe('evaluateGoldPremiumRule', () => {
  it('fires on premium mode', () => {
    const rule: GoldPremiumAlertRule = {
      ...createDefaultSpreadRule(),
      type: 'gold_premium',
      asset: 'pax-gold',
      thresholdPct: 0.25,
      mode: 'premium',
    };
    expect(evaluateGoldPremiumRule(rule, baseCtx()).triggered).toBe(true);
  });

  it('respects discount-only mode', () => {
    const ctx = baseCtx();
    const rule: GoldPremiumAlertRule = {
      ...createDefaultSpreadRule(),
      type: 'gold_premium',
      asset: 'pax-gold',
      thresholdPct: 0.5,
      mode: 'discount',
    };
    expect(evaluateGoldPremiumRule(rule, ctx).triggered).toBe(false);
  });
});

describe('shouldFireRule', () => {
  it('blocks during cooldown', () => {
    const rule = createDefaultSpreadRule();
    const evalResult = evaluateSpreadRule(rule, baseCtx());
    const now = 1_000_000;
    expect(
      shouldFireRule(rule, evalResult, { lastFiredAt: now - 60_000 }, now),
    ).toBe(false);
  });

  it('blocks during quiet hours', () => {
    const rule = { ...createDefaultSpreadRule(), quietHours: { start: '00:00', end: '23:59' } };
    const evalResult = evaluateSpreadRule(rule, baseCtx());
    expect(shouldFireRule(rule, evalResult, {}, Date.UTC(2026, 6, 14, 12, 0, 0))).toBe(false);
  });

  it('allows fire when gates pass', () => {
    const rule = createDefaultSpreadRule();
    const evalResult = evaluateSpreadRule(rule, baseCtx());
    expect(shouldFireRule(rule, evalResult, {}, Date.UTC(2026, 6, 14, 12, 0, 0))).toBe(true);
  });
});

describe('validateRule and import/export', () => {
  it('validates default spread rule', () => {
    expect(validateRule(createDefaultSpreadRule())).toBe(true);
  });

  it('round-trips export/import', () => {
    const rules = [createDefaultSpreadRule()];
    const json = exportRulesJson(rules);
    const parsed = parseRulesImport(json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.rules).toHaveLength(1);
      expect(parsed.rules[0].name).toBe(rules[0].name);
    }
  });

  it('rejects invalid JSON', () => {
    expect(parseRulesImport('{bad').ok).toBe(false);
  });
});

describe('evaluateRule dispatch', () => {
  it('delegates to spread evaluator', () => {
    const rule = createDefaultSpreadRule();
    expect(evaluateRule(rule, baseCtx()).triggered).toBe(true);
  });
});
