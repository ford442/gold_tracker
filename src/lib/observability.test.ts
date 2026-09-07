import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createEventRingBuffer,
  sanitizeString,
  sanitizeMetadata,
  recordObservabilityEvent,
  getObservabilityEvents,
  getObservabilitySummary,
  clearObservabilityEvents,
  exportObservabilityJson,
  type ObservabilityEvent,
} from './observability';

describe('observability', () => {
  beforeEach(() => {
    clearObservabilityEvents();
  });

  describe('sanitizeString', () => {
    it('redacts Bearer tokens', () => {
      const input = 'Authorization: Bearer secret_token_12345abcde failed';
      expect(sanitizeString(input)).toBe('Authorization: Bearer [REDACTED] failed');
    });

    it('redacts JWT tokens', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const input = `Received token ${jwt} from server`;
      expect(sanitizeString(input)).toBe('Received token [JWT REDACTED] from server');
    });

    it('redacts PEM private key blocks', () => {
      const pem = '-----BEGIN EC PRIVATE KEY-----\nMHQCAQEEI...ABC123\n-----END EC PRIVATE KEY-----';
      const input = `Signing with key:\n${pem}\nDone.`;
      expect(sanitizeString(input)).toBe('Signing with key:\n[PRIVATE KEY REDACTED]\nDone.');
    });

    it('redacts email addresses', () => {
      const input = 'Alert sent to operator user.test@example.com successfully';
      expect(sanitizeString(input)).toBe('Alert sent to operator [EMAIL REDACTED] successfully');
    });

    it('returns empty string for empty input', () => {
      expect(sanitizeString('')).toBe('');
    });
  });

  describe('sanitizeMetadata', () => {
    it('redacts sensitive keys and values in metadata objects', () => {
      const meta = {
        apiKey: 'AKIAIOSFODNN7EXAMPLE',
        apiSecret: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        cdpPrivateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgk...\n-----END PRIVATE KEY-----',
        safeProperty: 'BTC-USD',
        isMock: false,
        nested: {
          userToken: 'secret_value',
          price: 2650.5,
        },
      };

      const clean = sanitizeMetadata(meta);
      expect(clean).toEqual({
        apiKey: '[REDACTED]',
        apiSecret: '[REDACTED]',
        cdpPrivateKey: '[REDACTED]',
        safeProperty: 'BTC-USD',
        isMock: false,
        nested: {
          userToken: '[REDACTED]',
          price: 2650.5,
        },
      });
    });

    it('handles undefined metadata gracefully', () => {
      expect(sanitizeMetadata(undefined)).toBeUndefined();
    });
  });

  describe('createEventRingBuffer', () => {
    it('appends events and respects capacity limit', () => {
      const buffer = createEventRingBuffer(3);

      buffer.append({
        kind: 'price_fetch',
        severity: 'info',
        ok: true,
        source: 'cg',
        detail: 'Event 1',
        ts: 1000,
      });
      buffer.append({
        kind: 'ws_status',
        severity: 'success',
        ok: true,
        source: 'cb-ws',
        detail: 'Event 2',
        ts: 2000,
      });
      buffer.append({
        kind: 'cache',
        severity: 'info',
        ok: true,
        source: 'mkt-cache',
        detail: 'Event 3',
        ts: 3000,
      });

      expect(buffer.getAll()).toHaveLength(3);

      // Add 4th event -> 1st event should be evicted
      buffer.append({
        kind: 'trade_attempt',
        severity: 'warn',
        ok: false,
        source: 'risk-gate',
        detail: 'Event 4',
        ts: 4000,
      });

      const all = buffer.getAll();
      expect(all).toHaveLength(3);
      expect(all.map((e) => e.detail)).toEqual(['Event 2', 'Event 3', 'Event 4']);
    });

    it('filters and sorts events by ts descending', () => {
      const buffer = createEventRingBuffer(10);
      buffer.append({ kind: 'price_fetch', severity: 'info', ok: true, source: 'cg', detail: 'PF 1', ts: 1000 });
      buffer.append({ kind: 'trade_attempt', severity: 'error', ok: false, source: 'cb', detail: 'TA 1', ts: 2000 });
      buffer.append({ kind: 'trade_attempt', severity: 'success', ok: true, source: 'cb', detail: 'TA 2', ts: 3000 });
      buffer.append({ kind: 'cache', severity: 'info', ok: true, source: 'cache', detail: 'C 1', ts: 4000 });

      const tradeAttempts = buffer.getFiltered({ kind: 'trade_attempt' });
      expect(tradeAttempts).toHaveLength(2);
      expect(tradeAttempts[0].detail).toBe('TA 2'); // newest first
      expect(tradeAttempts[1].detail).toBe('TA 1');

      const errorsOnly = buffer.getFiltered({ ok: false });
      expect(errorsOnly).toHaveLength(1);
      expect(errorsOnly[0].detail).toBe('TA 1');

      const limited = buffer.getFiltered({ limit: 2 });
      expect(limited).toHaveLength(2);
      expect(limited[0].detail).toBe('C 1');
      expect(limited[1].detail).toBe('TA 2');
    });

    it('notifies subscribers on event append and unsubscribes cleanly', () => {
      const buffer = createEventRingBuffer();
      const listener = vi.fn();
      const unsubscribe = buffer.subscribe(listener);

      buffer.append({
        kind: 'price_fetch',
        severity: 'info',
        ok: true,
        source: 'cg',
        detail: 'Subscribed event',
      });

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0]?.[0] as { detail?: string } | undefined;
      expect(event?.detail).toBe('Subscribed event');

      unsubscribe();
      buffer.append({
        kind: 'price_fetch',
        severity: 'info',
        ok: true,
        source: 'cg',
        detail: 'After unsubscribe',
      });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('clears all events', () => {
      const buffer = createEventRingBuffer();
      buffer.append({ kind: 'cache', severity: 'info', ok: true, source: 'c', detail: '1' });
      buffer.append({ kind: 'cache', severity: 'info', ok: true, source: 'c', detail: '2' });
      expect(buffer.getAll()).toHaveLength(2);

      buffer.clear();
      expect(buffer.getAll()).toHaveLength(0);
    });
  });

  describe('getSummary calculation', () => {
    it('computes healthy summary with fresh prices, active ws, and cache hits', () => {
      const buffer = createEventRingBuffer();
      const now = 1700000000000;

      buffer.append({
        kind: 'price_fetch',
        severity: 'info',
        ok: true,
        source: 'cg',
        detail: 'Price poll ok',
        ts: now - 10000,
      });

      buffer.append({
        kind: 'ws_status',
        severity: 'success',
        ok: true,
        source: 'cb-ws',
        action: 'connect',
        detail: 'Connected',
        ts: now - 30000,
      });

      buffer.append({
        kind: 'ws_status',
        severity: 'info',
        ok: true,
        source: 'cb-ws',
        action: 'stream_tick',
        detail: 'Tick PAXG $2650',
        ts: now - 2000,
      });

      buffer.append({
        kind: 'cache',
        severity: 'info',
        ok: true,
        source: 'market-cache',
        action: 'cache_hit',
        detail: 'Hit',
        ts: now - 5000,
      });

      buffer.append({
        kind: 'cache',
        severity: 'info',
        ok: true,
        source: 'market-cache',
        action: 'cache_miss',
        detail: 'Miss',
        ts: now - 4000,
      });

      buffer.append({
        kind: 'cache',
        severity: 'info',
        ok: true,
        source: 'market-cache',
        action: 'cache_dedupe',
        detail: 'Dedupe',
        ts: now - 3000,
      });

      const summary = buffer.getSummary(now);

      expect(summary.totalEvents).toBe(6);
      expect(summary.priceFeedHealth).toBe('healthy');
      expect(summary.wsState).toBe('connected');
      expect(summary.cacheHits).toBe(1);
      expect(summary.cacheMisses).toBe(1);
      expect(summary.cacheDedupes).toBe(1);
      expect(summary.lastRestPriceTs).toBe(now - 10000);
      expect(summary.lastWsTickTs).toBe(now - 2000);
    });

    it('marks price feed as degraded or offline when stale', () => {
      const buffer = createEventRingBuffer();
      const now = 1700000000000;

      // Price from 100 seconds ago (> 90s -> degraded)
      buffer.append({
        kind: 'price_fetch',
        severity: 'info',
        ok: true,
        source: 'cg',
        detail: 'Old price',
        ts: now - 100_000,
      });

      expect(buffer.getSummary(now).priceFeedHealth).toBe('degraded');

      // Price from 200 seconds ago (> 180s -> offline)
      buffer.clear();
      buffer.append({
        kind: 'price_fetch',
        severity: 'info',
        ok: true,
        source: 'cg',
        detail: 'Very old price',
        ts: now - 200_000,
      });

      expect(buffer.getSummary(now).priceFeedHealth).toBe('offline');
    });

    it('evaluates trade health based on recent trade attempts and errors', () => {
      const buffer = createEventRingBuffer();
      const now = 1700000000000;

      // 1. Success trade attempt
      buffer.append({
        kind: 'trade_attempt',
        severity: 'success',
        ok: true,
        source: 'coinbase',
        action: 'place_order',
        detail: 'Order submitted',
        ts: now - 10000,
      });

      expect(buffer.getSummary(now).tradeHealth).toBe('healthy');

      // 2. Risk block attempt
      buffer.append({
        kind: 'trade_attempt',
        severity: 'warn',
        ok: false,
        source: 'risk-gate',
        action: 'risk_block',
        detail: 'Risk blocked',
        ts: now - 5000,
      });

      expect(buffer.getSummary(now).tradeHealth).toBe('degraded');

      // 3. Multiple live failures -> error
      buffer.append({
        kind: 'trade_attempt',
        severity: 'error',
        ok: false,
        source: 'coinbase',
        action: 'place_order',
        detail: 'Network error 1',
        ts: now - 2000,
      });
      buffer.append({
        kind: 'trade_attempt',
        severity: 'error',
        ok: false,
        source: 'coinbase',
        action: 'place_order',
        detail: 'Network error 2',
        ts: now - 1000,
      });

      expect(buffer.getSummary(now).tradeHealth).toBe('error');
    });
  });

  describe('global singleton functions', () => {
    it('records and queries global observability events', () => {
      recordObservabilityEvent({
        kind: 'venue_quote',
        severity: 'info',
        ok: true,
        source: 'venue-fanout',
        action: 'quote_fanout',
        detail: '3 venue quotes received',
      });

      const events = getObservabilityEvents({ kind: 'venue_quote' });
      expect(events).toHaveLength(1);
      expect(events[0].source).toBe('venue-fanout');

      const summary = getObservabilitySummary();
      expect(summary.totalEvents).toBe(1);

      const json = exportObservabilityJson();
      const parsed = JSON.parse(json) as { summary: typeof summary; events: ObservabilityEvent[] };
      expect(parsed.events).toHaveLength(1);
      expect(parsed.summary.totalEvents).toBe(1);
    });
  });
});
