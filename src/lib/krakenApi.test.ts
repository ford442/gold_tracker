import { describe, expect, it } from 'vitest';
import {
  KRAKEN_PAIRS,
  KRAKEN_PAIRS_REVERSE,
  calculateKrakenSavings,
  createKrakenSignature,
  hasDirectPaxgXautPair,
} from './krakenApi';

describe('KRAKEN_PAIRS', () => {
  it('maps internal pair names to Kraken symbols', () => {
    expect(KRAKEN_PAIRS['PAXG-XAUT']).toBe('PAXGXAUT');
    expect(KRAKEN_PAIRS['PAXG-USD']).toBe('PAXGUSD');
  });

  it('has a reverse mapping for each forward pair', () => {
    for (const [internal, kraken] of Object.entries(KRAKEN_PAIRS)) {
      expect(KRAKEN_PAIRS_REVERSE[kraken]).toBe(internal);
    }
  });
});

describe('hasDirectPaxgXautPair', () => {
  it('reports direct PAXG/XAUT support on Kraken', () => {
    expect(hasDirectPaxgXautPair()).toBe(true);
  });
});

describe('calculateKrakenSavings', () => {
  it('recommends Kraken when fees are lower than Coinbase', () => {
    const result = calculateKrakenSavings(0.5);
    expect(result.krakenCost).toBeLessThan(result.coinbaseCost);
    expect(result.savings).toBeCloseTo(result.coinbaseCost - result.krakenCost, 5);
    expect(result.recommended).toBe('kraken');
  });

  it('uses 1.2% total Coinbase cost and 0.26% Kraken cost on $1000 trade', () => {
    const result = calculateKrakenSavings(1);
    expect(result.coinbaseCost).toBeCloseTo(12, 5);
    expect(result.krakenCost).toBeCloseTo(2.6, 5);
    expect(result.savings).toBeCloseTo(9.4, 5);
  });
});

describe('createKrakenSignature', () => {
  it('returns a base64 string from message bytes', () => {
    const sig = createKrakenSignature('secret', '/path', '12345', { pair: 'PAXGUSD' });
    expect(typeof sig).toBe('string');
    expect(sig.length).toBeGreaterThan(0);
    // base64 charset
    expect(sig).toMatch(/^[A-Za-z0-9+/=]+$/);
  });
});
