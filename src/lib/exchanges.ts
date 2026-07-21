/**
 * Exchange registry facade — re-exports the shared registry consumed by Vite and Edge Functions.
 * Canonical venue data lives in `shared/exchanges.json`.
 */

export type {
  ExchangeAuthMethod,
  ExchangeStatus,
  LiveTradingExchangeId,
  ExchangeId,
  ExchangeKeyField,
  ExchangeConfig,
  ArbFeeQuote,
} from '@shared/registry';

export {
  EXCHANGES,
  EXCHANGE_LIST,
  isExchangeId,
  getExchangeConfig,
  isLiveTradingExchange,
  liveTradingExchangeLabels,
  listExchanges,
  liveTradingExchanges,
  takerFeeBps,
  estimateFeeUsd,
  roundTripPaxgXautFeeBps,
  supportsPair,
  resolveVenuePair,
  getVenuePairMap,
  reverseVenuePairMap,
  comparePaxgXautArbFees,
  bestPaxgXautVenue,
} from '@shared/registry';
