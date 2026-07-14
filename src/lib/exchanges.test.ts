import { describe, expect, it } from 'vitest';
import {
  EXCHANGES,
  EXCHANGE_LIST,
  bestPaxgXautVenue,
  comparePaxgXautArbFees,
  estimateFeeUsd,
  getExchangeConfig,
  isExchangeId,
  listExchanges,
  liveTradingExchanges,
  roundTripPaxgXautFeeBps,
  supportsPair,
  takerFeeBps,
} from './exchanges';

describe('registry integrity', () => {
  it('keys match each config id', () => {
    for (const [key, cfg] of Object.entries(EXCHANGES)) {
      expect(cfg.id).toBe(key);
    }
  });

  it('every venue has at least one key field and a docs url', () => {
    for (const cfg of EXCHANGE_LIST) {
      expect(cfg.keyFields.length).toBeGreaterThan(0);
      expect(cfg.docsUrl).toMatch(/^https?:\/\//);
    }
  });

  it('planned venues are not tradable', () => {
    for (const cfg of EXCHANGE_LIST) {
      if (cfg.status === 'planned') expect(cfg.canTrade).toBe(false);
    }
  });
});

describe('lookup helpers', () => {
  it('isExchangeId guards unknown ids', () => {
    expect(isExchangeId('coinbase')).toBe(true);
    expect(isExchangeId('binance')).toBe(false);
  });

  it('getExchangeConfig returns undefined for unknown', () => {
    expect(getExchangeConfig('coinbase')?.label).toBe('Coinbase Advanced');
    expect(getExchangeConfig('nope')).toBeUndefined();
  });

  it('listExchanges filters by status', () => {
    expect(listExchanges('live').every((e) => e.status === 'live')).toBe(true);
    expect(listExchanges('planned').map((e) => e.id)).toContain('gemini');
  });

  it('liveTradingExchanges excludes planned venues', () => {
    const ids = liveTradingExchanges().map((e) => e.id);
    expect(ids).toContain('coinbase');
    expect(ids).toContain('kraken');
    expect(ids).not.toContain('gemini');
  });
});

describe('fees', () => {
  it('takerFeeBps reads config and falls back to coinbase', () => {
    expect(takerFeeBps('coinbase')).toBe(60);
    expect(takerFeeBps('kraken')).toBe(26);
    expect(takerFeeBps('unknown')).toBe(60);
  });

  it('estimateFeeUsd computes single-leg cost and clamps negatives', () => {
    expect(estimateFeeUsd(1000, 'coinbase')).toBeCloseTo(6);
    expect(estimateFeeUsd(1000, 'kraken')).toBeCloseTo(2.6);
    expect(estimateFeeUsd(-1000, 'kraken')).toBe(0);
  });

  it('round-trip PAXG/XAUT charges 2 legs unless a direct pair exists', () => {
    expect(roundTripPaxgXautFeeBps('coinbase')).toBe(120); // 2 x 60
    expect(roundTripPaxgXautFeeBps('kraken')).toBe(26); // direct, 1 leg
  });
});

describe('supportsPair', () => {
  it('reflects the configured pair lists', () => {
    expect(supportsPair('kraken', 'PAXG-XAUT')).toBe(true);
    expect(supportsPair('coinbase', 'PAXG-XAUT')).toBe(false);
    expect(supportsPair('coinbase', 'BCH-USD')).toBe(true);
    expect(supportsPair('unknown', 'BTC-USD')).toBe(false);
  });
});

describe('arb fee comparison', () => {
  it('matches the legacy Kraken-vs-Coinbase numbers on a $1000 trade', () => {
    const quotes = comparePaxgXautArbFees(1000);
    const coinbase = quotes.find((q) => q.id === 'coinbase')!;
    const kraken = quotes.find((q) => q.id === 'kraken')!;
    expect(coinbase.costUsd).toBeCloseTo(12, 5);
    expect(kraken.costUsd).toBeCloseTo(2.6, 5);
  });

  it('sorts cheapest first and marks the direct-pair venue', () => {
    const quotes = comparePaxgXautArbFees(1000);
    expect(quotes[0].id).toBe('kraken');
    expect(quotes[0].direct).toBe(true);
  });

  it('bestPaxgXautVenue returns the cheapest live venue', () => {
    expect(bestPaxgXautVenue(1000)?.id).toBe('kraken');
  });
});
