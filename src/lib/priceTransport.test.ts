import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createTickCoalescer,
  nextBackoffDelay,
  parseCoinbaseTickerBatch,
  parseKrakenTickerV2,
  ticksToPricePatches,
  coinbaseProductsForAssets,
  krakenSymbolsForAssets,
  createPollingTransport,
  createAutoTransport,
  DEFAULT_COALESCE_MS,
} from './priceTransport';

describe('nextBackoffDelay', () => {
  it('grows exponentially and caps at max', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(nextBackoffDelay(0, 1000, 30000)).toBe(1000);
    expect(nextBackoffDelay(1, 1000, 30000)).toBe(2000);
    expect(nextBackoffDelay(5, 1000, 30000)).toBe(30000);
    vi.restoreAllMocks();
  });
});

describe('parseCoinbaseTickerBatch', () => {
  it('parses ticker_batch events into ticks', () => {
    const raw = JSON.stringify({
      channel: 'ticker_batch',
      events: [{
        type: 'update',
        tickers: [
          { product_id: 'BTC-USD', price: '97500.12' },
          { product_id: 'PAXG-USD', price: '3281.50' },
        ],
      }],
    });
    const ticks = parseCoinbaseTickerBatch(raw);
    expect(ticks).toHaveLength(2);
    expect(ticks[0]).toMatchObject({ assetId: 'bitcoin', price: 97500.12, source: 'coinbase' });
    expect(ticks[1]).toMatchObject({ assetId: 'pax-gold', price: 3281.5, source: 'coinbase' });
  });

  it('returns empty for invalid JSON', () => {
    expect(parseCoinbaseTickerBatch('not json')).toEqual([]);
  });
});

describe('parseKrakenTickerV2', () => {
  it('parses ticker data rows', () => {
    const raw = JSON.stringify({
      channel: 'ticker',
      type: 'update',
      data: [
        { symbol: 'ETH/USD', last: 3855.5 },
        { symbol: 'XAUT/USD', price: 3285.0 },
      ],
    });
    const ticks = parseKrakenTickerV2(raw);
    expect(ticks).toHaveLength(2);
    expect(ticks[0]).toMatchObject({ assetId: 'ethereum', price: 3855.5, source: 'kraken' });
    expect(ticks[1]).toMatchObject({ assetId: 'tether-gold', price: 3285, source: 'kraken' });
  });
});

describe('ticksToPricePatches', () => {
  it('maps last tick per asset to price patches', () => {
    const patches = ticksToPricePatches([
      { assetId: 'bitcoin', price: 100, ts: 1, source: 'coinbase' },
      { assetId: 'bitcoin', price: 101, ts: 2, source: 'kraken' },
    ]);
    expect(patches).toEqual({ bitcoin: { price: 101 } });
  });
});

describe('venue symbol helpers', () => {
  it('maps dashboard assets to coinbase products', () => {
    const products = coinbaseProductsForAssets(['bitcoin', 'pax-gold']);
    expect(products).toContain('BTC-USD');
    expect(products).toContain('PAXG-USD');
  });

  it('maps dashboard assets to kraken symbols (no BCH)', () => {
    const symbols = krakenSymbolsForAssets(['bitcoin', 'bitcoin-cash']);
    expect(symbols).toContain('BTC/USD');
    expect(symbols).not.toContain('BCH/USD');
  });
});

describe('createTickCoalescer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('batches burst ticks into few flushes', () => {
    const flushes: number[] = [];
    const coalescer = createTickCoalescer(250, (ticks) => {
      flushes.push(ticks.length);
    });

    for (let i = 0; i < 500; i++) {
      coalescer.push({
        assetId: 'bitcoin',
        price: 97000 + i * 0.01,
        ts: i,
        source: 'coinbase',
      });
    }

    vi.advanceTimersByTime(1000);
    coalescer.flush();

    expect(flushes.length).toBeLessThanOrEqual(5);
    coalescer.dispose();
  });

  it('coalesces to last tick per asset within a window', () => {
    const batches: number[][] = [];
    const coalescer = createTickCoalescer(DEFAULT_COALESCE_MS, (ticks) => {
      batches.push(ticks.map((t) => t.price));
    });

    coalescer.push({ assetId: 'bitcoin', price: 100, ts: 1, source: 'coinbase' });
    coalescer.push({ assetId: 'bitcoin', price: 101, ts: 2, source: 'kraken' });
    coalescer.push({ assetId: 'ethereum', price: 50, ts: 3, source: 'coinbase' });
    vi.advanceTimersByTime(DEFAULT_COALESCE_MS);

    expect(batches).toHaveLength(1);
    expect(batches[0]).toEqual([101, 50]);
    coalescer.dispose();
  });
});

describe('createPollingTransport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('invokes onPoll on start and interval', () => {
    const onPoll = vi.fn();
    const transport = createPollingTransport({
      mode: 'poll',
      pollIntervalMs: 1000,
      onPoll,
      isOnline: () => true,
    });
    transport.start();
    expect(onPoll).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3000);
    expect(onPoll).toHaveBeenCalledTimes(4);
    transport.stop();
  });
});

describe('createAutoTransport', () => {
  it('falls back to poll when skipWebSocket is set', () => {
    const onPoll = vi.fn();
    const transport = createAutoTransport({
      skipWebSocket: true,
      onPoll,
      isOnline: () => true,
    });
    transport.start();
    expect(onPoll).toHaveBeenCalled();
    expect(transport.getStatus().kind).toBe('poll');
    transport.stop();
  });
});
