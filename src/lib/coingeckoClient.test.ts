import { describe, expect, it, vi } from 'vitest';
import {
  AbortError,
  CoinGeckoHttpError,
  computeBackoffMs,
  createCoinGeckoClient,
  parseRetryAfterMs,
  resolveCoinGeckoConfig,
  type CoinGeckoClientConfig,
} from './coingeckoClient';

const json = (status: number, body: unknown = { ok: true }, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

const urlOf = (input: Parameters<typeof fetch>[0]): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Client wired to a fake clock: sleeping just advances time and records the delay. */
function harness(overrides: Partial<CoinGeckoClientConfig> = {}) {
  let t = 1_000_000;
  const sleeps: number[] = [];
  const fetchImpl = vi.fn<typeof fetch>();
  const client = createCoinGeckoClient({
    fetchImpl,
    now: () => t,
    random: () => 0.5, // backoff = 0.75 × ceiling
    sleep: (ms) => {
      sleeps.push(ms);
      t += ms;
      return Promise.resolve();
    },
    baseDelayMs: 100,
    maxDelayMs: 1_000,
    ...overrides,
  });
  return { client, fetchImpl, sleeps, advance: (ms: number) => { t += ms; } };
}

const calledUrl = (fn: ReturnType<typeof vi.fn<typeof fetch>>, n = 0) => urlOf(fn.mock.calls[n][0]);
const calledHeaders = (fn: ReturnType<typeof vi.fn<typeof fetch>>, n = 0) =>
  (fn.mock.calls[n][1]?.headers ?? {}) as Record<string, string>;

describe('parseRetryAfterMs', () => {
  it('reads delta-seconds', () => {
    expect(parseRetryAfterMs('2', 0)).toBe(2000);
    expect(parseRetryAfterMs(' 1.5 ', 0)).toBe(1500);
    expect(parseRetryAfterMs('0', 0)).toBe(0);
  });

  it('reads an HTTP date relative to now', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    expect(parseRetryAfterMs('Thu, 01 Jan 2026 00:00:30 GMT', now)).toBe(30_000);
    expect(parseRetryAfterMs('Wed, 31 Dec 2025 23:00:00 GMT', now)).toBe(0); // already past
  });

  it('ignores missing or garbage values', () => {
    expect(parseRetryAfterMs(undefined, 0)).toBeUndefined();
    expect(parseRetryAfterMs(null, 0)).toBeUndefined();
    expect(parseRetryAfterMs('', 0)).toBeUndefined();
    expect(parseRetryAfterMs('soon', 0)).toBeUndefined();
  });
});

describe('computeBackoffMs', () => {
  it('doubles per attempt, jittered between half and the full ceiling', () => {
    expect(computeBackoffMs(0, 100, 10_000, () => 0)).toBe(50);
    expect(computeBackoffMs(0, 100, 10_000, () => 1)).toBe(100);
    expect(computeBackoffMs(1, 100, 10_000, () => 1)).toBe(200);
    expect(computeBackoffMs(3, 100, 10_000, () => 1)).toBe(800);
  });

  it('never exceeds the max', () => {
    expect(computeBackoffMs(20, 100, 1_000, () => 1)).toBe(1_000);
    expect(computeBackoffMs(20, 100, 1_000, () => 0)).toBe(500);
  });
});

describe('getJson — request shape', () => {
  it('goes direct with the demo key header and drops undefined params', async () => {
    const { client, fetchImpl } = harness({ apiKey: 'CG-direct' });
    fetchImpl.mockResolvedValueOnce(json(200, { hello: 1 }));

    const data = await client.getJson<{ hello: number }>('/coins/markets', { ids: 'bitcoin', skip: undefined, empty: '' });

    expect(data).toEqual({ hello: 1 });
    expect(calledUrl(fetchImpl)).toBe('https://api.coingecko.com/api/v3/coins/markets?ids=bitcoin');
    expect(calledHeaders(fetchImpl)).toEqual({ 'x-cg-demo-api-key': 'CG-direct' });
  });

  it('lets a per-call key override the configured one', async () => {
    const { client, fetchImpl } = harness({ apiKey: 'CG-config' });
    fetchImpl.mockResolvedValueOnce(json(200));
    await client.getJson('/x', {}, { apiKey: 'CG-call' });
    expect(calledHeaders(fetchImpl)).toEqual({ 'x-cg-demo-api-key': 'CG-call' });
  });

  it('sends no auth header when no key is configured', async () => {
    const { client, fetchImpl } = harness();
    fetchImpl.mockResolvedValueOnce(json(200));
    await client.getJson('/x');
    expect(calledHeaders(fetchImpl)).toEqual({});
  });

  it('uses the proxy when configured and never leaks the API key to it', async () => {
    const { client, fetchImpl } = harness({
      apiKey: 'CG-secret',
      proxyBaseUrl: 'https://proxy.test/cg/',
      proxyHeaders: { Authorization: 'Bearer anon' },
    });
    fetchImpl.mockResolvedValueOnce(json(200));

    await client.getJson('/coins/pax-gold/market_chart', { days: '7' }, { apiKey: 'CG-per-call' });

    expect(calledUrl(fetchImpl)).toBe('https://proxy.test/cg/coins/pax-gold/market_chart?days=7');
    expect(calledHeaders(fetchImpl)).toEqual({ Authorization: 'Bearer anon' });
    expect(JSON.stringify(fetchImpl.mock.calls)).not.toContain('CG-');
  });
});

describe('getJson — backoff', () => {
  it('retries a 429 with exponential backoff and then succeeds', async () => {
    const { client, fetchImpl, sleeps } = harness();
    fetchImpl
      .mockResolvedValueOnce(json(429))
      .mockResolvedValueOnce(json(429))
      .mockResolvedValueOnce(json(200, { done: true }));

    await expect(client.getJson('/x')).resolves.toEqual({ done: true });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleeps).toEqual([75, 150]); // 0.75 × (100, 200)
  });

  it('honours Retry-After when it is longer than the backoff', async () => {
    const { client, fetchImpl, sleeps } = harness();
    fetchImpl
      .mockResolvedValueOnce(json(429, {}, { 'retry-after': '3' }))
      .mockResolvedValueOnce(json(200));

    await client.getJson('/x');
    expect(sleeps).toEqual([3000]);
  });

  it('gives up after maxRetries and surfaces the status', async () => {
    const { client, fetchImpl, sleeps } = harness({ maxRetries: 2 });
    fetchImpl.mockImplementation(() => Promise.resolve(json(429)));

    const err = await client.getJson('/x').catch((e: unknown) => e);

    expect(err).toBeInstanceOf(CoinGeckoHttpError);
    expect((err as CoinGeckoHttpError).status).toBe(429);
    expect(fetchImpl).toHaveBeenCalledTimes(3); // 1 try + 2 retries
    expect(sleeps).toHaveLength(2);
  });

  it('fails fast instead of waiting out a very long Retry-After, and keeps later calls from hammering', async () => {
    const { client, fetchImpl, sleeps, advance } = harness();
    fetchImpl.mockResolvedValueOnce(json(429, {}, { 'retry-after': '120' }));

    const first = await client.getJson('/x').catch((e: unknown) => e);
    expect((first as CoinGeckoHttpError).status).toBe(429);
    expect((first as CoinGeckoHttpError).retryAfterMs).toBe(120_000);
    expect(sleeps).toEqual([]); // did not sit through 2 minutes

    // The cooldown is shared: the next request fails without touching the network.
    const second = await client.getJson('/y').catch((e: unknown) => e);
    expect((second as CoinGeckoHttpError).status).toBe(429);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    // Once the cooldown has passed, requests flow again.
    advance(121_000);
    fetchImpl.mockResolvedValueOnce(json(200, { back: true }));
    await expect(client.getJson('/z')).resolves.toEqual({ back: true });
  });

  it('makes a second request wait for a cooldown started by the first', async () => {
    const { client, fetchImpl, sleeps } = harness({ maxRetries: 0 });
    fetchImpl
      .mockResolvedValueOnce(json(429, {}, { 'retry-after': '3' }))
      .mockResolvedValueOnce(json(200, { ok: 1 }));

    await client.getJson('/a').catch(() => undefined);
    await expect(client.getJson('/b')).resolves.toEqual({ ok: 1 });

    expect(sleeps).toEqual([3000]); // /b parked behind the gate before fetching
  });

  it('retries a 5xx once, then gives up', async () => {
    const { client, fetchImpl } = harness();
    fetchImpl.mockImplementation(() => Promise.resolve(json(503)));
    const err = await client.getJson('/x').catch((e: unknown) => e);
    expect((err as CoinGeckoHttpError).status).toBe(503);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('recovers when the single 5xx retry succeeds', async () => {
    const { client, fetchImpl } = harness();
    fetchImpl.mockResolvedValueOnce(json(502)).mockResolvedValueOnce(json(200, { ok: 2 }));
    await expect(client.getJson('/x')).resolves.toEqual({ ok: 2 });
  });

  it('retries a thrown fetch (offline / blocked) once', async () => {
    const { client, fetchImpl } = harness();
    fetchImpl.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(json(200, { ok: 3 }));
    await expect(client.getJson('/x')).resolves.toEqual({ ok: 3 });

    fetchImpl.mockReset();
    fetchImpl.mockRejectedValue(new TypeError('Failed to fetch'));
    const err = await client.getJson('/x').catch((e: unknown) => e);
    expect((err as CoinGeckoHttpError).status).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each([400, 401, 403, 404])('does not retry a %i', async (status) => {
    const { client, fetchImpl } = harness();
    fetchImpl.mockResolvedValueOnce(json(status));
    const err = await client.getJson('/x').catch((e: unknown) => e);
    expect((err as CoinGeckoHttpError).status).toBe(status);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('reports an unparseable 200 as a failure instead of resolving garbage', async () => {
    const { client, fetchImpl } = harness();
    fetchImpl.mockResolvedValueOnce(new Response('<html>not json</html>', { status: 200 }));
    const err = await client.getJson('/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CoinGeckoHttpError);
    expect((err as CoinGeckoHttpError).status).toBe(0);
  });
});

describe('getJson — concurrency and abort', () => {
  it('never runs more than maxConcurrent requests at once', async () => {
    const { client, fetchImpl } = harness({ maxConcurrent: 2 });
    const releases: Array<() => void> = [];
    let active = 0;
    let peak = 0;
    fetchImpl.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          active += 1;
          peak = Math.max(peak, active);
          releases.push(() => {
            active -= 1;
            resolve(json(200));
          });
        }),
    );

    const all = Array.from({ length: 5 }, (_, i) => client.getJson('/x', { i: String(i) }));
    await tick();
    expect(releases).toHaveLength(2); // only two started

    while (releases.length > 0) {
      releases.shift()?.();
      await tick();
    }
    await Promise.all(all);

    expect(fetchImpl).toHaveBeenCalledTimes(5);
    expect(peak).toBe(2);
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const { client, fetchImpl } = harness();
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(client.getJson('/x', {}, { signal: ctrl.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('drops a queued request when its signal aborts, without disturbing the one in flight', async () => {
    const { client, fetchImpl } = harness({ maxConcurrent: 1 });
    let finishFirst!: () => void;
    fetchImpl.mockImplementationOnce(
      () => new Promise<Response>((resolve) => { finishFirst = () => resolve(json(200, { first: true })); }),
    );

    const first = client.getJson('/first');
    await tick();
    const ctrl = new AbortController();
    const queued = client.getJson('/queued', {}, { signal: ctrl.signal });
    await tick();
    ctrl.abort();

    await expect(queued).rejects.toMatchObject({ name: 'AbortError' });
    finishFirst();
    await expect(first).resolves.toEqual({ first: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('stops waiting between retries when aborted', async () => {
    const abortableSleep = (_ms: number, signal?: AbortSignal) =>
      new Promise<void>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new AbortError()), { once: true });
      });
    const { client, fetchImpl } = harness({ sleep: abortableSleep });
    fetchImpl.mockImplementation(() => Promise.resolve(json(429)));

    const ctrl = new AbortController();
    const pending = client.getJson('/x', {}, { signal: ctrl.signal });
    await tick();
    ctrl.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('getJson — real timers (default sleep)', () => {
  it('waits out the backoff on the real clock, then retries', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn<typeof fetch>();
      fetchImpl.mockResolvedValueOnce(json(429, {}, { 'retry-after': '2' })).mockResolvedValueOnce(json(200, { ok: 1 }));
      const client = createCoinGeckoClient({ fetchImpl }); // no injected sleep / clock

      const result = client.getJson('/x');
      await vi.advanceTimersByTimeAsync(1_900);
      expect(fetchImpl).toHaveBeenCalledTimes(1); // still parked behind Retry-After: 2
      await vi.advanceTimersByTimeAsync(200);

      await expect(result).resolves.toEqual({ ok: 1 });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels the wait when the caller aborts', async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn<typeof fetch>();
      fetchImpl.mockResolvedValue(json(429, {}, { 'retry-after': '5' }));
      const client = createCoinGeckoClient({ fetchImpl });
      const ctrl = new AbortController();

      const pending = client.getJson('/x', {}, { signal: ctrl.signal });
      const settled = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
      await vi.advanceTimersByTimeAsync(1_000);
      ctrl.abort();
      await settled;

      await vi.advanceTimersByTimeAsync(10_000);
      expect(fetchImpl).toHaveBeenCalledTimes(1); // never retried after the abort
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('getJson — proxy fallback', () => {
  const proxied = { proxyBaseUrl: 'https://proxy.test/cg', apiKey: 'CG-direct' };

  it('falls back to direct when the proxy is unreachable, then skips it for a while', async () => {
    const { client, fetchImpl, advance } = harness(proxied);
    fetchImpl
      .mockRejectedValueOnce(new TypeError('Failed to fetch')) // proxy: no response (not deployed / CORS)
      .mockResolvedValueOnce(json(200, { via: 'direct-1' }))
      .mockResolvedValueOnce(json(200, { via: 'direct-2' }));

    await expect(client.getJson('/x')).resolves.toEqual({ via: 'direct-1' });
    expect(calledUrl(fetchImpl, 0)).toMatch(/^https:\/\/proxy\.test\/cg\/x/);
    expect(calledUrl(fetchImpl, 1)).toMatch(/^https:\/\/api\.coingecko\.com\/api\/v3\/x/);
    expect(calledHeaders(fetchImpl, 1)).toEqual({ 'x-cg-demo-api-key': 'CG-direct' });
    expect(client.state().proxyDown).toBe(true);

    // While marked down, the proxy is not even attempted.
    await expect(client.getJson('/y')).resolves.toEqual({ via: 'direct-2' });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(calledUrl(fetchImpl, 2)).toMatch(/^https:\/\/api\.coingecko\.com/);

    // After the hold-off it is tried again.
    advance(5 * 60_000 + 1);
    expect(client.state().proxyDown).toBe(false);
    fetchImpl.mockResolvedValueOnce(json(200, { via: 'proxy-again' }));
    await expect(client.getJson('/z')).resolves.toEqual({ via: 'proxy-again' });
    expect(calledUrl(fetchImpl, 3)).toMatch(/^https:\/\/proxy\.test\/cg\/z/);
  });

  it.each([401, 403, 404])('falls back when a non-proxy host answers %i (e.g. function not deployed)', async (status) => {
    const { client, fetchImpl } = harness(proxied);
    fetchImpl.mockResolvedValueOnce(json(status)).mockResolvedValueOnce(json(200, { via: 'direct' }));
    await expect(client.getJson('/x')).resolves.toEqual({ via: 'direct' });
  });

  it('falls back when the proxy host serves a non-JSON 200 (misrouted to a static site)', async () => {
    const { client, fetchImpl } = harness(proxied);
    fetchImpl
      .mockResolvedValueOnce(new Response('<!doctype html>', { status: 200 }))
      .mockResolvedValueOnce(json(200, { via: 'direct' }));
    await expect(client.getJson('/x')).resolves.toEqual({ via: 'direct' });
  });

  it('does NOT fall back when our proxy answers 404 for a real reason', async () => {
    const { client, fetchImpl } = harness(proxied);
    fetchImpl.mockResolvedValueOnce(json(404, {}, { 'x-gt-proxy': '1' }));
    const err = await client.getJson('/x').catch((e: unknown) => e);
    expect((err as CoinGeckoHttpError).status).toBe(404);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(client.state().proxyDown).toBe(false);
  });

  it('does NOT fall back on a proxy 429 — direct would only add load', async () => {
    const { client, fetchImpl } = harness({ ...proxied, maxRetries: 0 });
    fetchImpl.mockResolvedValueOnce(json(429, {}, { 'retry-after': '30', 'x-gt-proxy': '1' }));
    const err = await client.getJson('/x').catch((e: unknown) => e);
    expect((err as CoinGeckoHttpError).status).toBe(429);
    expect((err as CoinGeckoHttpError).via).toBe('proxy');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does NOT fall back on a proxy 502 (upstream trouble), after one retry', async () => {
    const { client, fetchImpl } = harness(proxied);
    fetchImpl.mockImplementation(() => Promise.resolve(json(502, {}, { 'x-gt-proxy': '1' })));
    const err = await client.getJson('/x').catch((e: unknown) => e);
    expect((err as CoinGeckoHttpError).status).toBe(502);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls.map((c) => urlOf(c[0])).join(' ')).not.toContain('api.coingecko.com');
  });

  it('keeps separate cooldowns for proxy and direct', async () => {
    const { client, fetchImpl } = harness({ ...proxied, maxRetries: 0 });
    fetchImpl.mockResolvedValueOnce(json(429, {}, { 'retry-after': '120', 'x-gt-proxy': '1' }));
    await client.getJson('/x').catch(() => undefined);
    const { proxy, direct } = client.state().gateMsLeft;
    expect(proxy).toBe(120_000);
    expect(direct).toBe(0);
  });
});

describe('resolveCoinGeckoConfig', () => {
  const SUPA = 'https://abc.supabase.co';

  it('is direct-only with an empty environment', () => {
    expect(resolveCoinGeckoConfig({})).toEqual({ apiKey: undefined });
  });

  it('trims the key and treats blank as unset', () => {
    expect(resolveCoinGeckoConfig({ VITE_COINGECKO_API_KEY: '  CG-1 ' }).apiKey).toBe('CG-1');
    expect(resolveCoinGeckoConfig({ VITE_COINGECKO_API_KEY: '   ' }).apiKey).toBeUndefined();
  });

  it('defaults to the Supabase Edge Function when Supabase is configured', () => {
    const cfg = resolveCoinGeckoConfig({ VITE_SUPABASE_URL: `${SUPA}/`, VITE_SUPABASE_ANON_KEY: 'anon' });
    expect(cfg.proxyBaseUrl).toBe(`${SUPA}/functions/v1/coingecko-proxy`);
    expect(cfg.proxyHeaders).toEqual({ Authorization: 'Bearer anon', apikey: 'anon' });
  });

  it('stays direct when only half of the Supabase config is present', () => {
    expect(resolveCoinGeckoConfig({ VITE_SUPABASE_URL: SUPA }).proxyBaseUrl).toBeUndefined();
    expect(resolveCoinGeckoConfig({ VITE_SUPABASE_ANON_KEY: 'anon' }).proxyBaseUrl).toBeUndefined();
  });

  it('uses an explicit proxy URL without sending the Supabase JWT to a third party', () => {
    const cfg = resolveCoinGeckoConfig({
      VITE_COINGECKO_PROXY_URL: 'https://cg.example.workers.dev/',
      VITE_SUPABASE_URL: SUPA,
      VITE_SUPABASE_ANON_KEY: 'anon',
    });
    expect(cfg.proxyBaseUrl).toBe('https://cg.example.workers.dev');
    expect(cfg.proxyHeaders).toBeUndefined();
  });

  it('sends the Supabase JWT when the explicit proxy is on the Supabase origin', () => {
    const cfg = resolveCoinGeckoConfig({
      VITE_COINGECKO_PROXY_URL: `${SUPA}/functions/v1/my-proxy`,
      VITE_SUPABASE_URL: SUPA,
      VITE_SUPABASE_ANON_KEY: 'anon',
    });
    expect(cfg.proxyHeaders).toEqual({ Authorization: 'Bearer anon', apikey: 'anon' });
  });

  it('does not treat a look-alike host as the Supabase origin', () => {
    const cfg = resolveCoinGeckoConfig({
      VITE_COINGECKO_PROXY_URL: 'https://abc.supabase.co.evil.example/x',
      VITE_SUPABASE_URL: SUPA,
      VITE_SUPABASE_ANON_KEY: 'anon',
    });
    expect(cfg.proxyHeaders).toBeUndefined();
  });

  it.each(['direct', 'DIRECT', ' Direct '])('"%s" bypasses the proxy even when Supabase is configured', (value) => {
    const cfg = resolveCoinGeckoConfig({
      VITE_COINGECKO_PROXY_URL: value,
      VITE_SUPABASE_URL: SUPA,
      VITE_SUPABASE_ANON_KEY: 'anon',
      VITE_COINGECKO_API_KEY: 'CG-dev',
    });
    expect(cfg.proxyBaseUrl).toBeUndefined();
    expect(cfg.apiKey).toBe('CG-dev');
  });
});
