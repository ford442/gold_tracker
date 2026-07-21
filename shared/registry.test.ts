import { describe, expect, it } from 'vitest';
import * as clientExchanges from '../src/lib/exchanges';
import {
  EXCHANGES,
  EXCHANGE_LIST,
  getExchangeConfig,
  getVenuePairMap,
  isLiveTradingExchange,
  liveTradingExchanges,
  resolveVenuePair,
  roundTripPaxgXautFeeBps,
  supportsPair,
} from './registry';

describe('registry integrity', () => {
  it('keys match each config id', () => {
    for (const [key, cfg] of Object.entries(EXCHANGES)) {
      expect(cfg.id).toBe(key);
    }
  });

  it('every supported pair has a venuePairIds entry when the map is defined', () => {
    for (const cfg of EXCHANGE_LIST) {
      if (!cfg.venuePairIds) continue;
      for (const pair of cfg.supportedPairs) {
        expect(cfg.venuePairIds[pair], `${cfg.id} missing venuePairIds for ${pair}`).toBeDefined();
      }
    }
  });

  it('coinbase venuePairIds are identity mappings', () => {
    const coinbase = getExchangeConfig('coinbase')!;
    for (const pair of coinbase.supportedPairs) {
      expect(coinbase.venuePairIds?.[pair]).toBe(pair);
    }
  });

  it('kraken venuePairIds differ from canonical product ids', () => {
    const kraken = getExchangeConfig('kraken')!;
    for (const pair of kraken.supportedPairs) {
      const native = kraken.venuePairIds?.[pair];
      expect(native).toBeDefined();
      expect(native).not.toBe(pair);
    }
  });

  it('directPaxgXaut is true iff PAXG-XAUT is supported', () => {
    for (const cfg of EXCHANGE_LIST) {
      const hasDirect = cfg.supportedPairs.includes('PAXG-XAUT');
      expect(cfg.directPaxgXaut).toBe(hasDirect);
    }
  });

  it('live tradable venues are exactly coinbase and kraken', () => {
    const ids = liveTradingExchanges().map((e) => e.id).sort();
    expect(ids).toEqual(['coinbase', 'kraken']);
  });

  it('isLiveTradingExchange matches live + canTrade', () => {
    expect(isLiveTradingExchange('coinbase')).toBe(true);
    expect(isLiveTradingExchange('kraken')).toBe(true);
    expect(isLiveTradingExchange('gemini')).toBe(false);
    expect(isLiveTradingExchange('binance')).toBe(false);
  });
});

describe('resolveVenuePair', () => {
  it('maps Kraken canonical ids to native symbols', () => {
    expect(resolveVenuePair('kraken', 'PAXG-USD')).toBe('PAXGUSD');
    expect(resolveVenuePair('kraken', 'PAXG-XAUT')).toBe('PAXGXAUT');
  });

  it('returns identity for Coinbase', () => {
    expect(resolveVenuePair('coinbase', 'BCH-USD')).toBe('BCH-USD');
  });

  it('falls back to product id for unknown exchange', () => {
    expect(resolveVenuePair('unknown', 'BTC-USD')).toBe('BTC-USD');
  });
});

describe('fee sanity', () => {
  it('locks round-trip PAXG/XAUT fee assumptions', () => {
    expect(roundTripPaxgXautFeeBps('coinbase')).toBe(120);
    expect(roundTripPaxgXautFeeBps('kraken')).toBe(26);
  });
});

describe('supportsPair', () => {
  it('includes BCH-USD on Coinbase (fixes prior Edge drift)', () => {
    expect(supportsPair('coinbase', 'BCH-USD')).toBe(true);
    expect(supportsPair('kraken', 'BCH-USD')).toBe(false);
  });
});

describe('client facade parity', () => {
  it('re-exports the same EXCHANGES object', () => {
    expect(clientExchanges.EXCHANGES).toBe(EXCHANGES);
  });

  it('re-exports resolveVenuePair', () => {
    expect(clientExchanges.resolveVenuePair('kraken', 'PAXG-XAUT')).toBe('PAXGXAUT');
  });

  it('krakenApi KRAKEN_PAIRS matches shared venue map', () => {
    expect(getVenuePairMap('kraken')).toEqual({
      'PAXG-USD': 'PAXGUSD',
      'XAUT-USD': 'XAUTUSD',
      'BTC-USD': 'XXBTZUSD',
      'ETH-USD': 'XETHZUSD',
      'PAXG-XAUT': 'PAXGXAUT',
    });
  });
});
