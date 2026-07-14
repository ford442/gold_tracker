/**
 * Exchange registry — PURE config (no React, no network).
 *
 * Single source of truth for venue metadata: auth method, taker fees, supported
 * pairs, capabilities, and the direct PAXG/XAUT advantage. Fees and pair
 * knowledge that used to be hard-coded in `krakenApi.ts` / `strategyEngine.ts`
 * are derived from here so there is one place to add a venue (issue #33, Phase A).
 *
 * The network-facing `ExchangeAdapter` (balances / placeOrder) lives in
 * `exchangeAdapters.ts` and wraps the existing clients behind this config.
 */

export type ExchangeAuthMethod = 'cdp-jwt-es256' | 'hmac-sha512' | 'none';
export type ExchangeStatus = 'live' | 'planned';

/** Live venues we can actually route trades to today. */
export type LiveTradingExchangeId = 'coinbase' | 'kraken';
/** Any venue in the registry (incl. planned / data-only). */
export type ExchangeId = LiveTradingExchangeId | 'gemini';

/** Descriptor for one credential input, so the settings form can be config-driven. */
export interface ExchangeKeyField {
  /** Stable storage/identity key, e.g. 'cdpKeyName'. */
  key: string;
  label: string;
  placeholder?: string;
  /** Render as a masked/secret input. */
  secret?: boolean;
  /** Render as a multi-line textarea (e.g. PEM keys). */
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
  /** Taker fee per leg, in basis points. */
  takerFeeBps: number;
  /** Venue lists a direct PAXG/XAUT market (1 leg instead of 2 via USD). */
  directPaxgXaut: boolean;
  /** Exchange product ids supported for our tracked assets. */
  supportedPairs: string[];
  /** Can execute orders (false for data-only / not-yet-integrated venues). */
  canTrade: boolean;
  /** Can sync account balances into the portfolio. */
  canSyncBalances: boolean;
  keyFields: ExchangeKeyField[];
  docsUrl: string;
  notes?: string;
}

const COINBASE_PAIRS = ['PAXG-USD', 'XAUT-USD', 'BTC-USD', 'ETH-USD', 'BCH-USD'];
const KRAKEN_PAIRS = ['PAXG-USD', 'XAUT-USD', 'BTC-USD', 'ETH-USD', 'PAXG-XAUT'];

export const EXCHANGES: Record<ExchangeId, ExchangeConfig> = {
  coinbase: {
    id: 'coinbase',
    label: 'Coinbase Advanced',
    shortLabel: 'Coinbase',
    icon: '🔵',
    status: 'live',
    auth: 'cdp-jwt-es256',
    takerFeeBps: 60, // ~0.60% per leg
    directPaxgXaut: false, // routes PAXG → USD → XAUT (2 legs)
    supportedPairs: COINBASE_PAIRS,
    canTrade: true,
    canSyncBalances: true,
    docsUrl: 'https://portal.cdp.coinbase.com/',
    notes: 'CDP API keys (ES256 JWT). Balance sync to portfolio.',
    keyFields: [
      {
        key: 'cdpKeyName',
        label: 'CDP Key Name',
        placeholder: 'organizations/{org_id}/apiKeys/{key_id}',
        hint: 'Found in your Coinbase Developer Platform dashboard',
      },
      {
        key: 'cdpPrivateKey',
        label: 'CDP Private Key (PEM)',
        placeholder: '-----BEGIN EC PRIVATE KEY-----\n...\n-----END EC PRIVATE KEY-----',
        secret: true,
        multiline: true,
        hint: 'Download this when you create your CDP API key. Keep it secure!',
      },
    ],
  },
  kraken: {
    id: 'kraken',
    label: 'Kraken Pro',
    shortLabel: 'Kraken',
    icon: '🔱',
    status: 'live',
    auth: 'hmac-sha512',
    takerFeeBps: 26, // ~0.26% per leg
    directPaxgXaut: true, // one direct PAXG/XAUT leg — lower arb cost
    supportedPairs: KRAKEN_PAIRS,
    canTrade: true,
    canSyncBalances: false,
    docsUrl: 'https://pro.kraken.com/',
    notes: 'Direct PAXG↔XAUT pair — one trade instead of two.',
    keyFields: [
      {
        key: 'krakenApiKey',
        label: 'Kraken API Key',
        placeholder: 'YOUR_KRAKEN_API_KEY',
        hint: 'Get from Kraken Pro → Settings → API',
      },
      {
        key: 'krakenApiSecret',
        label: 'Kraken API Secret',
        placeholder: 'YOUR_KRAKEN_API_SECRET',
        secret: true,
        hint: 'Never share this. Stored encrypted.',
      },
    ],
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini ActiveTrader',
    shortLabel: 'Gemini',
    icon: '♊',
    status: 'planned',
    auth: 'hmac-sha512',
    takerFeeBps: 35, // ~0.35% per leg (published ActiveTrader taker)
    directPaxgXaut: false,
    supportedPairs: ['PAXG-USD', 'BTC-USD', 'ETH-USD'],
    canTrade: false, // not integrated yet — shown as "coming soon"
    canSyncBalances: false,
    docsUrl: 'https://docs.gemini.com/rest-api/',
    notes: 'Planned venue — listed to demonstrate the config-driven adapter path.',
    keyFields: [
      { key: 'geminiApiKey', label: 'Gemini API Key', placeholder: 'account-...', hint: 'Coming soon' },
      { key: 'geminiApiSecret', label: 'Gemini API Secret', placeholder: '...', secret: true, hint: 'Coming soon' },
    ],
  },
};

export const EXCHANGE_LIST: ExchangeConfig[] = Object.values(EXCHANGES);

export function isExchangeId(id: string): id is ExchangeId {
  return id in EXCHANGES;
}

export function getExchangeConfig(id: string): ExchangeConfig | undefined {
  return isExchangeId(id) ? EXCHANGES[id] : undefined;
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

export interface ArbFeeQuote {
  id: LiveTradingExchangeId;
  label: string;
  roundTripBps: number;
  costUsd: number;
  direct: boolean;
}

/**
 * Config-driven PAXG↔XAUT arb-cost comparison across live trading venues,
 * cheapest first. Replaces the hard-coded numbers in `krakenApi.ts`.
 */
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
