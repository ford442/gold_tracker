/**
 * Shared exchange registry — pure config consumed by Vite client and Deno Edge Functions.
 * Canonical data lives in `exchanges.json`; helpers here stay unit-tested in Vitest.
 */

import registryData from './exchanges.json';

export type ExchangeAuthMethod = 'cdp-jwt-es256' | 'hmac-sha512' | 'none';
export type ExchangeStatus = 'live' | 'planned';

/** Live venues we can actually route trades to today. */
export type LiveTradingExchangeId = 'coinbase' | 'kraken';
/** Any venue in the registry (incl. planned / data-only). */
export type ExchangeId = LiveTradingExchangeId | 'gemini';

/** Descriptor for one credential input, so the settings form can be config-driven. */
export interface ExchangeKeyField {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
  multiline?: boolean;
  hint?: string;
}

export interface ExchangeConfig {
  id: ExchangeId;
  label: string;
  shortLabel: string;
  icon: string;
  status: ExchangeStatus;
  auth: ExchangeAuthMethod;
  takerFeeBps: number;
  directPaxgXaut: boolean;
  supportedPairs: string[];
  /** Canonical product id → exchange-native symbol (when different). */
  venuePairIds?: Record<string, string>;
  canTrade: boolean;
  canSyncBalances: boolean;
  keyFields: ExchangeKeyField[];
  docsUrl: string;
  notes?: string;
}

export const EXCHANGES = registryData.exchanges as Record<ExchangeId, ExchangeConfig>;

export const EXCHANGE_LIST: ExchangeConfig[] = Object.values(EXCHANGES);

export function isExchangeId(id: string): id is ExchangeId {
  return id in EXCHANGES;
}

export function getExchangeConfig(id: string): ExchangeConfig | undefined {
  return isExchangeId(id) ? EXCHANGES[id] : undefined;
}

/** Whether the venue is live and can execute trades today. */
export function isLiveTradingExchange(id: string): id is LiveTradingExchangeId {
  const cfg = getExchangeConfig(id);
  return cfg?.status === 'live' && cfg.canTrade === true;
}

/** Comma-separated labels for live trading venues (error messages). */
export function liveTradingExchangeLabels(): string {
  return liveTradingExchanges().map((e) => e.shortLabel).join(' or ');
}

/** All venues, optionally filtered by status. */
export function listExchanges(status?: ExchangeStatus): ExchangeConfig[] {
  return status ? EXCHANGE_LIST.filter((e) => e.status === status) : EXCHANGE_LIST;
}

/** Venues that can execute trades today (live + canTrade). */
export function liveTradingExchanges(): ExchangeConfig[] {
  return EXCHANGE_LIST.filter((e) => e.status === 'live' && e.canTrade);
}

/** Taker fee (bps) for a venue; falls back to Coinbase if unknown. */
export function takerFeeBps(id: string): number {
  return getExchangeConfig(id)?.takerFeeBps ?? EXCHANGES.coinbase.takerFeeBps;
}

/** Estimate the USD fee for a single-leg notional on a venue. */
export function estimateFeeUsd(notionalUsd: number, id: string): number {
  return Math.max(0, notionalUsd) * takerFeeBps(id) / 10_000;
}

/**
 * Round-trip fee (bps) to convert PAXG↔XAUT on a venue:
 * direct pair = 1 leg; otherwise routed via USD = 2 legs.
 */
export function roundTripPaxgXautFeeBps(id: string): number {
  const cfg = getExchangeConfig(id);
  const bps = cfg?.takerFeeBps ?? EXCHANGES.coinbase.takerFeeBps;
  return cfg?.directPaxgXaut ? bps : bps * 2;
}

export function supportsPair(id: string, productId: string): boolean {
  return getExchangeConfig(id)?.supportedPairs.includes(productId) ?? false;
}

/**
 * Map a canonical product id to the exchange-native pair symbol.
 * Falls back to the product id when no mapping exists.
 */
export function resolveVenuePair(exchangeId: string, productId: string): string {
  const cfg = getExchangeConfig(exchangeId);
  if (!cfg) return productId;
  return cfg.venuePairIds?.[productId] ?? productId;
}

/** Venue-native pair map for a single exchange (e.g. Kraken). */
export function getVenuePairMap(exchangeId: string): Record<string, string> {
  const cfg = getExchangeConfig(exchangeId);
  if (!cfg?.venuePairIds) {
    return Object.fromEntries(cfg?.supportedPairs.map((p) => [p, p]) ?? []);
  }
  return { ...cfg.venuePairIds };
}

/** Reverse map: exchange-native symbol → canonical product id. */
export function reverseVenuePairMap(exchangeId: string): Record<string, string> {
  const forward = getVenuePairMap(exchangeId);
  return Object.fromEntries(Object.entries(forward).map(([k, v]) => [v, k]));
}

export interface ArbFeeQuote {
  id: LiveTradingExchangeId;
  label: string;
  roundTripBps: number;
  costUsd: number;
  direct: boolean;
}

/** Config-driven PAXG↔XAUT arb-cost comparison across live trading venues, cheapest first. */
export function comparePaxgXautArbFees(notionalUsd: number): ArbFeeQuote[] {
  return liveTradingExchanges()
    .map((e) => {
      const roundTripBps = roundTripPaxgXautFeeBps(e.id);
      return {
        id: e.id as LiveTradingExchangeId,
        label: e.label,
        roundTripBps,
        costUsd: Math.max(0, notionalUsd) * roundTripBps / 10_000,
        direct: e.directPaxgXaut,
      };
    })
    .sort((a, b) => a.roundTripBps - b.roundTripBps);
}

/** Best (cheapest round-trip) live venue for a PAXG↔XAUT arb. */
export function bestPaxgXautVenue(notionalUsd = 1000): ArbFeeQuote | undefined {
  return comparePaxgXautArbFees(notionalUsd)[0];
}
