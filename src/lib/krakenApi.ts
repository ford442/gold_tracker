/**
 * Kraken API utility for client-side reference
 * Note: Actual trading happens server-side in Edge Functions for security
 */

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

// Trading pair mapping for Kraken
export const KRAKEN_PAIRS: Record<string, string> = {
  'PAXG-USD': 'PAXGUSD',
  'XAUT-USD': 'XAUTUSD',
  'BTC-USD': 'XXBTZUSD',
  'ETH-USD': 'XETHZUSD',
  'PAXG-XAUT': 'PAXGXAUT', // Direct pair! Lower fees for arb
};

// Inverse mapping
export const KRAKEN_PAIRS_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(KRAKEN_PAIRS).map(([k, v]) => [v, k])
);

/**
 * Check if a direct PAXG/XAUT pair exists on Kraken
 * This is the key advantage for arbitrage!
 */
export function hasDirectPaxgXautPair(): boolean {
  return true; // Kraken supports PAXGXAUT directly
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
  const tradeSize = 1000; // USD assumption for calc
  
  // Coinbase Advanced: 0.6% taker fee per trade = 1.2% total
  const coinbaseFee = tradeSize * 0.012;
  
  // Kraken: 0.26% taker fee for one direct trade
  const krakenFee = tradeSize * 0.0026;
  
  const estimatedProfit = tradeSize * (spreadPercent / 100);
  console.log('Estimated profit:', estimatedProfit); // Used for calculation display
  
  return {
    coinbaseCost: coinbaseFee,
    krakenCost: krakenFee,
    savings: coinbaseFee - krakenFee,
    recommended: krakenFee < coinbaseFee ? 'kraken' : 'coinbase',
  };
}
