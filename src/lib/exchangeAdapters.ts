/**
 * Unified exchange adapter — network layer (excluded from the pure-lib coverage
 * gate, like coinbase.ts / supabase.ts).
 *
 * Wraps the existing Coinbase and Kraken clients behind one `ExchangeAdapter`
 * interface (issue #33, Phase A: "Refactor Coinbase + Kraken behind a common TS
 * interface"). New venues implement this interface; UI and hooks depend on the
 * interface, not on venue-specific functions.
 *
 * Fees, pairs, and capabilities come from the pure `exchanges.ts` registry.
 */

import {
  getExchangeConfig,
  estimateFeeUsd as configFeeUsd,
  supportsPair as configSupportsPair,
  type ExchangeConfig,
  type ExchangeId,
} from './exchanges';
import { getCoinbaseAccounts } from './coinbase';
import { fromCoinbaseCode } from './assets';
import { placeOrder as coinbasePlaceOrder, testCoinbaseConnection, getCoinbaseOrderStatus, cancelCoinbaseOrder } from './coinbaseTrader';
import type { TradeOrder, OrderResult, OrderStatusResult, CancelOrderResult } from './orderTypes';

export type { TradeOrder, OrderResult } from './orderTypes';

/** Normalized balance across venues. */
export interface AdapterBalance {
  assetId: string;
  symbol: string;
  amount: number;
}

/** Credentials passed to network operations (never persisted by the adapter). */
export interface AdapterCredentials {
  cdpKeyName?: string;
  cdpPrivateKey?: string;
  krakenApiKey?: string;
  krakenApiSecret?: string;
}

export type ExecutionPath = 'server' | 'local' | 'unsupported';

export interface ExchangeAdapter {
  readonly id: ExchangeId;
  readonly config: ExchangeConfig;
  /** Taker fee for a single-leg notional (USD), from config. */
  estimateFeeUsd(notionalUsd: number): number;
  /** Whether the venue lists a given product id, from config. */
  supportsPair(productId: string): boolean;
  /** Fetch normalized balances (throws if the venue can't sync client-side). */
  getBalances(creds: AdapterCredentials): Promise<AdapterBalance[]>;
  /**
   * Place (or simulate) an order client-side. Server-secure routing continues
   * to go through `tradeService`; this covers the local/no-Supabase path.
   */
  placeOrder(order: TradeOrder, dryRun: boolean, creds: AdapterCredentials): Promise<OrderResult>;
  /** Verify API credentials (client-side where supported). */
  testConnection(creds: AdapterCredentials): Promise<boolean>;
  /** Query order status for reconciliation (where venue allows client-side). */
  getOrderStatus?(
    orderId: string,
    productId: string,
    creds: AdapterCredentials,
  ): Promise<OrderStatusResult>;
  /** Cancel an open order (venue permitting). */
  cancelOrder?(
    orderId: string,
    productId: string,
    creds: AdapterCredentials,
  ): Promise<import('./orderTypes').CancelOrderResult>;
}

const orderStatusStub = (): Promise<OrderStatusResult> => Promise.resolve({ status: 'unknown' });
const cancelStub = (): Promise<CancelOrderResult> => Promise.resolve({
  success: false,
  error: 'Cancel is only available in server-secure mode for this venue',
});

function makeAdapter(
  id: ExchangeId,
  overrides: Partial<
    Pick<
      ExchangeAdapter,
      'getBalances' | 'placeOrder' | 'testConnection' | 'getOrderStatus' | 'cancelOrder'
    >
  > = {},
): ExchangeAdapter {
  const config = getExchangeConfig(id);
  if (!config) throw new Error(`Unknown exchange id: ${id}`);

  return {
    id,
    config,
    estimateFeeUsd: (notionalUsd) => configFeeUsd(notionalUsd, id),
    supportsPair: (productId) => configSupportsPair(id, productId),
    getBalances:
      overrides.getBalances ??
      (() => Promise.reject(new Error(`${config.label} does not support client-side balance sync`))),
    placeOrder:
      overrides.placeOrder ??
      (() => Promise.reject(new Error(`${config.label} trading is only available in server-secure mode`))),
    testConnection:
      overrides.testConnection ??
      (() => Promise.resolve(false)),
    getOrderStatus: overrides.getOrderStatus ?? orderStatusStub,
    cancelOrder: overrides.cancelOrder ?? cancelStub,
  };
}

const coinbaseAdapter = makeAdapter('coinbase', {
  async getBalances(creds) {
    if (!creds.cdpKeyName || !creds.cdpPrivateKey) {
      throw new Error('Coinbase CDP keys required for balance sync');
    }
    const accounts = await getCoinbaseAccounts(creds.cdpKeyName, creds.cdpPrivateKey);
    return accounts
      .map((a) => {
        const asset = fromCoinbaseCode(a.currency.code);
        const amount = parseFloat(a.balance.amount);
        return asset && amount > 0
          ? { assetId: asset.id, symbol: asset.symbol, amount }
          : null;
      })
      .filter((b): b is AdapterBalance => b !== null);
  },
  async placeOrder(order, dryRun, creds) {
    return coinbasePlaceOrder(order, dryRun, creds);
  },
  async testConnection(creds) {
    return testCoinbaseConnection(creds);
  },
  async getOrderStatus(orderId, productId, creds) {
    return getCoinbaseOrderStatus(orderId, productId, creds);
  },
  async cancelOrder(orderId, productId, creds) {
    return cancelCoinbaseOrder(orderId, productId, creds);
  },
});

// Kraken HMAC signing is server-side only; local Kraken trading is not implemented.
const krakenAdapter = makeAdapter('kraken', {
  testConnection: () => Promise.resolve(false),
});

const ADAPTERS: Partial<Record<ExchangeId, ExchangeAdapter>> = {
  coinbase: coinbaseAdapter,
  kraken: krakenAdapter,
};

/** Get the adapter for a venue id, or undefined for unknown/unregistered ids. */
export function getAdapter(id: string): ExchangeAdapter | undefined {
  return (ADAPTERS as Record<string, ExchangeAdapter | undefined>)[id];
}

/** Map persisted settings fields to adapter credentials. */
export function adapterCredentialsFromSettings(settings: {
  cdpKeyName?: string;
  cdpPrivateKey?: string;
  krakenApiKey?: string;
  krakenApiSecret?: string;
}): AdapterCredentials {
  return {
    cdpKeyName: settings.cdpKeyName,
    cdpPrivateKey: settings.cdpPrivateKey,
    krakenApiKey: settings.krakenApiKey,
    krakenApiSecret: settings.krakenApiSecret,
  };
}

/**
 * Resolve how an order should be routed for a venue.
 * Kraken local trading is blocked (HMAC stays server-side).
 */
export function canExecuteLocally(exchangeId: string, user: unknown): ExecutionPath {
  if (user) return 'server';

  const adapter = getAdapter(exchangeId);
  if (!adapter?.config.canTrade) return 'unsupported';
  if (exchangeId === 'kraken') return 'unsupported';

  return 'local';
}

export { coinbaseAdapter, krakenAdapter };
