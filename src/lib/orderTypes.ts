/**
 * Shared order types and pure order builders (no React, no network).
 * Used by adapters, tradeService, and UI execution paths.
 */

import { getExchangeConfig } from './exchanges';

export interface TradeOrder {
  product_id: string;
  side: 'BUY' | 'SELL';
  order_configuration: {
    market_market_ioc?: { base_size: string };
    limit_limit_gtc?: { base_size: string; limit_price: string };
  };
}

export interface OrderResult {
  success: boolean;
  order_id?: string;
  error?: string;
}

export type PlaceTradeResponse = OrderResult & {
  message?: string;
  exchange?: string;
};

export type OrderStatus = 'open' | 'filled' | 'cancelled' | 'partially_filled' | 'unknown';

export interface OrderStatusResult {
  status: OrderStatus;
  venueOrderId?: string;
  filledQty?: number;
  requestedQty?: number;
  avgFillPrice?: number;
  feeUsd?: number;
  error?: string;
}

export interface CancelOrderResult {
  success: boolean;
  error?: string;
}

/** Build a market IOC order (Coinbase-shaped payload shared across venues). */
export function buildMarketIocOrder(
  productId: string,
  side: 'BUY' | 'SELL',
  baseSize: number | string,
): TradeOrder {
  return {
    product_id: productId,
    side,
    order_configuration: {
      market_market_ioc: { base_size: String(baseSize) },
    },
  };
}

/**
 * Resolve a PAXG↔XAUT arb order for a venue.
 * Kraken: direct PAXG-XAUT pair; Coinbase: buy cheaper token via USD leg.
 */
export function resolvePaxgXautArbOrder(
  exchangeId: string,
  spread: number,
  baseSize: number | string,
): TradeOrder {
  const cfg = getExchangeConfig(exchangeId);

  if (cfg?.directPaxgXaut) {
    const side: 'BUY' | 'SELL' = spread > 0 ? 'BUY' : 'SELL';
    return buildMarketIocOrder('PAXG-XAUT', side, baseSize);
  }

  const buyToken = spread > 0 ? 'PAXG' : 'XAUT';
  return buildMarketIocOrder(`${buyToken}-USD`, 'BUY', baseSize);
}
