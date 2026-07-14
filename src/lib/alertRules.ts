/**
 * User-defined alert rules — pure evaluation, cooldown, quiet hours, import/export.
 * No React imports.
 */

import type { AnalysisHorizon, FidelityScore, GoldSpot, PriceData } from '@/types';
import type { AssetId } from './assets';
import { assetName, getAsset, toSymbol } from './assets';
import { computeSpread } from './utils';

export type AlertRuleType = 'spread' | 'price_cross' | 'fidelity' | 'gold_premium';

export interface QuietHours {
  /** Local time HH:mm (24h) */
  start: string;
  end: string;
}

export interface AlertDeliveryChannels {
  browser: boolean;
  toast: boolean;
  inApp: boolean;
}

export interface AlertRuleBase {
  id: string;
  name: string;
  enabled: boolean;
  cooldownMinutes: number;
  quietHours?: QuietHours;
  delivery: AlertDeliveryChannels;
  createdAt: number;
  updatedAt: number;
}

export interface SpreadAlertRule extends AlertRuleBase {
  type: 'spread';
  assetA: AssetId;
  assetB: AssetId;
  thresholdPct: number;
}

export interface PriceCrossAlertRule extends AlertRuleBase {
  type: 'price_cross';
  asset: AssetId;
  level: number;
  direction: 'above' | 'below' | 'either';
}

export interface FidelityAlertRule extends AlertRuleBase {
  type: 'fidelity';
  asset: 'pax-gold' | 'tether-gold';
  threshold: number;
  horizon: AnalysisHorizon;
}

export type GoldPremiumMode = 'premium' | 'discount' | 'either';

export interface GoldPremiumAlertRule extends AlertRuleBase {
  type: 'gold_premium';
  asset: 'pax-gold' | 'tether-gold';
  thresholdPct: number;
  mode: GoldPremiumMode;
}

export type AlertRule =
  | SpreadAlertRule
  | PriceCrossAlertRule
  | FidelityAlertRule
  | GoldPremiumAlertRule;

export interface AlertEvalContext {
  prices: Record<string, PriceData>;
  goldSpot: GoldSpot | null;
  fidelityScores?: Partial<Record<'pax-gold' | 'tether-gold', FidelityScore>>;
  /** Previous tick prices for cross detection (asset id → price). */
  previousPrices?: Record<string, number>;
  now?: number;
}

export interface RuleEvalResult {
  triggered: boolean;
  message: string;
  value?: number;
  alertType: 'arbitrage' | 'price' | 'fidelity' | 'premium';
}

export interface AlertRulesExportV1 {
  version: 1;
  exportedAt: string;
  rules: AlertRule[];
}

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** Percent premium/discount of token vs spot gold. Positive = premium. */
export function computeGoldPremiumPct(tokenPrice: number, spotPrice: number): number {
  if (spotPrice <= 0) return 0;
  return ((tokenPrice - spotPrice) / spotPrice) * 100;
}

export function parseTimeToMinutes(hhmm: string): number | null {
  const m = TIME_RE.exec(hhmm.trim());
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/** True when `now` falls inside quiet window (supports overnight spans). */
export function isInQuietHours(quietHours: QuietHours | undefined, now: Date): boolean {
  if (!quietHours) return false;
  const startMins = parseTimeToMinutes(quietHours.start);
  const endMins = parseTimeToMinutes(quietHours.end);
  if (startMins === null || endMins === null) return false;

  const mins = now.getHours() * 60 + now.getMinutes();
  if (startMins === endMins) return true;
  if (startMins < endMins) {
    return mins >= startMins && mins < endMins;
  }
  return mins >= startMins || mins < endMins;
}

export function isCooldownActive(
  lastFiredAt: number | undefined,
  cooldownMinutes: number,
  now: number,
): boolean {
  if (!lastFiredAt || cooldownMinutes <= 0) return false;
  return now - lastFiredAt < cooldownMinutes * 60_000;
}

export function evaluatePriceCross(
  prevPrice: number | undefined,
  currentPrice: number,
  level: number,
  direction: 'above' | 'below' | 'either',
): boolean {
  if (prevPrice === undefined || !Number.isFinite(currentPrice) || !Number.isFinite(level)) {
    return false;
  }
  if (direction === 'above') return prevPrice < level && currentPrice >= level;
  if (direction === 'below') return prevPrice > level && currentPrice <= level;
  return (
    (prevPrice < level && currentPrice >= level) ||
    (prevPrice > level && currentPrice <= level)
  );
}

function getPrice(ctx: AlertEvalContext, assetId: string): number | undefined {
  if (assetId === 'gold') return ctx.goldSpot?.price;
  return ctx.prices[assetId]?.price;
}

export function evaluateSpreadRule(rule: SpreadAlertRule, ctx: AlertEvalContext): RuleEvalResult {
  const priceA = getPrice(ctx, rule.assetA);
  const priceB = getPrice(ctx, rule.assetB);
  if (priceA === undefined || priceB === undefined) {
    return { triggered: false, message: '', alertType: 'arbitrage' };
  }
  const spread = computeSpread(priceA, priceB);
  const absSpread = Math.abs(spread);
  const symA = toSymbol(rule.assetA);
  const symB = toSymbol(rule.assetB);
  if (absSpread <= rule.thresholdPct) {
    return { triggered: false, message: '', alertType: 'arbitrage' };
  }
  const cheaper = spread < 0 ? symB : symA;
  const pricier = spread < 0 ? symA : symB;
  return {
    triggered: true,
    message: `${cheaper} is ${absSpread.toFixed(2)}% cheaper than ${pricier} (spread > ${rule.thresholdPct}%)`,
    value: absSpread,
    alertType: 'arbitrage',
  };
}

export function evaluatePriceCrossRule(
  rule: PriceCrossAlertRule,
  ctx: AlertEvalContext,
): RuleEvalResult {
  const current = getPrice(ctx, rule.asset);
  if (current === undefined) {
    return { triggered: false, message: '', alertType: 'price' };
  }
  const prev = ctx.previousPrices?.[rule.asset];
  const crossed = evaluatePriceCross(prev, current, rule.level, rule.direction);
  if (!crossed) {
    return { triggered: false, message: '', alertType: 'price' };
  }
  const sym = toSymbol(rule.asset);
  const dir =
    rule.direction === 'either'
      ? current >= rule.level
        ? 'rose above'
        : 'fell below'
      : rule.direction === 'above'
        ? 'rose above'
        : 'fell below';
  return {
    triggered: true,
    message: `${sym} ${dir} $${rule.level.toLocaleString()} (now $${current.toFixed(2)})`,
    value: current,
    alertType: 'price',
  };
}

export function evaluateFidelityRule(rule: FidelityAlertRule, ctx: AlertEvalContext): RuleEvalResult {
  const score = ctx.fidelityScores?.[rule.asset];
  if (!score) {
    return { triggered: false, message: '', alertType: 'fidelity' };
  }
  if (score.score >= rule.threshold) {
    return { triggered: false, message: '', alertType: 'fidelity' };
  }
  const sym = toSymbol(rule.asset);
  return {
    triggered: true,
    message: `${sym} Gold Fidelity ${score.score.toFixed(0)} — tokenized gold tracking error vs spot (below ${rule.threshold})`,
    value: score.score,
    alertType: 'fidelity',
  };
}

export function evaluateGoldPremiumRule(
  rule: GoldPremiumAlertRule,
  ctx: AlertEvalContext,
): RuleEvalResult {
  const spot = ctx.goldSpot?.price;
  const tokenPrice = ctx.prices[rule.asset]?.price;
  if (spot === undefined || tokenPrice === undefined) {
    return { triggered: false, message: '', alertType: 'premium' };
  }
  const premiumPct = computeGoldPremiumPct(tokenPrice, spot);
  const absPct = Math.abs(premiumPct);
  const isPremium = premiumPct > 0;
  const isDiscount = premiumPct < 0;

  let modeMatch = false;
  if (rule.mode === 'premium') modeMatch = isPremium && absPct > rule.thresholdPct;
  else if (rule.mode === 'discount') modeMatch = isDiscount && absPct > rule.thresholdPct;
  else modeMatch = absPct > rule.thresholdPct;

  if (!modeMatch) {
    return { triggered: false, message: '', alertType: 'premium' };
  }

  const sym = toSymbol(rule.asset);
  const label = isPremium ? 'premium' : 'discount';
  return {
    triggered: true,
    message: `${sym} at ${absPct.toFixed(2)}% ${label} vs spot (threshold ${rule.thresholdPct}%)`,
    value: premiumPct,
    alertType: 'premium',
  };
}

export function evaluateRule(rule: AlertRule, ctx: AlertEvalContext): RuleEvalResult {
  if (!rule.enabled) {
    return { triggered: false, message: '', alertType: 'arbitrage' };
  }
  switch (rule.type) {
    case 'spread':
      return evaluateSpreadRule(rule, ctx);
    case 'price_cross':
      return evaluatePriceCrossRule(rule, ctx);
    case 'fidelity':
      return evaluateFidelityRule(rule, ctx);
    case 'gold_premium':
      return evaluateGoldPremiumRule(rule, ctx);
    default: {
      const _exhaustive: never = rule;
      return _exhaustive;
    }
  }
}

export interface RuleFireState {
  lastFiredAt?: number;
}

/** Gate firing on cooldown + quiet hours after a positive evaluation. */
export function shouldFireRule(
  rule: AlertRule,
  evalResult: RuleEvalResult,
  state: RuleFireState,
  now: number = Date.now(),
): boolean {
  if (!rule.enabled || !evalResult.triggered) return false;
  if (isInQuietHours(rule.quietHours, new Date(now))) return false;
  if (isCooldownActive(state.lastFiredAt, rule.cooldownMinutes, now)) return false;
  return true;
}

export function createDefaultSpreadRule(): SpreadAlertRule {
  const now = Date.now();
  return {
    id: `rule-${now}-default-spread`,
    name: 'PAXG/XAUT spread > 0.5%',
    type: 'spread',
    enabled: true,
    assetA: 'pax-gold',
    assetB: 'tether-gold',
    thresholdPct: 0.5,
    cooldownMinutes: 5,
    delivery: { browser: true, toast: true, inApp: true },
    createdAt: now,
    updatedAt: now,
  };
}

export function validateRule(rule: unknown): rule is AlertRule {
  if (!rule || typeof rule !== 'object') return false;
  const r = rule as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.name !== 'string') return false;
  if (typeof r.enabled !== 'boolean') return false;
  if (typeof r.cooldownMinutes !== 'number' || r.cooldownMinutes < 0) return false;
  if (typeof r.createdAt !== 'number' || typeof r.updatedAt !== 'number') return false;
  if (!r.delivery || typeof r.delivery !== 'object') return false;
  const d = r.delivery as Record<string, unknown>;
  if (typeof d.browser !== 'boolean' || typeof d.toast !== 'boolean' || typeof d.inApp !== 'boolean') {
    return false;
  }
  if (r.quietHours !== undefined) {
    const q = r.quietHours as Record<string, unknown>;
    if (typeof q.start !== 'string' || typeof q.end !== 'string') return false;
    if (parseTimeToMinutes(q.start) === null || parseTimeToMinutes(q.end) === null) return false;
  }

  switch (r.type) {
    case 'spread':
      return (
        typeof r.assetA === 'string' &&
        typeof r.assetB === 'string' &&
        getAsset(r.assetA) !== undefined &&
        getAsset(r.assetB) !== undefined &&
        typeof r.thresholdPct === 'number'
      );
    case 'price_cross':
      return (
        typeof r.asset === 'string' &&
        getAsset(r.asset) !== undefined &&
        typeof r.level === 'number' &&
        (r.direction === 'above' || r.direction === 'below' || r.direction === 'either')
      );
    case 'fidelity':
      return (
        (r.asset === 'pax-gold' || r.asset === 'tether-gold') &&
        typeof r.threshold === 'number' &&
        typeof r.horizon === 'string'
      );
    case 'gold_premium':
      return (
        (r.asset === 'pax-gold' || r.asset === 'tether-gold') &&
        typeof r.thresholdPct === 'number' &&
        (r.mode === 'premium' || r.mode === 'discount' || r.mode === 'either')
      );
    default:
      return false;
  }
}

export function exportRulesJson(rules: AlertRule[]): string {
  const payload: AlertRulesExportV1 = {
    version: 1,
    exportedAt: new Date().toISOString(),
    rules,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseRulesImport(json: string): { ok: true; rules: AlertRule[] } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(json) as unknown;
    let rules: unknown[];
    if (Array.isArray(parsed)) {
      rules = parsed;
    } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as AlertRulesExportV1).rules)) {
      rules = (parsed as AlertRulesExportV1).rules;
    } else {
      return { ok: false, error: 'Expected a rules array or { version, rules } object' };
    }
    const valid: AlertRule[] = [];
    for (let i = 0; i < rules.length; i++) {
      if (!validateRule(rules[i])) {
        return { ok: false, error: `Invalid rule at index ${i}` };
      }
      valid.push(rules[i] as AlertRule);
    }
    return { ok: true, rules: valid };
  } catch {
    return { ok: false, error: 'Invalid JSON' };
  }
}

/** Human-readable one-line summary for rule list UI. */
export function describeRule(rule: AlertRule): string {
  switch (rule.type) {
    case 'spread':
      return `Spread(${toSymbol(rule.assetA)}, ${toSymbol(rule.assetB)}) > ${rule.thresholdPct}%`;
    case 'price_cross':
      return `Price(${toSymbol(rule.asset)}) crosses $${rule.level} (${rule.direction})`;
    case 'fidelity':
      return `Fidelity(${toSymbol(rule.asset)}) < ${rule.threshold}`;
    case 'gold_premium':
      return `${assetName(rule.asset)} ${rule.mode} vs spot > ${rule.thresholdPct}%`;
    default: {
      const _exhaustive: never = rule;
      return String(_exhaustive);
    }
  }
}
