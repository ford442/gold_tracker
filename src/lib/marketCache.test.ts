import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearMarketCache,
  getMarketCacheStats,
  getMarketChartSeries,
  invalidateMarketCache,
  type MarketFetcher,
  type MarketSeries,
} from './marketCache';

const SERIES: MarketSeries = [[1, 100], [2, 110], [3, 120]];

/** A fetcher that counts calls and returns a configurable series after a tick. */
function countingFetcher(series: MarketSeries = SERIES) {
  const fn = vi.fn<MarketFetcher>(async () => {
    await Promise.resolve();
    return series;
  });
  return fn;
}

beforeEach(() => {
  clearMarketCache();
});

afterEach(() => {
  clearMarketCache();
  vi.restoreAllMocks();
});

describe('de-dupe', () => {
  it('concurrent identical requests share one underlying fetch', async () => {
    const fetcher = countingFetcher();
    const [a, b, c] = await Promise.all([
      getMarketChartSeries('pax-gold', '30', 'daily', { fetcher, persist: false }),
      getMarketChartSeries('pax-gold', '30', 'daily', { fetcher, persist: false }),
      getMarketChartSeries('pax-gold', '30', 'daily', { fetcher, persist: false }),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(a).toEqual(SERIES);
    expect(b).toEqual(SERIES);
    expect(c).toEqual(SERIES);
  });

  it('different keys do not share', async () => {
    const fetcher = countingFetcher();
    await Promise.all([
      getMarketChartSeries('pax-gold', '30', 'daily', { fetcher, persist: false }),
      getMarketChartSeries('bitcoin', '30', 'daily', { fetcher, persist: false }),
      getMarketChartSeries('pax-gold', '90', 'daily', { fetcher, persist: false }),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});

describe('caching', () => {
  it('serves a fresh cached value without refetching', async () => {
    const fetcher = countingFetcher();
    await getMarketChartSeries('pax-gold', '30', 'daily', { fetcher, persist: false });
    await getMarketChartSeries('pax-gold', '30', 'daily', { fetcher, persist: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(getMarketCacheStats().entries).toBe(1);
  });

  it('refetches once the TTL has elapsed', async () => {
    const fetcher = countingFetcher();
    await getMarketChartSeries('pax-gold', '30', 'daily', { fetcher, ttlMs: 0, persist: false });
    await getMarketChartSeries('pax-gold', '30', 'daily', { fetcher, ttlMs: 0, persist: false });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not cache empty/failed results', async () => {
    const empty = countingFetcher([]);
    const a = await getMarketChartSeries('pax-gold', '30', 'daily', { fetcher: empty, persist: false });
    expect(a).toEqual([]);
    expect(getMarketCacheStats().entries).toBe(0);

    const good = countingFetcher();
    const b = await getMarketChartSeries('pax-gold', '30', 'daily', { fetcher: good, persist: false });
    expect(b).toEqual(SERIES);
    expect(good).toHaveBeenCalledTimes(1);
  });
});

describe('force refresh / invalidate', () => {
  it('forceRefresh bypasses a fresh cache entry', async () => {
    const fetcher = countingFetcher();
    await getMarketChartSeries('pax-gold', '30', 'daily', { fetcher, persist: false });
    await getMarketChartSeries('pax-gold', '30', 'daily', { fetcher, persist: false, forceRefresh: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('invalidate by cgId drops matching entries', async () => {
    const fetcher = countingFetcher();
    await getMarketChartSeries('pax-gold', '30', 'daily', { fetcher, persist: false });
    await getMarketChartSeries('bitcoin', '30', 'daily', { fetcher, persist: false });
    invalidateMarketCache('pax-gold');
    expect(getMarketCacheStats().entries).toBe(1); // only bitcoin remains

    await getMarketChartSeries('pax-gold', '30', 'daily', { fetcher, persist: false });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('clearMarketCache empties everything', async () => {
    const fetcher = countingFetcher();
    await getMarketChartSeries('pax-gold', '30', 'daily', { fetcher, persist: false });
    clearMarketCache();
    expect(getMarketCacheStats().entries).toBe(0);
  });
});

describe('sessionStorage persistence', () => {
  // A plain object works for both getItem/setItem/removeItem and Object.keys().
  let backing: Record<string, string>;

  beforeEach(() => {
    backing = {};
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => (k in backing ? backing[k] : null),
      setItem: (k: string, v: string) => { backing[k] = v; },
      removeItem: (k: string) => { delete backing[k]; },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes a last-good series to sessionStorage on success', async () => {
    const good = countingFetcher();
    await getMarketChartSeries('pax-gold', '30', 'daily', { fetcher: good });
    expect(Object.keys(backing).some((k) => k.startsWith('gt-mkt::'))).toBe(true);
  });

  it('falls back to a pre-seeded persisted series when the network returns empty', async () => {
    // Simulate a fresh session (empty in-memory cache) that has a last-good copy.
    backing['gt-mkt::pax-gold::30::daily'] = JSON.stringify({ data: SERIES, savedAt: Date.now() });
    const empty = countingFetcher([]);
    const result = await getMarketChartSeries('pax-gold', '30', 'daily', { fetcher: empty });
    expect(result).toEqual(SERIES);
  });

  it('forceRefresh removes the persisted entry for that key', async () => {
    const good = countingFetcher();
    await getMarketChartSeries('pax-gold', '30', 'daily', { fetcher: good });
    expect('gt-mkt::pax-gold::30::daily' in backing).toBe(true);

    const empty = countingFetcher([]);
    const result = await getMarketChartSeries('pax-gold', '30', 'daily', { fetcher: empty, forceRefresh: true });
    expect(result).toEqual([]); // persisted was busted, so no fallback
    expect('gt-mkt::pax-gold::30::daily' in backing).toBe(false);
  });
});

describe('abort handling', () => {
  it('rejects immediately if the signal is already aborted', async () => {
    const fetcher = countingFetcher();
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(
      getMarketChartSeries('pax-gold', '30', 'daily', { fetcher, signal: ctrl.signal, persist: false }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('an aborting waiter cancels cleanly while other waiters still resolve', async () => {
    let resolveFetch!: (v: MarketSeries) => void;
    const fetcher = vi.fn<MarketFetcher>(() => new Promise<MarketSeries>((r) => { resolveFetch = r; }));

    const ctrlA = new AbortController();
    const aborted = getMarketChartSeries('pax-gold', '30', 'daily', { fetcher, signal: ctrlA.signal, persist: false });
    const survivor = getMarketChartSeries('pax-gold', '30', 'daily', { fetcher, persist: false });

    ctrlA.abort();
    resolveFetch(SERIES);

    await expect(aborted).rejects.toMatchObject({ name: 'AbortError' });
    await expect(survivor).resolves.toEqual(SERIES);
    expect(fetcher).toHaveBeenCalledTimes(1); // shared fetch survived the abort
  });
});
