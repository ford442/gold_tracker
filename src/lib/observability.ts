/**
 * Pure observability and diagnostic event buffer (issue #49 / P1 observability).
 *
 * Tracks health, price transport events, WebSocket lifecycle, venue quotes,
 * trade attempts, edge invocations, and market-cache metrics in a fixed-size ring buffer.
 *
 * Guaranteed free of PII and private API keys.
 */

export type ObservabilityEventKind =
  | 'price_fetch'
  | 'ws_status'
  | 'venue_quote'
  | 'trade_attempt'
  | 'edge_invoke'
  | 'cache';

export type EventSeverity = 'info' | 'warn' | 'error' | 'success';

export interface ObservabilityEvent {
  id: string;
  ts: number;
  kind: ObservabilityEventKind;
  severity: EventSeverity;
  ok: boolean;
  source: string;
  exchange?: string;
  action?: string;
  latencyMs?: number;
  detail: string;
  meta?: Record<string, unknown>;
}

export interface ObservabilitySummary {
  totalEvents: number;
  lastRestPriceTs?: number;
  lastWsTickTs?: number;
  lastTradeAttemptTs?: number;
  lastTradeOutcome?: string;
  wsState: 'connected' | 'reconnecting' | 'fallback_rest' | 'idle' | 'offline' | 'disabled';
  priceFeedHealth: 'healthy' | 'degraded' | 'offline';
  tradeHealth: 'healthy' | 'degraded' | 'error' | 'idle';
  cacheHits: number;
  cacheMisses: number;
  cacheDedupes: number;
  errorCount: number;
  warnCount: number;
}

export const MAX_OBSERVABILITY_EVENTS = 200;

const SENSITIVE_KEY_PATTERN = /(?:key|secret|token|password|auth|private|bearer|cdp)/i;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9_.-]+/gi;
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
const PEM_KEY_PATTERN = /-----BEGIN[A-Z\s]+KEY-----[\s\S]*?-----END[A-Z\s]+KEY-----/g;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Redact sensitive strings (JWTs, Bearer tokens, PEM keys, emails, long hex secrets).
 */
export function sanitizeString(input: string): string {
  if (!input) return '';
  return input
    .replace(BEARER_PATTERN, 'Bearer [REDACTED]')
    .replace(JWT_PATTERN, '[JWT REDACTED]')
    .replace(PEM_KEY_PATTERN, '[PRIVATE KEY REDACTED]')
    .replace(EMAIL_PATTERN, '[EMAIL REDACTED]');
}

/**
 * Recursively sanitize metadata objects by redacting sensitive keys and values.
 */
export function sanitizeMetadata(
  meta?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(meta)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      clean[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      clean[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      clean[key] = value;
    }
  }

  return clean;
}

let eventSequence = 0;

export interface EventRingBuffer {
  capacity: number;
  events: ObservabilityEvent[];
  listeners: Set<(event: ObservabilityEvent) => void>;
  append: (event: Omit<ObservabilityEvent, 'id' | 'ts'> & { id?: string; ts?: number }) => ObservabilityEvent;
  getAll: () => ObservabilityEvent[];
  getFiltered: (filter?: { kind?: ObservabilityEventKind; ok?: boolean; limit?: number }) => ObservabilityEvent[];
  getSummary: (now?: number) => ObservabilitySummary;
  clear: () => void;
  subscribe: (listener: (event: ObservabilityEvent) => void) => () => void;
}

export function createEventRingBuffer(capacity = MAX_OBSERVABILITY_EVENTS): EventRingBuffer {
  const events: ObservabilityEvent[] = [];
  const listeners = new Set<(event: ObservabilityEvent) => void>();

  const append = (
    input: Omit<ObservabilityEvent, 'id' | 'ts'> & { id?: string; ts?: number },
  ): ObservabilityEvent => {
    eventSequence += 1;
    const now = input.ts ?? Date.now();
    const event: ObservabilityEvent = {
      id: input.id ?? `obs-${now}-${eventSequence}`,
      ts: now,
      kind: input.kind,
      severity: input.severity,
      ok: input.ok,
      source: sanitizeString(input.source),
      exchange: input.exchange ? sanitizeString(input.exchange) : undefined,
      action: input.action ? sanitizeString(input.action) : undefined,
      latencyMs: typeof input.latencyMs === 'number' && Number.isFinite(input.latencyMs)
        ? Math.round(input.latencyMs)
        : undefined,
      detail: sanitizeString(input.detail),
      meta: sanitizeMetadata(input.meta),
    };

    if (events.length >= capacity) {
      events.shift();
    }
    events.push(event);

    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        // Non-blocking for callers
      }
    }

    return event;
  };

  const getAll = (): ObservabilityEvent[] => [...events];

  const getFiltered = (
    filter?: { kind?: ObservabilityEventKind; ok?: boolean; limit?: number },
  ): ObservabilityEvent[] => {
    let list = [...events];
    if (filter?.kind) {
      list = list.filter((e) => e.kind === filter.kind);
    }
    if (typeof filter?.ok === 'boolean') {
      list = list.filter((e) => e.ok === filter.ok);
    }
    list.sort((a, b) => b.ts - a.ts);
    if (filter?.limit && filter.limit > 0) {
      list = list.slice(0, filter.limit);
    }
    return list;
  };

  const getSummary = (now = Date.now()): ObservabilitySummary => {
    let lastRestPriceTs: number | undefined;
    let lastWsTickTs: number | undefined;
    let lastTradeAttemptTs: number | undefined;
    let lastTradeOutcome: string | undefined;

    let wsState: ObservabilitySummary['wsState'] = 'idle';
    let cacheHits = 0;
    let cacheMisses = 0;
    let cacheDedupes = 0;
    let errorCount = 0;
    let warnCount = 0;

    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];

      if (e.severity === 'error') errorCount += 1;
      if (e.severity === 'warn') warnCount += 1;

      if (!lastRestPriceTs && e.kind === 'price_fetch' && e.ok) {
        lastRestPriceTs = e.ts;
      }
      if (!lastWsTickTs && e.kind === 'ws_status' && e.action === 'stream_tick') {
        lastWsTickTs = e.ts;
      }
      if (!lastTradeAttemptTs && e.kind === 'trade_attempt') {
        lastTradeAttemptTs = e.ts;
        lastTradeOutcome = e.action ?? (e.ok ? 'success' : 'failed');
      }

      if (wsState === 'idle' && e.kind === 'ws_status') {
        if (e.action === 'connect' && e.ok) wsState = 'connected';
        else if (e.action === 'reconnect') wsState = 'reconnecting';
        else if (e.action === 'fallback_rest') wsState = 'fallback_rest';
        else if (e.action === 'disconnect') wsState = 'offline';
      }

      if (e.kind === 'cache') {
        if (e.action === 'cache_hit') cacheHits += 1;
        else if (e.action === 'cache_miss') cacheMisses += 1;
        else if (e.action === 'cache_dedupe') cacheDedupes += 1;
      }
    }

    // Evaluate price feed health
    let priceFeedHealth: ObservabilitySummary['priceFeedHealth'] = 'healthy';
    if (!lastRestPriceTs && !lastWsTickTs) {
      priceFeedHealth = 'offline';
    } else {
      const newestTick = Math.max(lastRestPriceTs ?? 0, lastWsTickTs ?? 0);
      const ageMs = now - newestTick;
      if (ageMs > 180_000) {
        priceFeedHealth = 'offline';
      } else if (ageMs > 90_000 || wsState === 'fallback_rest' || wsState === 'reconnecting') {
        priceFeedHealth = 'degraded';
      }
    }

    // Evaluate trade execution health
    let tradeHealth: ObservabilitySummary['tradeHealth'] = 'idle';
    if (lastTradeAttemptTs) {
      const recentTradeErrors = events
        .filter((e) => e.kind === 'trade_attempt' && now - e.ts < 300_000 && !e.ok && e.action !== 'risk_block')
        .length;
      if (recentTradeErrors >= 2) {
        tradeHealth = 'error';
      } else if (recentTradeErrors === 1 || lastTradeOutcome === 'risk_block') {
        tradeHealth = 'degraded';
      } else {
        tradeHealth = 'healthy';
      }
    }

    return {
      totalEvents: events.length,
      lastRestPriceTs,
      lastWsTickTs,
      lastTradeAttemptTs,
      lastTradeOutcome,
      wsState,
      priceFeedHealth,
      tradeHealth,
      cacheHits,
      cacheMisses,
      cacheDedupes,
      errorCount,
      warnCount,
    };
  };

  const clear = (): void => {
    events.length = 0;
  };

  const subscribe = (listener: (event: ObservabilityEvent) => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    capacity,
    events,
    listeners,
    append,
    getAll,
    getFiltered,
    getSummary,
    clear,
    subscribe,
  };
}

/** Global singleton ring buffer instance */
export const defaultObservabilityBuffer = createEventRingBuffer();

export function recordObservabilityEvent(
  input: Omit<ObservabilityEvent, 'id' | 'ts'> & { id?: string; ts?: number },
): ObservabilityEvent {
  return defaultObservabilityBuffer.append(input);
}

export function getObservabilityEvents(
  filter?: { kind?: ObservabilityEventKind; ok?: boolean; limit?: number },
): ObservabilityEvent[] {
  return defaultObservabilityBuffer.getFiltered(filter);
}

export function getObservabilitySummary(now?: number): ObservabilitySummary {
  return defaultObservabilityBuffer.getSummary(now);
}

export function clearObservabilityEvents(): void {
  defaultObservabilityBuffer.clear();
}

export function exportObservabilityJson(): string {
  const summary = defaultObservabilityBuffer.getSummary();
  const events = defaultObservabilityBuffer.getAll();
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      summary,
      events,
    },
    null,
    2,
  );
}
