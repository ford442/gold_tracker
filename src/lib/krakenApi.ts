/**
 * Kraken API utility for client-side reference
 * Note: Actual trading happens server-side in Edge Functions for security
 */

import {
  getExchangeConfig,
  getVenuePairMap,
  reverseVenuePairMap,
  roundTripPaxgXautFeeBps,
} from './exchanges';

export interface KrakenOrder {
  pair: string;           // e.g., "PAXGUSD", "XAUTUSD", "PAXGXAUT"
  type: 'buy' | 'sell';
  ordertype: 'market' | 'limit';
  volume: string;
  price?: string;
}

export interface KrakenOrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
  description?: string;
}

// Kraken uses HMAC-SHA512 for authentication
// This function is for reference - actual signing happens in Edge Functions
export function createKrakenSignature(
  _apiSecret: string,
  _path: string,
  nonce: string,
  postData: Record<string, unknown>
): string {
  const message = nonce + JSON.stringify(postData);
  
  // In browser/Deno: use crypto.subtle for proper HMAC-SHA512
  // This is a simplified placeholder - real implementation in Edge Function
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  
  // Return base64 encoded signature
  // Note: Real implementation needs crypto.subtle.sign with HMAC-SHA512
  return btoa(String.fromCharCode(...new Uint8Array(data.slice(0, 64))));
}

// Trading pair mapping for Kraken — sourced from shared/exchanges.json
export const KRAKEN_PAIRS: Record<string, string> = getVenuePairMap('kraken');

// Inverse mapping
export const KRAKEN_PAIRS_REVERSE: Record<string, string> = reverseVenuePairMap('kraken');

/**
 * Check if a direct PAXG/XAUT pair exists on Kraken
 * This is the key advantage for arbitrage!
 */
export function hasDirectPaxgXautPair(): boolean {
  return getExchangeConfig('kraken')?.directPaxgXaut ?? false;
}

/**
 * Calculate potential savings using Kraken direct pair vs Coinbase
 * 
 * Coinbase: PAXG → USD → XAUT (2 trades, 2x fees)
 * Kraken:   PAXG → XAUT directly (1 trade, lower fee)
 */
export function calculateKrakenSavings(spreadPercent: number): {
  coinbaseCost: number;
  krakenCost: number;
  savings: number;
  recommended: 'kraken' | 'coinbase';
} {
  void spreadPercent;
  const tradeSize = 1000; // USD assumption for calc

  // Fees sourced from the venue registry (exchanges.ts):
  // Coinbase routes PAXG→USD→XAUT (2 legs); Kraken uses a direct pair (1 leg).
  const coinbaseFee = tradeSize * roundTripPaxgXautFeeBps('coinbase') / 10_000;
  const krakenFee = tradeSize * roundTripPaxgXautFeeBps('kraken') / 10_000;

  return {
    coinbaseCost: coinbaseFee,
    krakenCost: krakenFee,
    savings: coinbaseFee - krakenFee,
    recommended: krakenFee < coinbaseFee ? 'kraken' : 'coinbase',
  };
}
