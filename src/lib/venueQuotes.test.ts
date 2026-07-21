import { describe, expect, it } from 'vitest';
import {
  bestCrossVenueOpportunity,
  buildVenueSnapshot,
  DEFAULT_ARB_NET_THRESHOLD_PCT,
  intraVenueSpread,
  parseCoinbaseBestBidAsk,
  parseGeminiPubTicker,
  parseKrakenTicker,
  snapshotsFromFixture,
  summarizeQuoteSources,
} from './venueQuotes';

const TS = 1_700_000_000_000;

describe('parseCoinbaseBestBidAsk', () => {
  it('maps PAXG and XAUT books', () => {
    const legs = parseCoinbaseBestBidAsk(
      {
        pricebooks: [
          {
            product_id: 'PAXG-USD',
            bids: [{ price: '2600.00' }],
            asks: [{ price: '2602.00' }],
          },
          {
            product_id: 'XAUT-USD',
            bids: [{ price: '2615.00' }],
            asks: [{ price: '2618.00' }],
          },
        ],
      },
      TS,
    );
    expect(legs.paxgUsd?.bid).toBe(2600);
    expect(legs.paxgUsd?.ask).toBe(2602);
    expect(legs.xautUsd?.bid).toBe(2615);
    expect(legs.xautUsd?.source).toBe('live');
  });
});

describe('parseKrakenTicker', () => {
  it('maps USD pairs and direct PAXG-XAUT', () => {
    const legs = parseKrakenTicker(
      {
        result: {
          PAXGUSD: { a: ['2598.00', '1'], b: ['2596.00', '1'] },
          XAUTUSD: { a: ['2610.00', '1'], b: ['2608.00', '1'] },
          PAXGXAUT: { a: ['1.0045', '1'], b: ['1.0030', '1'] },
        },
      },
      TS,
    );
    expect(legs.paxgUsd?.ask).toBe(2598);
    expect(legs.xautUsd?.bid).toBe(2608);
    expect(legs.paxgXautDirect?.bid).toBe(1.003);
  });

  it('returns empty on Kraken error array', () => {
    expect(parseKrakenTicker({ error: ['EQuery:Unknown asset pair'] })).toEqual({});
  });
});

describe('parseGeminiPubTicker', () => {
  it('parses bid/ask', () => {
    const legs = parseGeminiPubTicker({ bid: '2595.00', ask: '2597.00' }, TS);
    expect(legs.paxgUsd?.mid).toBeCloseTo(2596, 0);
  });
});

describe('intraVenueSpread', () => {
  it('computes net spread with round-trip fees for USD legs', () => {
    const snap = buildVenueSnapshot('coinbase', {
      paxgUsd: { bid: 2600, ask: 2602, mid: 2601, ts: TS, source: 'live' },
      xautUsd: { bid: 2615, ask: 2618, mid: 2616.5, ts: TS, source: 'live' },
    });
    expect(snap).not.toBeNull();
    const spread = intraVenueSpread(snap!);
    expect(spread).not.toBeNull();
    expect(spread!.roundTripFeeBps).toBe(120);
    expect(spread!.rawSpreadPct).toBeCloseTo(((2615 - 2602) / 2602) * 100, 4);
    expect(spread!.netSpreadPct).toBeCloseTo(spread!.rawSpreadPct - 1.2, 4);
  });

  it('uses direct pair fee for Kraken when present', () => {
    const snap = buildVenueSnapshot('kraken', {
      paxgUsd: { bid: 2600, ask: 2602, mid: 2601, ts: TS, source: 'live' },
      xautUsd: { bid: 2610, ask: 2612, mid: 2611, ts: TS, source: 'live' },
      paxgXautDirect: { bid: 1.003, ask: 1.005, mid: 1.004, ts: TS, source: 'live' },
    });
    const spread = intraVenueSpread(snap!);
    expect(spread).not.toBeNull();
    expect(spread!.roundTripFeeBps).toBe(26);
  });
});

describe('bestCrossVenueOpportunity', () => {
  it('finds the best net cross-venue edge', () => {
    const snapshots = snapshotsFromFixture({
      fetchedAt: TS,
      venues: [
        {
          venueId: 'kraken',
          paxgUsd: { bid: 2590, ask: 2592 },
          xautUsd: { bid: 2605, ask: 2608 },
        },
        {
          venueId: 'coinbase',
          paxgUsd: { bid: 2600, ask: 2603 },
          xautUsd: { bid: 2620, ask: 2623 },
        },
        {
          venueId: 'gemini',
          paxgUsd: { bid: 2595, ask: 2597 },
        },
      ],
    });

    const opp = bestCrossVenueOpportunity(snapshots, DEFAULT_ARB_NET_THRESHOLD_PCT);
    expect(opp).not.toBeNull();
    expect(opp!.buyVenue).toBe('kraken');
    expect(opp!.sellVenue).toBe('coinbase');
    expect(opp!.buyAsset).toBe('PAXG');
    expect(opp!.sellAsset).toBe('XAUT');
    expect(opp!.netSpreadPct).toBeGreaterThan(0);
  });
});

describe('summarizeQuoteSources', () => {
  it('counts leg sources', () => {
    const snapshots = snapshotsFromFixture({
      venues: [
        {
          venueId: 'coinbase',
          paxgUsd: { bid: 2600, ask: 2602 },
          xautUsd: { bid: 2610, ask: 2612 },
        },
      ],
    });
    const summary = summarizeQuoteSources(snapshots);
    expect(summary.mock).toBe(2);
    expect(summary.label).toContain('mock');
  });
});

describe('snapshotsFromFixture', () => {
  it('produces deterministic mock snapshots for E2E', () => {
    const snapshots = snapshotsFromFixture({
      venues: [
        {
          venueId: 'kraken',
          paxgUsd: { bid: 2578, ask: 2580 },
          xautUsd: { bid: 2610, ask: 2612 },
          paxgXautDirect: { bid: 1.012, ask: 1.015 },
        },
        {
          venueId: 'coinbase',
          paxgUsd: { bid: 2590, ask: 2593 },
          xautUsd: { bid: 2625, ask: 2628 },
        },
      ],
    });
    expect(snapshots).toHaveLength(2);
    const opp = bestCrossVenueOpportunity(snapshots, 0.55);
    expect(opp?.profitable).toBe(true);
  });
});
