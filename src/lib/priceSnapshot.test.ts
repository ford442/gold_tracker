import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPriceSnapshot, loadPriceSnapshot, savePriceSnapshot } from './priceSnapshot';

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  });
});

describe('priceSnapshot', () => {
  it('round-trips snapshot data through localStorage', () => {
    savePriceSnapshot({
      prices: {},
      goldSpot: { price: 2600, change24h: 0.1, change7d: 0.2, unit: 'USD/oz', sparkline: [] },
      otherMetals: [],
      isMockData: false,
    });

    const loaded = loadPriceSnapshot();
    expect(loaded).not.toBeNull();
    expect(loaded?.goldSpot?.price).toBe(2600);
    expect(loaded?.savedAt).toBeGreaterThan(0);
  });

  it('clears persisted snapshot', () => {
    savePriceSnapshot({
      prices: {},
      goldSpot: null,
      otherMetals: [],
      isMockData: true,
    });
    clearPriceSnapshot();
    expect(loadPriceSnapshot()).toBeNull();
  });
});
