import { describe, it, expect, vi } from 'vitest';
import {
  getAdapter,
  canExecuteLocally,
  adapterCredentialsFromSettings,
} from './exchangeAdapters';
import { resolvePaxgXautArbOrder } from './orderTypes';

vi.mock('./coinbaseTrader', () => ({
  placeOrder: vi.fn(),
  testCoinbaseConnection: vi.fn(),
}));

describe('getAdapter', () => {
  it('returns coinbase adapter with canTrade', () => {
    const adapter = getAdapter('coinbase');
    expect(adapter).toBeDefined();
    expect(adapter?.config.canTrade).toBe(true);
    expect(adapter?.testConnection).toBeTypeOf('function');
    expect(adapter?.getOrderStatus).toBeTypeOf('function');
  });

  it('returns kraken adapter whose local placeOrder throws', async () => {
    const adapter = getAdapter('kraken');
    expect(adapter).toBeDefined();
    expect(adapter?.config.canTrade).toBe(true);

    await expect(adapter!.placeOrder(
      { product_id: 'PAXG-USD', side: 'BUY', order_configuration: {} },
      false,
      {},
    )).rejects.toThrow(/server-secure mode/i);
  });

  it('returns undefined for gemini and unknown ids', () => {
    expect(getAdapter('gemini')).toBeUndefined();
    expect(getAdapter('unknown')).toBeUndefined();
  });
});

describe('canExecuteLocally', () => {
  const mockUser = { id: 'user-1' };

  it('routes authenticated users to server', () => {
    expect(canExecuteLocally('coinbase', mockUser)).toBe('server');
    expect(canExecuteLocally('kraken', mockUser)).toBe('server');
  });

  it('allows coinbase local execution without login', () => {
    expect(canExecuteLocally('coinbase', null)).toBe('local');
  });

  it('blocks kraken local execution without login', () => {
    expect(canExecuteLocally('kraken', null)).toBe('unsupported');
  });

  it('returns unsupported for unknown venues', () => {
    expect(canExecuteLocally('gemini', null)).toBe('unsupported');
    expect(canExecuteLocally('unknown', null)).toBe('unsupported');
  });
});

describe('adapterCredentialsFromSettings', () => {
  it('maps all credential fields', () => {
    expect(
      adapterCredentialsFromSettings({
        cdpKeyName: 'org/key',
        cdpPrivateKey: 'pem',
        krakenApiKey: 'k',
        krakenApiSecret: 's',
      }),
    ).toEqual({
      cdpKeyName: 'org/key',
      cdpPrivateKey: 'pem',
      krakenApiKey: 'k',
      krakenApiSecret: 's',
    });
  });
});

describe('resolvePaxgXautArbOrder', () => {
  it('uses PAXG-XAUT BUY on kraken when spread is positive', () => {
    const order = resolvePaxgXautArbOrder('kraken', 0.8, 0.5);
    expect(order.product_id).toBe('PAXG-XAUT');
    expect(order.side).toBe('BUY');
    expect(order.order_configuration.market_market_ioc?.base_size).toBe('0.5');
  });

  it('uses PAXG-XAUT SELL on kraken when spread is negative', () => {
    const order = resolvePaxgXautArbOrder('kraken', -0.8, 1);
    expect(order.product_id).toBe('PAXG-XAUT');
    expect(order.side).toBe('SELL');
  });

  it('uses PAXG-USD BUY on coinbase when spread is positive', () => {
    const order = resolvePaxgXautArbOrder('coinbase', 0.8, 0.5);
    expect(order.product_id).toBe('PAXG-USD');
    expect(order.side).toBe('BUY');
  });

  it('uses XAUT-USD BUY on coinbase when spread is negative', () => {
    const order = resolvePaxgXautArbOrder('coinbase', -0.8, 0.5);
    expect(order.product_id).toBe('XAUT-USD');
    expect(order.side).toBe('BUY');
  });
});

describe('kraken adapter testConnection', () => {
  it('returns false locally (no browser HMAC)', async () => {
    const adapter = getAdapter('kraken');
    const ok = await adapter!.testConnection({ krakenApiKey: 'k', krakenApiSecret: 's' });
    expect(ok).toBe(false);
  });
});
