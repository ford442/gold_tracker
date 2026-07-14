export interface TradeSuggestion {
  id: string;
  type: 'arb' | 'premium' | 'hedge';
  action: string;           // "BUY PAXG SELL XAUT"
  size: string;             // "0.5 oz equiv"
  expectedProfit: string;   // "0.72% (est. 7)"
  reason: string;
  confidence: number;       // 0-100
  buttonText: string;
  coinbaseDeepLink?: string;
  // For execution
  productId: string;        // e.g. "PAXG-USD"
  side: 'BUY' | 'SELL';     // Primary action side
  /** Regime context from sparkline fidelity (synthesized spot). */
  regimeTag?: string;
  regimeScore?: number;
  regimeReason?: string;
  regimeDisclaimer?: string;
  /** When true, manual execution is discouraged — regime gate blocked. */
  regimeBlocked?: boolean;
}

export type TradeSuggestionType = TradeSuggestion['type'];
