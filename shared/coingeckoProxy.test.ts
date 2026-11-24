import { describe, expect, it, vi } from 'vitest';
import { ASSETS } from '../src/lib/assets';
import {
  ALLOWED_COIN_IDS,
  buildUpstreamUrl,
  createProxyEngine,
  parseProxyRequest,
  type ProxyRoute,
  type UpstreamResult,
} from './coingeckoProxy';

function parse(path: string, query = '') {
  return parseProxyRequest(path, new URLSearchParams(query));
}

function okRoute(path: string, query: string): ProxyRoute {
  const r = parse(path, query);
  if (!r.ok) throw new Error(`expected ok route, got ${r.error}`);
  return r.route;
}

const MARKETS_BODY = JSON.stringify([{ id: 'pax-gold', current_price: 3300 }]);
const CHART_BODY = JSON.stringify({ prices: [[1, 100], [2, 101]] });

describe('allowlist', () => {
  it('covers every CoinGecko id the app tracks (keep in sync with assets.ts)', () => {
    const tracked = Object.values(ASSETS)
      .map((a) => a.cgId)
      .filter((id): id is NonNullable<typeof id> => id !== null);
    expect(tracked.length).toBeGreaterThan(0);
    for (const id of tracked) expect(ALLOWED_COIN_IDS).toContain(id);
  });
});

describe('parseProxyRequest — markets', () => {
  const q = 'vs_currency=usd&ids=pax-gold,tether-gold&sparkline=true&price_change_percentage=24h,7d';

  it('accepts the exact request the app sends', () => {
    const r = parse('/coins/markets', q);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.route.kind).toBe('markets');
      expect(r.route.upstreamPath).toBe('/coins/markets');
      expect(r.route.ttlMs).toBe(60_000);
    }
  });

  it('canonicalises id order, duplicates and param order into one cache key', () => {
    const a = okRoute('/coins/markets', 'ids=tether-gold,pax-gold,pax-gold&sparkline=true&price_change_percentage=7d,24h&vs_currency=usd');
    const b = okRoute('/coins/markets', q);
    expect(a.cacheKey).toBe(b.cacheKey);
    expect(a.query).toBe(b.query);
  });

  it('defaults vs_currency and sparkline', () => {
    const r = okRoute('/coins/markets', 'ids=bitcoin');
    expect(r.query).toBe('ids=bitcoin&sparkline=false&vs_currency=usd');
  });

  it.each([
    ['missing ids', 'vs_currency=usd'],
    ['empty ids', 'ids='],
    ['disallowed coin', 'ids=pax-gold,dogecoin'],
    ['non-usd currency', 'ids=bitcoin&vs_currency=eur'],
    ['bad sparkline', 'ids=bitcoin&sparkline=yes'],
    ['bad price window', 'ids=bitcoin&price_change_percentage=24h,5y'],
    ['unknown param (cache-busting)', 'ids=bitcoin&_=123'],
    ['too many ids', `ids=${Array.from({ length: 26 }, (_, i) => `c${i}`).join(',')}`],
  ])('rejects %s with 400', (_label, query) => {
    const r = parse('/coins/markets', query);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });
});

describe('parseProxyRequest — market_chart', () => {
  it('accepts the app request and picks a TTL by horizon', () => {
    const day = okRoute('/coins/pax-gold/market_chart', 'vs_currency=usd&days=1&interval=hourly');
    const month = okRoute('/coins/pax-gold/market_chart', 'vs_currency=usd&days=30&interval=daily');
    const year = okRoute('/coins/pax-gold/market_chart', 'vs_currency=usd&days=365&interval=daily');
    const max = okRoute('/coins/pax-gold/market_chart', 'vs_currency=usd&days=max&interval=daily');
    expect(day.ttlMs).toBeLessThan(month.ttlMs);
    expect(month.ttlMs).toBeLessThan(year.ttlMs);
    expect(max.ttlMs).toBe(year.ttlMs);
    expect(month.upstreamPath).toBe('/coins/pax-gold/market_chart');
    expect(month.kind).toBe('market_chart');
  });

  it('ignores the function mount prefix and trailing slash', () => {
    const bare = okRoute('/coins/bitcoin/market_chart', 'days=7&interval=daily');
    const supa = okRoute('/functions/v1/coingecko-proxy/coins/bitcoin/market_chart/', 'days=7&interval=daily');
    const short = okRoute('/coingecko-proxy/coins/bitcoin/market_chart', 'interval=daily&days=7');
    expect(supa.cacheKey).toBe(bare.cacheKey);
    expect(short.cacheKey).toBe(bare.cacheKey);
  });

  it('keeps hourly and daily series apart', () => {
    const h = okRoute('/coins/bitcoin/market_chart', 'days=7&interval=hourly');
    const d = okRoute('/coins/bitcoin/market_chart', 'days=7&interval=daily');
    expect(h.cacheKey).not.toBe(d.cacheKey);
  });

  it('allows omitting interval', () => {
    expect(okRoute('/coins/bitcoin/market_chart', 'days=7').query).toBe('days=7&vs_currency=usd');
  });

  it.each([
    ['disallowed coin', '/coins/dogecoin/market_chart', 'days=7'],
    ['missing days', '/coins/bitcoin/market_chart', 'interval=daily'],
    ['zero days', '/coins/bitcoin/market_chart', 'days=0'],
    ['too many days', '/coins/bitcoin/market_chart', 'days=366'],
    ['fractional days', '/coins/bitcoin/market_chart', 'days=1.5'],
    ['non-numeric days', '/coins/bitcoin/market_chart', 'days=abc'],
    ['bad interval', '/coins/bitcoin/market_chart', 'days=7&interval=minutely'],
    ['non-usd currency', '/coins/bitcoin/market_chart', 'days=7&vs_currency=eur'],
    ['unknown param', '/coins/bitcoin/market_chart', 'days=7&x_cg_demo_api_key=abc'],
  ])('rejects %s with 400', (_label, path, query) => {
    const r = parse(path, query);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it.each(['/', '/health', '/coins', '/coins/bitcoin', '/coins/bitcoin/ohlc', '/coins/a/b/market_chart'])(
    'returns 404 for unknown route %s',
    (path) => {
      const r = parse(path, 'days=7');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.status).toBe(404);
    },
  );
});

describe('buildUpstreamUrl', () => {
  it('joins base, path and canonical query', () => {
    const route = okRoute('/coins/pax-gold/market_chart', 'days=7&interval=daily');
    expect(buildUpstreamUrl(route)).toBe(
      'https://api.coingecko.com/api/v3/coins/pax-gold/market_chart?days=7&interval=daily&vs_currency=usd',
    );
    expect(buildUpstreamUrl(route, 'https://example.test/v3')).toMatch(/^https:\/\/example\.test\/v3\/coins\//);
  });
});

describe('createProxyEngine', () => {
  const chartRoute = () => okRoute('/coins/pax-gold/market_chart', 'days=30&interval=daily');
  const marketsRoute = () => okRoute('/coins/markets', 'ids=pax-gold&sparkline=true');

  function setup(opts: Parameters<typeof createProxyEngine>[0] = {}) {
    let t = 1_000_000;
    const engine = createProxyEngine({ now: () => t, ...opts });
    return { engine, advance: (ms: number) => { t += ms; }, now: () => t };
  }

  const ok = (body: string): UpstreamResult => ({ status: 200, body });

  it('serves repeat requests from cache within the TTL', async () => {
    const { engine, advance } = setup();
    const upstream = vi.fn().mockResolvedValue(ok(CHART_BODY));

    const first = await engine.handle(chartRoute(), upstream);
    advance(60_000);
    const second = await engine.handle(chartRoute(), upstream);

    expect(first).toMatchObject({ status: 200, cache: 'MISS', body: CHART_BODY });
    expect(second).toMatchObject({ status: 200, cache: 'HIT', body: CHART_BODY });
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it('refetches once the TTL has passed', async () => {
    const { engine, advance } = setup();
    const upstream = vi.fn().mockResolvedValue(ok(CHART_BODY));
    const route = chartRoute();

    await engine.handle(route, upstream);
    advance(route.ttlMs + 1);
    const again = await engine.handle(route, upstream);

    expect(again.cache).toBe('MISS');
    expect(upstream).toHaveBeenCalledTimes(2);
  });

  it('shares one upstream call between concurrent identical requests', async () => {
    const { engine } = setup();
    let release!: (r: UpstreamResult) => void;
    const upstream = vi.fn(
      () => new Promise<UpstreamResult>((resolve) => { release = resolve; }),
    );

    const a = engine.handle(chartRoute(), upstream);
    const b = engine.handle(chartRoute(), upstream);
    const c = engine.handle(marketsRoute(), vi.fn().mockResolvedValue(ok(MARKETS_BODY)));
    expect(engine.stats().inFlight).toBeGreaterThanOrEqual(1);
    release(ok(CHART_BODY));

    expect((await a).status).toBe(200);
    expect((await b).status).toBe(200);
    expect((await c).status).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(engine.stats().inFlight).toBe(0);
  });

  it('starts a cooldown on 429 and leaves upstream alone until it ends', async () => {
    const { engine, advance } = setup();
    const limited = vi.fn().mockResolvedValue({ status: 429, body: 'slow down', retryAfterSec: 30 } satisfies UpstreamResult);
    const healthy = vi.fn().mockResolvedValue(ok(MARKETS_BODY));

    const first = await engine.handle(chartRoute(), limited);
    expect(first).toMatchObject({ status: 429, cache: 'NONE', retryAfterSec: 30 });

    // A different route during the cooldown must not reach upstream either.
    const during = await engine.handle(marketsRoute(), healthy);
    expect(during.status).toBe(429);
    expect(during.retryAfterSec).toBeGreaterThan(0);
    expect(healthy).not.toHaveBeenCalled();

    advance(30_001);
    const after = await engine.handle(marketsRoute(), healthy);
    expect(after).toMatchObject({ status: 200, cache: 'MISS' });
    expect(healthy).toHaveBeenCalledTimes(1);
  });

  it('clamps an absurd Retry-After and defaults a missing one', async () => {
    const huge = setup();
    const r1 = await huge.engine.handle(
      chartRoute(),
      vi.fn().mockResolvedValue({ status: 429, body: '', retryAfterSec: 86_400 } satisfies UpstreamResult),
    );
    expect(r1.retryAfterSec).toBe(300);

    const none = setup();
    const r2 = await none.engine.handle(
      chartRoute(),
      vi.fn().mockResolvedValue({ status: 429, body: '' } satisfies UpstreamResult),
    );
    expect(r2.retryAfterSec).toBe(60);
  });

  it('serves the last good copy when upstream starts failing', async () => {
    const { engine, advance } = setup();
    const route = chartRoute();
    await engine.handle(route, vi.fn().mockResolvedValue(ok(CHART_BODY)));
    advance(route.ttlMs + 1);

    const viaServerError = await engine.handle(route, vi.fn().mockResolvedValue({ status: 503, body: 'down' } satisfies UpstreamResult));
    expect(viaServerError).toMatchObject({ status: 200, cache: 'STALE', body: CHART_BODY, maxAgeSec: 0 });

    const viaThrow = await engine.handle(route, vi.fn().mockRejectedValue(new Error('boom')));
    expect(viaThrow).toMatchObject({ status: 200, cache: 'STALE' });
  });

  it('serves stale during a 429 cooldown instead of an error', async () => {
    const { engine, advance } = setup();
    const route = chartRoute();
    await engine.handle(route, vi.fn().mockResolvedValue(ok(CHART_BODY)));
    advance(route.ttlMs + 1);

    const limited = await engine.handle(route, vi.fn().mockResolvedValue({ status: 429, body: '' } satisfies UpstreamResult));
    expect(limited).toMatchObject({ status: 200, cache: 'STALE' });
  });

  it('does not serve a copy older than the stale window', async () => {
    const { engine, advance } = setup({ staleMaxAgeMs: 60 * 60_000 });
    const route = chartRoute();
    await engine.handle(route, vi.fn().mockResolvedValue(ok(CHART_BODY)));
    advance(61 * 60_000);

    const r = await engine.handle(route, vi.fn().mockResolvedValue({ status: 500, body: '' } satisfies UpstreamResult));
    expect(r.status).toBe(502);
  });

  it('maps upstream failures to a client-readable status', async () => {
    const { engine } = setup();
    const r502 = await engine.handle(chartRoute(), vi.fn().mockResolvedValue({ status: 0, body: '' } satisfies UpstreamResult));
    expect(r502.status).toBe(502);
    expect(JSON.parse(r502.body)).toMatchObject({ upstreamStatus: 0 });

    const r404 = await engine.handle(marketsRoute(), vi.fn().mockResolvedValue({ status: 404, body: '' } satisfies UpstreamResult));
    expect(r404.status).toBe(404);

    const rThrow = await setup().engine.handle(chartRoute(), vi.fn().mockRejectedValue(new Error('timeout')));
    expect(rThrow.status).toBe(502);
  });

  it.each([
    ['HTML challenge page', '<html>Just a moment…</html>'],
    ['empty chart', JSON.stringify({ prices: [] })],
    ['wrong shape', JSON.stringify({ status: { error_code: 429 } })],
    ['null', 'null'],
    ['empty body', ''],
  ])('never caches a 200 with %s', async (_label, body) => {
    const { engine } = setup();
    const route = chartRoute();
    const r = await engine.handle(route, vi.fn().mockResolvedValue(ok(body)));
    expect(r.status).toBe(502);
    expect(engine.stats().entries).toBe(0);

    // …and the next good response is not blocked by the bad one.
    const good = await engine.handle(route, vi.fn().mockResolvedValue(ok(CHART_BODY)));
    expect(good).toMatchObject({ status: 200, cache: 'MISS' });
  });

  it('rejects an empty markets array', async () => {
    const { engine } = setup();
    const r = await engine.handle(marketsRoute(), vi.fn().mockResolvedValue(ok('[]')));
    expect(r.status).toBe(502);
  });

  it('evicts the oldest entries beyond maxEntries', async () => {
    const { engine } = setup({ maxEntries: 2 });
    const ids = ['pax-gold', 'tether-gold', 'bitcoin'];
    for (const id of ids) {
      await engine.handle(okRoute(`/coins/${id}/market_chart`, 'days=7&interval=daily'), vi.fn().mockResolvedValue(ok(CHART_BODY)));
    }
    expect(engine.stats().entries).toBe(2);

    const upstream = vi.fn().mockResolvedValue(ok(CHART_BODY));
    await engine.handle(okRoute('/coins/pax-gold/market_chart', 'days=7&interval=daily'), upstream);
    expect(upstream).toHaveBeenCalledTimes(1); // pax-gold was evicted
    await engine.handle(okRoute('/coins/bitcoin/market_chart', 'days=7&interval=daily'), upstream);
    expect(upstream).toHaveBeenCalledTimes(1); // bitcoin still cached
  });
});
