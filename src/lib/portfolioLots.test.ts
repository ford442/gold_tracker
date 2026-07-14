import { describe, it, expect } from 'vitest';
import type { PortfolioEntry } from '@/types';
import {
  appendAcquisitionLot,
  buildEntryWithLot,
  ensureEntryLots,
  migratePortfolioEntries,
  portfolioToCsv,
  replaceWithSingleLot,
  selectLotsForSale,
  sellFromEntry,
  summarizeRealized,
  summarizeUnrealized,
  totalFineGoldOz,
} from './portfolioLots';

function entry(overrides: Partial<PortfolioEntry> & Pick<PortfolioEntry, 'id' | 'symbol'>): PortfolioEntry {
  return {
    name: overrides.symbol,
    amount: 10,
    buyPrice: 3000,
    ...overrides,
  };
}

describe('ensureEntryLots', () => {
  it('migrates legacy entry without lots', () => {
    const e = entry({ id: 'e1', symbol: 'PAXG', amount: 5, buyPrice: 3200 });
    const migrated = ensureEntryLots(e, '2024-01-01T00:00:00.000Z');
    expect(migrated.lots).toHaveLength(1);
    expect(migrated.lots![0].units).toBe(5);
    expect(migrated.lots![0].costPerUnit).toBe(3200);
    expect(migrated.amount).toBe(5);
    expect(migrated.buyPrice).toBe(3200);
  });

  it('preserves existing lots', () => {
    const e = entry({
      id: 'e2',
      symbol: 'XAUT',
      lots: [
        { id: 'l1', units: 2, costPerUnit: 3100, acquiredAt: '2024-01-01T00:00:00.000Z' },
        { id: 'l2', units: 3, costPerUnit: 3300, acquiredAt: '2024-02-01T00:00:00.000Z' },
      ],
    });
    const synced = ensureEntryLots(e);
    expect(synced.amount).toBe(5);
    expect(synced.buyPrice).toBe(3220);
  });
});

describe('selectLotsForSale', () => {
  const lots = [
    { id: 'old', units: 2, costPerUnit: 3000, acquiredAt: '2024-01-01T00:00:00.000Z' },
    { id: 'mid', units: 3, costPerUnit: 3200, acquiredAt: '2024-03-01T00:00:00.000Z' },
    { id: 'high', units: 1, costPerUnit: 3500, acquiredAt: '2024-04-01T00:00:00.000Z' },
  ];

  it('FIFO consumes oldest first', () => {
    const { consumptions } = selectLotsForSale(lots, 4, 'FIFO');
    expect(consumptions).toEqual([
      { lotId: 'old', units: 2, costPerUnit: 3000 },
      { lotId: 'mid', units: 2, costPerUnit: 3200 },
    ]);
  });

  it('HIFO consumes highest cost first', () => {
    const { consumptions } = selectLotsForSale(lots, 2, 'HIFO');
    expect(consumptions[0]).toEqual({ lotId: 'high', units: 1, costPerUnit: 3500 });
    expect(consumptions[1]).toEqual({ lotId: 'mid', units: 1, costPerUnit: 3200 });
  });

  it('SpecID uses explicit lot order', () => {
    const { consumptions } = selectLotsForSale(lots, 3, 'SpecID', ['mid', 'old']);
    expect(consumptions).toEqual([
      { lotId: 'mid', units: 3, costPerUnit: 3200 },
    ]);
  });
});

describe('sellFromEntry', () => {
  it('records realized gain and reduces lots', () => {
    const e = ensureEntryLots(entry({ id: 'e3', symbol: 'PAXG', amount: 5, buyPrice: 3000 }));
    const withExtra = appendAcquisitionLot(e, 2, 3400, '2024-06-01T00:00:00.000Z');
    const sold = sellFromEntry(withExtra, {
      unitsToSell: 3,
      salePricePerUnit: 3600,
      method: 'FIFO',
      timestamp: '2024-07-01T12:00:00.000Z',
    });
    expect(sold.ok).toBe(true);
    if (!sold.ok) return;
    expect(sold.result.entry.amount).toBe(4);
    expect(sold.result.event.proceedsUsd).toBe(10800);
    expect(sold.result.event.costBasisUsd).toBe(9000);
    expect(sold.result.event.realizedGainUsd).toBe(1800);
  });
});

describe('summarizeUnrealized', () => {
  it('aggregates open positions', () => {
    const entries = [
      ensureEntryLots(entry({ id: 'a', symbol: 'PAXG', amount: 2, buyPrice: 3000 })),
      ensureEntryLots(entry({ id: 'b', symbol: 'BTC', amount: 0.5, buyPrice: 60000 })),
    ];
    const summary = summarizeUnrealized(entries, (sym) => (sym === 'PAXG' ? 3300 : 70000));
    expect(summary.lines).toHaveLength(2);
    expect(summary.totalUnrealizedPnlUsd).toBe(600 + 5000);
  });
});

describe('totalFineGoldOz', () => {
  it('sums gold sleeve units only', () => {
    const entries = [
      entry({ id: 'g1', symbol: 'XAU', amount: 1.5 }),
      entry({ id: 'g2', symbol: 'PAXG', amount: 3 }),
      entry({ id: 'c1', symbol: 'BTC', amount: 0.1 }),
    ];
    expect(totalFineGoldOz(entries)).toBe(4.5);
  });
});

describe('portfolioToCsv', () => {
  it('includes open lots and realized rows', () => {
    const e = ensureEntryLots(entry({ id: 'csv1', symbol: 'PAXG', amount: 2, buyPrice: 3100 }));
    const sold = sellFromEntry(e, { unitsToSell: 1, salePricePerUnit: 3300, method: 'FIFO' });
    expect(sold.ok).toBe(true);
    if (!sold.ok) return;
    const csv = portfolioToCsv([sold.result.entry], [sold.result.event], () => 3200);
    expect(csv).toContain('open_lot');
    expect(csv).toContain('realized_gain');
    expect(csv).toContain('PAXG');
  });
});

describe('buildEntryWithLot / replaceWithSingleLot', () => {
  it('creates a single-lot entry', () => {
    const built = buildEntryWithLot({
      id: 'new1',
      symbol: 'ETH',
      name: 'Ethereum',
      amount: 1,
      buyPrice: 2500,
    });
    expect(built.lots).toHaveLength(1);
    expect(built.amount).toBe(1);
  });

  it('replaces lots on manual edit', () => {
    const e = ensureEntryLots(entry({ id: 'edit1', symbol: 'PAXG' }));
    const replaced = replaceWithSingleLot(e, 8, 3150);
    expect(replaced.lots).toHaveLength(1);
    expect(replaced.amount).toBe(8);
    expect(replaced.buyPrice).toBe(3150);
  });
});

describe('migratePortfolioEntries', () => {
  it('migrates all entries', () => {
    const out = migratePortfolioEntries([entry({ id: 'm1', symbol: 'XAUT' })]);
    expect(out[0].lots).toHaveLength(1);
  });
});

describe('summarizeRealized', () => {
  it('totals realized P&L', () => {
    const summary = summarizeRealized([
      {
        id: 'r1',
        timestamp: '2024-01-02T00:00:00.000Z',
        entryId: 'e1',
        symbol: 'PAXG',
        unitsSold: 1,
        salePricePerUnit: 3300,
        proceedsUsd: 3300,
        costBasisUsd: 3000,
        realizedGainUsd: 300,
        costBasisMethod: 'FIFO',
        lotConsumptions: [],
      },
    ]);
    expect(summary.totalRealizedPnlUsd).toBe(300);
  });
});
