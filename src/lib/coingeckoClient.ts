/**
 * Single choke point for every CoinGecko request the app makes.
 *
 * Problems this solves (see the "CORS / ERR_FAILED" production report):
 *  - A dozen panels fire CoinGecko calls at once from the visitor's IP and trip
 *    the public rate limit; the rejection reaches the browser as an opaque CORS
 *    failure with no status and no `Retry-After`.
 *  - Nothing retried or backed off, so one 429 became mock data for the session.
 *  - The demo API key had to ship in the bundle (`VITE_COINGECKO_API_KEY`).
 *
 * What it does:
 *  - Routes through a server-side proxy (the `coingecko-proxy` Edge Function by
 *    default when Supabase is configured, or any CoinGecko-shaped URL via
 *    `VITE_COINGECKO_PROXY_URL`). The key then lives on the server.
 *  - Caps concurrent requests, retries 429 / 5xx / network errors with
 *    exponential backoff + jitter, and honours `Retry-After`.
 *  - A shared cooldown gate: after a 429 every queued request waits instead of
 *    hammering an endpoint that just said "slow down".
 *  - If the proxy is unreachable (not deployed, misrouted, blocked) it falls
 *    back to direct CoinGecko and stops trying the proxy for a few minutes. It
 *    does *not* fall back on 429/5xx, which would only add load.
 *
 * Pure: `fetch`, clock, sleep and RNG are injectable, so it is unit-tested
 * without a network or fake timers. No React imports.
 */

import { recordObservabilityEvent } from './observability';

export const COINGECKO_DIRECT_BASE = 'https://api.coingecko.com/api/v3';
export const COINGECKO_PROXY_FUNCTION = 'coingecko-proxy';

type Via = 'proxy' | 'direct';

export interface CoinGeckoClientConfig {
  /** Upstream API root. Used for direct mode and as the proxy fallback. */
  directBaseUrl?: string;
  /** CoinGecko-shaped proxy root (no trailing slash). Omit for direct-only. */
  proxyBaseUrl?: string;
  /** Extra headers sent to the proxy only (e.g. the Supabase anon JWT). */
  proxyHeaders?: Record<string, string>;
  /** Demo key for DIRECT requests only. Never sent to the proxy. */
  apiKey?: string;
  /** Max simultaneous in-flight requests (default 3). */
  maxConcurrent?: number;
  /** Retries after a 429 (default 3). Other retryable failures retry once. */
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Longest wait (Retry-After / cooldown) tolerated before failing fast. */
  maxWaitMs?: number;
  /** How long to skip a proxy that proved unreachable (default 5 min). */
  proxyDownMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  random?: () => number;
  now?: () => number;
}

export interface GetJsonOptions {
  signal?: AbortSignal;
  /** Overrides the configured key for the direct path (tests / explicit callers). */
  apiKey?: string;
}

export class AbortError extends Error {
  constructor() {
    super('The operation was aborted');
    this.name = 'AbortError';
  }
}

export class CoinGeckoHttpError extends Error {
  /** HTTP status, or 0 for network failure / unusable response. */
  readonly status: number;
  readonly via: Via;
  readonly retryAfterMs?: number;
  /** True when our proxy produced this response (it tags every reply). */
  readonly proxyReplied: boolean;

  constructor(
    message: string,
    init: { status: number; via: Via; retryAfterMs?: number; proxyReplied?: boolean },
  ) {
    super(message);
    this.name = 'CoinGeckoHttpError';
    this.status = init.status;
    this.via = init.via;
    this.retryAfterMs = init.retryAfterMs;
    this.proxyReplied = init.proxyReplied ?? false;
  }
}

export interface CoinGeckoClient {
  getJson: <T>(
    path: string,
    params?: Record<string, string | undefined>,
    opts?: GetJsonOptions,
  ) => Promise<T>;
  /** Introspection for diagnostics and tests. */
  state: () => { proxyConfigured: boolean; proxyDown: boolean; gateMsLeft: Record<Via, number> };
}

const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

/** `Retry-After` is either delta-seconds or an HTTP date. */
export function parseRetryAfterMs(value: string | null | undefined, nowMs: number): number | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(raw);
  return Number.isNaN(at) ? undefined : Math.max(0, at - nowMs);
}

/** Exponential backoff with "equal jitter": half fixed, half random. */
export function computeBackoffMs(
  attempt: number,
  baseMs: number,
  maxMs: number,
  random: () => number,
): number {
  const ceiling = Math.min(maxMs, baseMs * 2 ** attempt);
  return ceiling / 2 + random() * (ceiling / 2);
}

const defaultSleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortError());
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new AbortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

/** FIFO semaphore whose queued waiters can be cancelled by an AbortSignal. */
function createLimiter(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const release = (): void => {
    active -= 1;
    const next = queue.shift();
    if (next) next();
  };

  const acquire = (signal?: AbortSignal): Promise<() => void> => {
    if (signal?.aborted) return Promise.reject(new AbortError());
    if (active < max) {
      active += 1;
      return Promise.resolve(release);
    }
    return new Promise<() => void>((resolve, reject) => {
      const waiter = (): void => {
        signal?.removeEventListener('abort', onAbort);
        active += 1;
        resolve(release);
      };
      const onAbort = (): void => {
        const i = queue.indexOf(waiter);
        if (i >= 0) queue.splice(i, 1);
        reject(new AbortError());
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      queue.push(waiter);
    });
  };

  return { acquire };
}

function buildQuery(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') qs.set(key, value);
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}

/** The proxy is "unavailable" (vs. merely unhappy) when it never answered as itself. */
function isProxyUnavailable(err: CoinGeckoHttpError): boolean {
  if (err.status === 0) return true;
  return !err.proxyReplied && (err.status === 401 || err.status === 403 || err.status === 404);
}

export function createCoinGeckoClient(config: CoinGeckoClientConfig = {}): CoinGeckoClient {
  const directBase = (config.directBaseUrl ?? COINGECKO_DIRECT_BASE).replace(/\/+$/, '');
  const proxyBase = config.proxyBaseUrl?.replace(/\/+$/, '');
  const maxRetries = config.maxRetries ?? 3;
  const baseDelayMs = config.baseDelayMs ?? 500;
  const maxDelayMs = config.maxDelayMs ?? 8_000;
  const maxWaitMs = config.maxWaitMs ?? 20_000;
  const proxyDownMs = config.proxyDownMs ?? 5 * 60_000;
  const sleep = config.sleep ?? defaultSleep;
  const random = config.random ?? Math.random;
  const now = config.now ?? (() => Date.now());
  const doFetch: typeof fetch = config.fetchImpl ?? ((input, init) => fetch(input, init));

  const limiter = createLimiter(Math.max(1, config.maxConcurrent ?? 3));
  const gateUntil: Record<Via, number> = { proxy: 0, direct: 0 };
  let proxyDownUntil = 0;

  const note = (action: string, detail: string, meta?: Record<string, unknown>): void => {
    // ok:false keeps these out of "last successful price fetch" health logic.
    recordObservabilityEvent({
      kind: 'price_fetch',
      severity: 'warn',
      ok: false,
      source: 'coingecko-client',
      action,
      detail,
      meta,
    });
  };

  /** Park behind the shared cooldown, or fail fast if it is too long to wait out. */
  const waitForGate = async (via: Via, signal?: AbortSignal): Promise<void> => {
    const wait = gateUntil[via] - now();
    if (wait <= 0) return;
    if (wait > maxWaitMs) {
      throw new CoinGeckoHttpError('CoinGecko rate-limit cooldown in effect', {
        status: 429,
        via,
        retryAfterMs: wait,
      });
    }
    await sleep(wait, signal);
  };

  const send = async <T>(
    via: Via,
    url: string,
    headers: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<T> => {
    for (let attempt = 0; ; attempt += 1) {
      await waitForGate(via, signal);

      let res: Response | null = null;
      const release = await limiter.acquire(signal);
      try {
        res = await doFetch(url, { headers, signal });
      } catch (err) {
        if (isAbortError(err)) throw err;
        // A thrown fetch is a network failure or a CORS rejection — same to us.
      } finally {
        release();
      }

      if (res?.ok) {
        try {
          return (await res.json()) as T;
        } catch {
          throw new CoinGeckoHttpError('Response was not valid JSON', {
            status: 0,
            via,
            proxyReplied: res.headers.get('x-gt-proxy') === '1',
          });
        }
      }

      const status = res?.status ?? 0;
      const retryAfterMs = res ? parseRetryAfterMs(res.headers.get('retry-after'), now()) : undefined;
      const error = new CoinGeckoHttpError(
        status === 0 ? 'Network error (offline, blocked or CORS)' : `CoinGecko HTTP ${status}`,
        {
          status,
          via,
          retryAfterMs,
          proxyReplied: res?.headers.get('x-gt-proxy') === '1',
        },
      );

      const retryable = status === 0 || RETRYABLE_STATUS.has(status);
      // 429s get the full backoff budget. Other transient failures retry once —
      // except a no-response proxy, which is unreachable rather than flaky, so
      // we go straight to the direct fallback instead of waiting.
      const budget = status === 429 ? maxRetries : status === 0 && via === 'proxy' ? 0 : 1;
      const backoff = computeBackoffMs(attempt, baseDelayMs, maxDelayMs, random);
      const delay = Math.max(retryAfterMs ?? 0, backoff);

      if (status === 429) {
        // Tell every other queued request to hold off too.
        gateUntil[via] = Math.max(gateUntil[via], now() + delay);
      }

      if (!retryable || attempt >= budget || delay > maxWaitMs) throw error;

      note('retry', `CoinGecko ${via} ${status === 0 ? 'network error' : `HTTP ${status}`}; retry ${attempt + 1} in ${Math.round(delay)}ms`, {
        via,
        status,
        attempt: attempt + 1,
        delayMs: Math.round(delay),
      });
      await sleep(delay, signal);
    }
  };

  const getJson: CoinGeckoClient['getJson'] = async <T>(
    path: string,
    params: Record<string, string | undefined> = {},
    opts: GetJsonOptions = {},
  ): Promise<T> => {
    const qs = buildQuery(params);

    if (proxyBase && now() >= proxyDownUntil) {
      try {
        return await send<T>('proxy', `${proxyBase}${path}${qs}`, config.proxyHeaders ?? {}, opts.signal);
      } catch (err) {
        if (!(err instanceof CoinGeckoHttpError) || !isProxyUnavailable(err)) throw err;
        proxyDownUntil = now() + proxyDownMs;
        note(
          'proxy_fallback',
          `CoinGecko proxy unreachable (${err.status === 0 ? 'no response' : `HTTP ${err.status}`}); using direct for ${Math.round(proxyDownMs / 60_000)} min`,
          { status: err.status },
        );
      }
    }

    const key = opts.apiKey ?? config.apiKey;
    const headers: Record<string, string> = key ? { 'x-cg-demo-api-key': key } : {};
    return send<T>('direct', `${directBase}${path}${qs}`, headers, opts.signal);
  };

  return {
    getJson,
    state: () => ({
      proxyConfigured: Boolean(proxyBase),
      proxyDown: now() < proxyDownUntil,
      gateMsLeft: {
        proxy: Math.max(0, gateUntil.proxy - now()),
        direct: Math.max(0, gateUntil.direct - now()),
      },
    }),
  };
}

// ---------------------------------------------------------------------------
// Environment wiring
// ---------------------------------------------------------------------------

export interface CoinGeckoEnv {
  VITE_COINGECKO_API_KEY?: string;
  VITE_COINGECKO_PROXY_URL?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

/**
 * Decide how this build talks to CoinGecko:
 *  1. `VITE_COINGECKO_PROXY_URL=direct`  → straight to CoinGecko (dev/offline).
 *  2. `VITE_COINGECKO_PROXY_URL=<url>`   → that proxy (e.g. a Cloudflare Worker).
 *  3. Supabase configured                → its `coingecko-proxy` Edge Function.
 *  4. otherwise                          → direct.
 *
 * The Supabase anon JWT is attached only when the proxy lives on the Supabase
 * origin — it is never sent to a third-party proxy.
 */
export function resolveCoinGeckoConfig(env: CoinGeckoEnv): CoinGeckoClientConfig {
  const apiKey = env.VITE_COINGECKO_API_KEY?.trim() || undefined;
  const explicit = env.VITE_COINGECKO_PROXY_URL?.trim();
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '');
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();
  const supabaseHeaders =
    anonKey ? { Authorization: `Bearer ${anonKey}`, apikey: anonKey } : undefined;

  if (explicit?.toLowerCase() === 'direct') return { apiKey };

  if (explicit) {
    const proxyBaseUrl = explicit.replace(/\/+$/, '');
    const onSupabase = Boolean(supabaseUrl) && proxyBaseUrl.startsWith(`${supabaseUrl}/`);
    return { apiKey, proxyBaseUrl, proxyHeaders: onSupabase ? supabaseHeaders : undefined };
  }

  if (supabaseUrl && anonKey) {
    return {
      apiKey,
      proxyBaseUrl: `${supabaseUrl}/functions/v1/${COINGECKO_PROXY_FUNCTION}`,
      proxyHeaders: supabaseHeaders,
    };
  }

  return { apiKey };
}

let defaultClient: CoinGeckoClient | null = null;

/** App-wide client built from `import.meta.env` (one shared gate + limiter). */
export function getCoinGeckoClient(): CoinGeckoClient {
  defaultClient ??= createCoinGeckoClient(resolveCoinGeckoConfig(import.meta.env));
  return defaultClient;
}

/** Drop the shared client so the next call rebuilds it (tests only). */
export function resetCoinGeckoClient(): void {
  defaultClient = null;
}
