/**
 * Price transport layer — polling + public exchange WebSockets (issue #38).
 *
 * Pure helpers (coalescer, backoff, parsers) are unit-tested with injectable
 * timers / WebSocket. React hooks wire transports into priceStore.
 */

import type { AssetId } from './assets';
import { DASHBOARD_PRICE_ASSET_IDS } from './assets';

export type PriceTransportMode = 'auto' | 'poll' | 'stream';
export type TransportKind = 'poll' | 'stream' | 'offline' | 'mock';
export type TransportConnectionStatus =
  | 'idle'
  | 'connected'
  | 'reconnecting'
  | 'fallback'
  | 'offline';

export interface TransportStatus {
  kind: TransportKind;
  connection: TransportConnectionStatus;
  mode: PriceTransportMode;
}

export interface PriceTick {
  assetId: AssetId;
  price: number;
  ts: number;
  source: 'coinbase' | 'kraken';
}

export interface PriceTransport {
  subscribe(symbols: readonly AssetId[]): {
    unsubscribe(): void;
    onTick(cb: (tick: PriceTick) => void): () => void;
  };
  getStatus(): TransportStatus;
  start(): void;
  stop(): void;
}

export const COINBASE_WS_URL = 'wss://advanced-trade-ws.coinbase.com';
export const KRAKEN_WS_URL = 'wss://ws.kraken.com/v2';

const DEFAULT_POLL_MS = 60_000;
const DEFAULT_COALESCE_MS = 250;
const DEFAULT_BACKOFF_BASE_MS = 1_000;
const DEFAULT_BACKOFF_MAX_MS = 30_000;
const AUTO_FALLBACK_FAILURES = 3;
const STREAM_SILENCE_MS = 30_000;

const COINBASE_PRODUCT_TO_ASSET: Record<string, AssetId> = {
  'PAXG-USD': 'pax-gold',
  'XAUT-USD': 'tether-gold',
  'BTC-USD': 'bitcoin',
  'ETH-USD': 'ethereum',
  'BCH-USD': 'bitcoin-cash',
};

const KRAKEN_SYMBOL_TO_ASSET: Record<string, AssetId> = {
  'PAXG/USD': 'pax-gold',
  'XAUT/USD': 'tether-gold',
  'BTC/USD': 'bitcoin',
  'ETH/USD': 'ethereum',
};

export function coinbaseProductsForAssets(symbols: readonly AssetId[]): string[] {
  const products: string[] = [];
  for (const assetId of symbols) {
    const product = assetId === 'pax-gold' ? 'PAXG-USD'
      : assetId === 'tether-gold' ? 'XAUT-USD'
      : assetId === 'bitcoin' ? 'BTC-USD'
      : assetId === 'ethereum' ? 'ETH-USD'
      : assetId === 'bitcoin-cash' ? 'BCH-USD'
      : null;
    if (product) products.push(product);
  }
  return products.length > 0 ? products : Object.keys(COINBASE_PRODUCT_TO_ASSET);
}

export function krakenSymbolsForAssets(symbols: readonly AssetId[]): string[] {
  const out: string[] = [];
  for (const assetId of symbols) {
    const sym = assetId === 'pax-gold' ? 'PAXG/USD'
      : assetId === 'tether-gold' ? 'XAUT/USD'
      : assetId === 'bitcoin' ? 'BTC/USD'
      : assetId === 'ethereum' ? 'ETH/USD'
      : null;
    if (sym) out.push(sym);
  }
  return out;
}

export function nextBackoffDelay(
  attempt: number,
  baseMs = DEFAULT_BACKOFF_BASE_MS,
  maxMs = DEFAULT_BACKOFF_MAX_MS,
  jitter = 0.1,
): number {
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt));
  const jitterAmt = exp * jitter * (Math.random() * 2 - 1);
  return Math.max(baseMs, Math.round(exp + jitterAmt));
}

export interface TickCoalescer {
  push(tick: PriceTick): void;
  flush(): void;
  dispose(): void;
}

export function createTickCoalescer(
  flushMs: number,
  onFlush: (ticks: PriceTick[]) => void,
  schedule: (fn: () => void, ms: number) => ReturnType<typeof setTimeout> = setTimeout,
  clear: (id: ReturnType<typeof setTimeout>) => void = clearTimeout,
): TickCoalescer {
  const pending = new Map<AssetId, PriceTick>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    if (pending.size === 0) return;
    const batch = [...pending.values()];
    pending.clear();
    onFlush(batch);
  };

  return {
    push(tick: PriceTick) {
      pending.set(tick.assetId, tick);
      if (timer == null) timer = schedule(flush, flushMs);
    },
    flush,
    dispose() {
      if (timer != null) clear(timer);
      timer = null;
      pending.clear();
    },
  };
}

export function ticksToPricePatches(
  ticks: PriceTick[],
): Record<string, { price: number }> {
  const patches: Record<string, { price: number }> = {};
  for (const t of ticks) {
    if (Number.isFinite(t.price) && t.price > 0) {
      patches[t.assetId] = { price: t.price };
    }
  }
  return patches;
}

export function parseCoinbaseTickerBatch(raw: string): PriceTick[] {
  try {
    const msg = JSON.parse(raw) as {
      channel?: string;
      events?: Array<{
        tickers?: Array<{ product_id?: string; price?: string }>;
      }>;
    };
    if (msg.channel !== 'ticker_batch' && msg.channel !== 'ticker') return [];
    const ticks: PriceTick[] = [];
    const ts = Date.now();
    for (const event of msg.events ?? []) {
      for (const ticker of event.tickers ?? []) {
        const assetId = ticker.product_id
          ? COINBASE_PRODUCT_TO_ASSET[ticker.product_id]
          : undefined;
        const price = ticker.price != null ? Number(ticker.price) : NaN;
        if (assetId && Number.isFinite(price) && price > 0) {
          ticks.push({ assetId, price, ts, source: 'coinbase' });
        }
      }
    }
    return ticks;
  } catch {
    return [];
  }
}

export function parseKrakenTickerV2(raw: string): PriceTick[] {
  try {
    const msg = JSON.parse(raw) as {
      channel?: string;
      data?: Array<{ symbol?: string; last?: number; price?: number }>;
    };
    if (msg.channel !== 'ticker') return [];
    const ticks: PriceTick[] = [];
    const ts = Date.now();
    for (const row of msg.data ?? []) {
      const assetId = row.symbol ? KRAKEN_SYMBOL_TO_ASSET[row.symbol] : undefined;
      const price = row.last ?? row.price ?? NaN;
      if (assetId && Number.isFinite(price) && price > 0) {
        ticks.push({ assetId, price, ts, source: 'kraken' });
      }
    }
    return ticks;
  } catch {
    return [];
  }
}

export interface ReconnectingWebSocketLike {
  close(): void;
  send(data: string): void;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
  readonly readyState: number;
}

export type WebSocketFactory = (url: string) => ReconnectingWebSocketLike;

function defaultWsFactory(url: string): ReconnectingWebSocketLike {
  return new WebSocket(url) as unknown as ReconnectingWebSocketLike;
}

export interface PollingTransportOptions {
  mode: PriceTransportMode;
  pollIntervalMs?: number;
  onPoll?: () => void | Promise<void>;
  isOnline?: () => boolean;
}

export function createPollingTransport(opts: PollingTransportOptions): PriceTransport {
  const pollMs = opts.pollIntervalMs ?? DEFAULT_POLL_MS;
  const isOnline = opts.isOnline ?? (() =>
    typeof navigator === 'undefined' ? true : navigator.onLine);

  let timer: ReturnType<typeof setInterval> | null = null;
  let started = false;

  const status: TransportStatus = {
    kind: isOnline() ? 'poll' : 'offline',
    connection: 'idle',
    mode: opts.mode,
  };

  const runPoll = () => {
    if (!isOnline()) {
      status.kind = 'offline';
      status.connection = 'offline';
      return;
    }
    status.kind = 'poll';
    status.connection = 'connected';
    void opts.onPoll?.();
  };

  return {
    subscribe(_symbols: readonly AssetId[]) {
      return {
        unsubscribe() { /* no-op */ },
        onTick(_cb: (tick: PriceTick) => void) {
          return () => { /* no-op */ };
        },
      };
    },
    getStatus() {
      return { ...status };
    },
    start() {
      if (started) return;
      started = true;
      runPoll();
      timer = setInterval(runPoll, pollMs);
    },
    stop() {
      started = false;
      if (timer != null) clearInterval(timer);
      timer = null;
      status.connection = 'idle';
    },
  };
}

export interface WebSocketTransportOptions {
  mode: PriceTransportMode;
  wsFactory?: WebSocketFactory;
  isOnline?: () => boolean;
  onTick?: (tick: PriceTick) => void;
  onFailure?: () => void;
}

interface WsConnection {
  name: 'coinbase' | 'kraken';
  url: string;
  ws: ReconnectingWebSocketLike | null;
  attempt: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
}

export function createWebSocketTransport(opts: WebSocketTransportOptions): PriceTransport {
  const wsFactory = opts.wsFactory ?? defaultWsFactory;
  const isOnline = opts.isOnline ?? (() =>
    typeof navigator === 'undefined' ? true : navigator.onLine);

  let symbols: readonly AssetId[] = [...DASHBOARD_PRICE_ASSET_IDS];
  const tickListeners = new Set<(tick: PriceTick) => void>();
  let started = false;
  let lastTickAt = 0;
  let silenceTimer: ReturnType<typeof setInterval> | null = null;
  let failureCount = 0;

  const status: TransportStatus = {
    kind: 'stream',
    connection: 'idle',
    mode: opts.mode,
  };

  const emitTick = (tick: PriceTick) => {
    lastTickAt = Date.now();
    failureCount = 0;
    opts.onTick?.(tick);
    for (const cb of tickListeners) cb(tick);
  };

  const connections: WsConnection[] = [
    { name: 'coinbase', url: COINBASE_WS_URL, ws: null, attempt: 0, reconnectTimer: null },
    { name: 'kraken', url: KRAKEN_WS_URL, ws: null, attempt: 0, reconnectTimer: null },
  ];

  const closeConnection = (conn: WsConnection) => {
    if (conn.reconnectTimer != null) clearTimeout(conn.reconnectTimer);
    conn.reconnectTimer = null;
    if (conn.ws) {
      try { conn.ws.close(); } catch { /* ignore */ }
    }
    conn.ws = null;
  };

  const scheduleReconnect = (conn: WsConnection) => {
    if (!started || !isOnline()) return;
    status.connection = 'reconnecting';
    failureCount += 1;
    if (failureCount >= AUTO_FALLBACK_FAILURES) {
      opts.onFailure?.();
    }
    const delay = nextBackoffDelay(conn.attempt);
    conn.attempt += 1;
    conn.reconnectTimer = setTimeout(() => openConnection(conn), delay);
  };

  const openConnection = (conn: WsConnection) => {
    if (!started || !isOnline()) return;
    closeConnection(conn);

    try {
      const ws = wsFactory(conn.url);
      conn.ws = ws;

      const onOpen = () => {
        conn.attempt = 0;
        status.connection = 'connected';
        status.kind = 'stream';
        if (conn.name === 'coinbase') {
          ws.send(JSON.stringify({
            type: 'subscribe',
            product_ids: coinbaseProductsForAssets(symbols),
            channel: 'ticker_batch',
          }));
          ws.send(JSON.stringify({ type: 'subscribe', channel: 'heartbeats' }));
        } else {
          const krakenSyms = krakenSymbolsForAssets(symbols);
          if (krakenSyms.length > 0) {
            ws.send(JSON.stringify({
              method: 'subscribe',
              params: { channel: 'ticker', symbol: krakenSyms, event_trigger: 'trades' },
            }));
          }
        }
      };

      const onMessage = (ev: Event) => {
        const raw = typeof (ev as MessageEvent).data === 'string' ? (ev as MessageEvent).data as string : '';
        const ticks = conn.name === 'coinbase'
          ? parseCoinbaseTickerBatch(raw)
          : parseKrakenTickerV2(raw);
        for (const tick of ticks) emitTick(tick);
      };

      const onClose = () => scheduleReconnect(conn);
      const onError = () => scheduleReconnect(conn);

      ws.addEventListener('open', onOpen);
      ws.addEventListener('message', onMessage);
      ws.addEventListener('close', onClose);
      ws.addEventListener('error', onError);
    } catch {
      scheduleReconnect(conn);
    }
  };

  return {
    subscribe(newSymbols: readonly AssetId[]) {
      symbols = newSymbols;
      return {
        unsubscribe() { symbols = []; },
        onTick(cb: (tick: PriceTick) => void) {
          tickListeners.add(cb);
          return () => tickListeners.delete(cb);
        },
      };
    },
    getStatus() {
      return { ...status };
    },
    start() {
      if (started) return;
      if (!isOnline()) {
        status.kind = 'offline';
        status.connection = 'offline';
        return;
      }
      started = true;
      lastTickAt = Date.now();
      for (const conn of connections) openConnection(conn);
      silenceTimer = setInterval(() => {
        if (!started || lastTickAt === 0) return;
        if (Date.now() - lastTickAt > STREAM_SILENCE_MS) {
          failureCount += 1;
          if (failureCount >= AUTO_FALLBACK_FAILURES) {
            opts.onFailure?.();
          } else {
            for (const conn of connections) {
              conn.attempt = 0;
              openConnection(conn);
            }
          }
          lastTickAt = Date.now();
        }
      }, 5_000);
    },
    stop() {
      started = false;
      if (silenceTimer != null) clearInterval(silenceTimer);
      silenceTimer = null;
      for (const conn of connections) closeConnection(conn);
      tickListeners.clear();
      status.connection = 'idle';
    },
  };
}

export interface AutoTransportOptions {
  pollIntervalMs?: number;
  onPoll?: () => void | Promise<void>;
  onFallback?: () => void;
  skipWebSocket?: boolean;
  wsFactory?: WebSocketFactory;
  isOnline?: () => boolean;
  onTicks?: (ticks: PriceTick[]) => void;
  coalesceMs?: number;
}

export function createAutoTransport(opts: AutoTransportOptions): PriceTransport {
  const isOnline = opts.isOnline ?? (() =>
    typeof navigator === 'undefined' ? true : navigator.onLine);
  const coalesceMs = opts.coalesceMs ?? DEFAULT_COALESCE_MS;

  let fellBack = false;
  let symbols: readonly AssetId[] = [...DASHBOARD_PRICE_ASSET_IDS];
  const tickListeners = new Set<(tick: PriceTick) => void>();

  const status: TransportStatus = {
    kind: opts.skipWebSocket ? 'poll' : 'stream',
    connection: 'idle',
    mode: 'auto',
  };

  const handleTicks = (ticks: PriceTick[]) => {
    opts.onTicks?.(ticks);
    for (const t of ticks) {
      for (const cb of tickListeners) cb(t);
    }
  };

  const pollTransport = createPollingTransport({
    mode: 'auto',
    pollIntervalMs: opts.pollIntervalMs,
    onPoll: opts.onPoll,
    isOnline,
  });

  const coalescer = createTickCoalescer(coalesceMs, handleTicks);

  const wsTransport = createWebSocketTransport({
    mode: 'auto',
    wsFactory: opts.wsFactory,
    isOnline,
    onTick: (tick) => coalescer.push(tick),
    onFailure: () => {
      if (fellBack) return;
      fellBack = true;
      wsTransport.stop();
      coalescer.dispose();
      status.kind = 'poll';
      status.connection = 'fallback';
      opts.onFallback?.();
      pollTransport.start();
    },
  });

  return {
    subscribe(newSymbols: readonly AssetId[]) {
      symbols = newSymbols;
      pollTransport.subscribe(symbols);
      wsTransport.subscribe(symbols);
      return {
        unsubscribe() { symbols = []; },
        onTick(cb: (tick: PriceTick) => void) {
          tickListeners.add(cb);
          return () => tickListeners.delete(cb);
        },
      };
    },
    getStatus() {
      if (fellBack) {
        return { kind: 'poll', connection: 'fallback', mode: 'auto' };
      }
      if (opts.skipWebSocket) {
        return pollTransport.getStatus();
      }
      return wsTransport.getStatus();
    },
    start() {
      if (!isOnline()) {
        status.kind = 'offline';
        status.connection = 'offline';
        return;
      }
      if (opts.skipWebSocket) {
        status.kind = 'poll';
        status.connection = 'connected';
        pollTransport.start();
        return;
      }
      status.kind = 'stream';
      wsTransport.start();
    },
    stop() {
      pollTransport.stop();
      wsTransport.stop();
      coalescer.dispose();
      tickListeners.clear();
      fellBack = false;
      status.connection = 'idle';
    },
  };
}

export interface CreatePriceTransportOptions {
  mode: PriceTransportMode;
  pollIntervalMs?: number;
  coalesceMs?: number;
  onPoll?: () => void | Promise<void>;
  onTicks?: (ticks: PriceTick[]) => void;
  skipWebSocket?: boolean;
  wsFactory?: WebSocketFactory;
  isOnline?: () => boolean;
  isMock?: boolean;
}

export function createPriceTransport(opts: CreatePriceTransportOptions): PriceTransport {
  const coalesceMs = opts.coalesceMs ?? DEFAULT_COALESCE_MS;
  const skipWs = opts.skipWebSocket ?? opts.isMock ?? false;

  if (opts.mode === 'poll') {
    return createPollingTransport({
      mode: 'poll',
      pollIntervalMs: opts.pollIntervalMs,
      onPoll: opts.onPoll,
      isOnline: opts.isOnline,
    });
  }

  if (opts.mode === 'stream') {
    const coalescer = createTickCoalescer(coalesceMs, (ticks) => {
      opts.onTicks?.(ticks);
    });
    const transport = createWebSocketTransport({
      mode: 'stream',
      wsFactory: opts.wsFactory,
      isOnline: opts.isOnline,
      onTick: (tick) => coalescer.push(tick),
    });
    const originalStop = transport.stop.bind(transport);
    return {
      ...transport,
      stop() {
        coalescer.dispose();
        originalStop();
      },
    };
  }

  return createAutoTransport({
    pollIntervalMs: opts.pollIntervalMs,
    onPoll: opts.onPoll,
    skipWebSocket: skipWs,
    wsFactory: opts.wsFactory,
    isOnline: opts.isOnline,
    onTicks: opts.onTicks,
    coalesceMs,
  });
}

export { DEFAULT_COALESCE_MS, DEFAULT_POLL_MS, STREAM_SILENCE_MS };
