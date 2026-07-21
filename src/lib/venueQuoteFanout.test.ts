import { describe, expect, it, beforeEach } from 'vitest';
import {
  clearVenueQuoteCache,
  getVenueGoldSnapshots,
  getVenueQuoteCacheStats,
  COINBASE_BEST_BID_ASK_URL,
} from './venueQuoteFanout';

describe('venueQuoteFanout', () => {
  beforeEach(() => {
    clearVenueQuoteCache();
  });

  it('returns mock snapshots when useMock is true', async () => {
    const result = await getVenueGoldSnapshots({ useMock: true });
    expect(result.isMock).toBe(true);
    expect(result.snapshots.length).toBeGreaterThanOrEqual(2);
    expect(result.snapshots.some((s) => s.venueId === 'kraken')).toBe(true);
  });

  it('dedupes concurrent fetches', async () => {
    let calls = 0;
    const fetcher = async (url: string) => {
      calls += 1;
      if (url.includes('coinbase')) {
        return {
          pricebooks: [
            {
              product_id: 'PAXG-USD',
              bids: [{ price: '2600' }],
              asks: [{ price: '2602' }],
            },
            {
              product_id: 'XAUT-USD',
              bids: [{ price: '2610' }],
              asks: [{ price: '2612' }],
            },
          ],
        };
      }
      if (url.includes('kraken')) {
        return {
          result: {
            PAXGUSD: { a: ['2601', '1'], b: ['2599', '1'] },
            XAUTUSD: { a: ['2611', '1'], b: ['2609', '1'] },
          },
        };
      }
      return { bid: '2598', ask: '2600' };
    };

    const [a, b] = await Promise.all([
      getVenueGoldSnapshots({ fetcher, forceRefresh: true }),
      getVenueGoldSnapshots({ fetcher }),
    ]);

    expect(a.snapshots.length).toBeGreaterThan(0);
    expect(b.snapshots).toEqual(a.snapshots);
    expect(getVenueQuoteCacheStats().cached).toBe(true);
    expect(calls).toBeLessThanOrEqual(6);
  });

  it('falls back to mock when all venue fetches fail', async () => {
    const fetcher = async () => {
      throw new Error('network down');
    };
    const result = await getVenueGoldSnapshots({ fetcher, forceRefresh: true });
    expect(result.isMock).toBe(true);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('serves cached result within TTL', async () => {
    let calls = 0;
    const fetcher = async (url: string) => {
      calls += 1;
      if (url === COINBASE_BEST_BID_ASK_URL) {
        return {
          pricebooks: [
            {
              product_id: 'PAXG-USD',
              bids: [{ price: '2600' }],
              asks: [{ price: '2602' }],
            },
            {
              product_id: 'XAUT-USD',
              bids: [{ price: '2610' }],
              asks: [{ price: '2612' }],
            },
          ],
        };
      }
      if (url.includes('kraken')) {
        return {
          result: {
            PAXGUSD: { a: ['2601', '1'], b: ['2599', '1'] },
            XAUTUSD: { a: ['2611', '1'], b: ['2609', '1'] },
          },
        };
      }
      return { bid: '2598', ask: '2600' };
    };

    await getVenueGoldSnapshots({ fetcher, forceRefresh: true, ttlMs: 60_000 });
    const before = calls;
    await getVenueGoldSnapshots({ fetcher, ttlMs: 60_000 });
    expect(calls).toBe(before);
  });
});
