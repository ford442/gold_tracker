/**
 * Pure CoinGecko proxy logic, shared by the `coingecko-proxy` Supabase Edge
 * Function (Deno) and the Vitest suite (Node).
 *
 * Why a proxy: browsers calling `api.coingecko.com` directly share CoinGecko's
 * tight per-IP rate limit, and a rejected request surfaces in the console as an
 * opaque CORS / `ERR_FAILED` failure (no readable status, no `Retry-After`).
 * Routing through a server we control gives us:
 *  - one upstream key kept off the client,
 *  - a shared cache + in-flight de-dupe across every visitor,
 *  - stale-on-error so a rate-limited upstream does not blank the charts,
 *  - CORS headers (and a readable status) on every response, errors included.
 *
 * No Deno / DOM / Node globals here — only language built-ins — so the same
 * file runs everywhere. `index.ts` in the Edge Function owns the I/O.
 */

export const COINGECKO_UPSTREAM_BASE = 'https://api.coingecko.com/api/v3';

/**
 * Coin ids the proxy will fetch. A closed list stops the endpoint being used as
 * an open relay (or to burn the upstream quota with arbitrary ids). A unit test
 * asserts every `cgId` in `src/lib/assets.ts` is listed here — add new assets to
 * both.
 */
export const ALLOWED_COIN_IDS: readonly string[] = [
  'pax-gold',
  'tether-gold',
  'bitcoin',
  'ethereum',
  'bitcoin-cash',
  'usd-coin',
];

export type ProxyRouteKind = 'markets' | 'market_chart';

export interface ProxyRoute {
  kind: ProxyRouteKind;
  /** Path on the upstream API, e.g. `/coins/pax-gold/market_chart`. */
  upstreamPath: string;
  /** Canonical (sorted) query string without the leading `?`. */
  query: string;
  /** Identical for equivalent requests, so param order cannot bust the cache. */
  cacheKey: string;
  /** How long a cached response is served without re-asking upstream. */
  ttlMs: number;
}

export type ParseResult =
  | { ok: true; route: ProxyRoute }
  | { ok: false; status: 400 | 404; error: string };

const MARKETS_TTL_MS = 60_000;
const CHART_TTL_SHORT_MS = 5 * 60_000; //  days <= 1
const CHART_TTL_MED_MS = 10 * 60_000; //   days <= 30
const CHART_TTL_LONG_MS = 30 * 60_000; //  days > 30 or max

const PRICE_CHANGE_WINDOWS = new Set(['1h', '24h', '7d', '14d', '30d', '200d', '1y']);
const MAX_MARKET_IDS = 25;
const MAX_DAYS = 365;

function bad(error: string): ParseResult {
  return { ok: false, status: 400, error };
}

function isAllowedCoinId(id: string): boolean {
  return ALLOWED_COIN_IDS.includes(id);
}

function rejectUnknownParams(params: URLSearchParams, allowed: readonly string[]): string | null {
  for (const key of params.keys()) {
    if (!allowed.includes(key)) return `Unsupported query parameter: ${key}`;
  }
  return null;
}

function canonicalQuery(entries: Array<[string, string]>): string {
  return entries
    .slice()
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
}

function parseMarkets(params: URLSearchParams): ParseResult {
  const unknown = rejectUnknownParams(params, ['vs_currency', 'ids', 'sparkline', 'price_change_percentage']);
  if (unknown) return bad(unknown);

  const vs = params.get('vs_currency') ?? 'usd';
  if (vs !== 'usd') return bad('vs_currency must be "usd"');

  const rawIds = (params.get('ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (rawIds.length === 0) return bad('ids is required');
  if (rawIds.length > MAX_MARKET_IDS) return bad(`ids accepts at most ${MAX_MARKET_IDS} coins`);
  const ids = [...new Set(rawIds)].sort();
  const disallowed = ids.find((id) => !isAllowedCoinId(id));
  if (disallowed) return bad(`Coin id not allowed: ${disallowed}`);

  const sparkline = params.get('sparkline') ?? 'false';
  if (sparkline !== 'true' && sparkline !== 'false') return bad('sparkline must be "true" or "false"');

  const entries: Array<[string, string]> = [
    ['vs_currency', vs],
    ['ids', ids.join(',')],
    ['sparkline', sparkline],
  ];

  const pcp = params.get('price_change_percentage');
  if (pcp) {
    const windows = [...new Set(pcp.split(',').map((s) => s.trim()).filter(Boolean))].sort();
    if (windows.length === 0 || windows.some((w) => !PRICE_CHANGE_WINDOWS.has(w))) {
      return bad('price_change_percentage has an unsupported window');
    }
    entries.push(['price_change_percentage', windows.join(',')]);
  }

  const query = canonicalQuery(entries);
  return {
    ok: true,
    route: {
      kind: 'markets',
      upstreamPath: '/coins/markets',
      query,
      cacheKey: `markets?${query}`,
      ttlMs: MARKETS_TTL_MS,
    },
  };
}

function chartTtlMs(days: string): number {
  if (days === 'max') return CHART_TTL_LONG_MS;
  const n = Number(days);
  if (n <= 1) return CHART_TTL_SHORT_MS;
  if (n <= 30) return CHART_TTL_MED_MS;
  return CHART_TTL_LONG_MS;
}

function parseMarketChart(coinId: string, params: URLSearchParams): ParseResult {
  if (!isAllowedCoinId(coinId)) return bad(`Coin id not allowed: ${coinId}`);

  const unknown = rejectUnknownParams(params, ['vs_currency', 'days', 'interval']);
  if (unknown) return bad(unknown);

  const vs = params.get('vs_currency') ?? 'usd';
  if (vs !== 'usd') return bad('vs_currency must be "usd"');

  const days = params.get('days');
  if (!days) return bad('days is required');
  if (days !== 'max') {
    if (!/^[1-9]\d{0,2}$/.test(days) || Number(days) > MAX_DAYS) {
      return bad(`days must be "max" or an integer between 1 and ${MAX_DAYS}`);
    }
  }

  const entries: Array<[string, string]> = [
    ['vs_currency', vs],
    ['days', days],
  ];

  const interval = params.get('interval');
  if (interval) {
    if (interval !== 'daily' && interval !== 'hourly') return bad('interval must be "daily" or "hourly"');
    entries.push(['interval', interval]);
  }

  const query = canonicalQuery(entries);
  return {
    ok: true,
    route: {
      kind: 'market_chart',
      upstreamPath: `/coins/${coinId}/market_chart`,
      query,
      cacheKey: `chart:${coinId}?${query}`,
      ttlMs: chartTtlMs(days),
    },
  };
}

/**
 * Validate a proxy request and turn it into a canonical route.
 *
 * `pathname` may or may not include the function mount prefix
 * (`/functions/v1/coingecko-proxy`, `/coingecko-proxy`, or nothing) — only the
 * CoinGecko-shaped tail starting at `/coins/` is used, so the same client works
 * against a Supabase function, a Cloudflare Worker or a plain reverse proxy.
 */
export function parseProxyRequest(pathname: string, params: URLSearchParams): ParseResult {
  const idx = pathname.indexOf('/coins/');
  if (idx < 0) return { ok: false, status: 404, error: 'Unknown route' };

  const tail = pathname.slice(idx).replace(/\/+$/, '');
  if (tail === '/coins/markets') return parseMarkets(params);

  const chart = /^\/coins\/([^/]+)\/market_chart$/.exec(tail);
  if (chart) return parseMarketChart(chart[1], params);

  return { ok: false, status: 404, error: 'Unknown route' };
}

export function buildUpstreamUrl(route: ProxyRoute, base: string = COINGECKO_UPSTREAM_BASE): string {
  return `${base}${route.upstreamPath}?${route.query}`;
}

// ---------------------------------------------------------------------------
// Cache + upstream orchestration
// ---------------------------------------------------------------------------

/** What an upstream fetch produced. `status: 0` means a network error or timeout. */
export interface UpstreamResult {
  status: number;
  body: string;
  retryAfterSec?: number;
}

export type UpstreamFetcher = (route: ProxyRoute) => Promise<UpstreamResult>;

export type CacheDisposition = 'HIT' | 'MISS' | 'STALE' | 'NONE';

export interface ProxyOutcome {
  status: number;
  body: string;
  cache: CacheDisposition;
  /** Present on 429s so clients can back off for the right amount of time. */
  retryAfterSec?: number;
  /** Seconds the browser may reuse this response (0 → `no-store`). */
  maxAgeSec: number;
}

export interface ProxyEngineOptions {
  now?: () => number;
  /** Cap on cached series (oldest evicted first). */
  maxEntries?: number;
  /** How long a past success may be served when upstream is failing. */
  staleMaxAgeMs?: number;
  /** Default upstream cooldown after a 429 with no `Retry-After`. */
  defaultCooldownMs?: number;
}

interface CacheEntry {
  body: string;
  fetchedAt: number;
}

const DEFAULT_MAX_ENTRIES = 200;
const DEFAULT_STALE_MAX_AGE_MS = 24 * 60 * 60_000;
const DEFAULT_COOLDOWN_MS = 60_000;
const MIN_COOLDOWN_MS = 5_000;
const MAX_COOLDOWN_MS = 5 * 60_000;
const BROWSER_MAX_AGE_SEC = 20;

/** Guard against caching an HTML challenge page that came back as HTTP 200. */
function isValidPayload(kind: ProxyRouteKind, body: string): boolean {
  try {
    const parsed: unknown = JSON.parse(body);
    if (kind === 'markets') return Array.isArray(parsed) && parsed.length > 0;
    const prices = (parsed as { prices?: unknown } | null)?.prices;
    return Array.isArray(prices) && prices.length > 0;
  } catch {
    return false;
  }
}

function errorBody(error: string, upstreamStatus: number): string {
  return JSON.stringify({ error, upstreamStatus });
}

export interface ProxyEngine {
  handle: (route: ProxyRoute, fetchUpstream: UpstreamFetcher) => Promise<ProxyOutcome>;
  stats: () => { entries: number; inFlight: number; cooldownUntil: number };
}

/**
 * Stateful (per Edge isolate) cache in front of CoinGecko:
 *  - fresh hits never touch upstream,
 *  - concurrent identical misses share one upstream call,
 *  - a 429 starts a cooldown during which upstream is left alone,
 *  - when upstream fails, the last good copy (≤ `staleMaxAgeMs`) is served instead,
 *  - failures and malformed payloads are never cached.
 */
export function createProxyEngine(options: ProxyEngineOptions = {}): ProxyEngine {
  const now = options.now ?? (() => Date.now());
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const staleMaxAgeMs = options.staleMaxAgeMs ?? DEFAULT_STALE_MAX_AGE_MS;
  const defaultCooldownMs = options.defaultCooldownMs ?? DEFAULT_COOLDOWN_MS;

  const entries = new Map<string, CacheEntry>();
  const inFlight = new Map<string, Promise<UpstreamResult>>();
  let cooldownUntil = 0;

  const remember = (key: string, body: string): void => {
    entries.delete(key); // re-insert so Map order tracks recency
    entries.set(key, { body, fetchedAt: now() });
    while (entries.size > maxEntries) {
      const oldest = entries.keys().next();
      if (oldest.done) break;
      entries.delete(oldest.value);
    }
  };

  const failure = (route: ProxyRoute, upstreamStatus: number, retryAfterSec?: number): ProxyOutcome => {
    const stale = entries.get(route.cacheKey);
    if (stale && now() - stale.fetchedAt < staleMaxAgeMs) {
      return { status: 200, body: stale.body, cache: 'STALE', maxAgeSec: 0 };
    }
    if (upstreamStatus === 429) {
      return {
        status: 429,
        body: errorBody('CoinGecko rate limit reached — retry shortly', 429),
        cache: 'NONE',
        retryAfterSec: retryAfterSec ?? Math.ceil(defaultCooldownMs / 1000),
        maxAgeSec: 0,
      };
    }
    if (upstreamStatus === 404) {
      return { status: 404, body: errorBody('Not found upstream', 404), cache: 'NONE', maxAgeSec: 0 };
    }
    return {
      status: 502,
      body: errorBody('CoinGecko upstream unavailable', upstreamStatus),
      cache: 'NONE',
      maxAgeSec: 0,
    };
  };

  const handle: ProxyEngine['handle'] = async (route, fetchUpstream) => {
    const fresh = entries.get(route.cacheKey);
    if (fresh && now() - fresh.fetchedAt < route.ttlMs) {
      return { status: 200, body: fresh.body, cache: 'HIT', maxAgeSec: BROWSER_MAX_AGE_SEC };
    }

    const cooldownLeftMs = cooldownUntil - now();
    if (cooldownLeftMs > 0) {
      return failure(route, 429, Math.ceil(cooldownLeftMs / 1000));
    }

    let pending = inFlight.get(route.cacheKey);
    if (!pending) {
      const run = async (): Promise<UpstreamResult> => {
        try {
          return await fetchUpstream(route);
        } catch {
          return { status: 0, body: '' };
        } finally {
          inFlight.delete(route.cacheKey);
        }
      };
      pending = run();
      inFlight.set(route.cacheKey, pending);
    }
    const result = await pending;

    if (result.status === 200 && isValidPayload(route.kind, result.body)) {
      remember(route.cacheKey, result.body);
      return { status: 200, body: result.body, cache: 'MISS', maxAgeSec: BROWSER_MAX_AGE_SEC };
    }

    if (result.status === 429) {
      const wantedMs = result.retryAfterSec !== undefined ? result.retryAfterSec * 1000 : defaultCooldownMs;
      const cooldownMs = Math.min(MAX_COOLDOWN_MS, Math.max(MIN_COOLDOWN_MS, wantedMs));
      cooldownUntil = Math.max(cooldownUntil, now() + cooldownMs);
      return failure(route, 429, Math.ceil(cooldownMs / 1000));
    }

    return failure(route, result.status);
  };

  return {
    handle,
    stats: () => ({ entries: entries.size, inFlight: inFlight.size, cooldownUntil }),
  };
}
