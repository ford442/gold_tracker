import { describe, expect, it } from 'vitest';
import {
  baseSymbolFromProductId,
  buildPaperFill,
  estimateFeeUsd,
  feeBpsForExchange,
  paperEquityCurve,
  paperFillsToCsv,
  summarizePaperLedger,
  type PaperFill,
} from './paperTrade';

function fill(overrides: Partial<PaperFill>): PaperFill {
  return {
    id: overrides.id ?? `f-${Math.random()}`,
    timestamp: overrides.timestamp ?? 0,
    mode: 'paper',
    suggestionId: overrides.suggestionId ?? 's1',
    suggestionType: overrides.suggestionType ?? 'arb',
    action: overrides.action ?? 'BUY PAXG',
    productId: overrides.productId ?? 'PAXG-USD',
    symbol: overrides.symbol ?? 'PAXG',
    assetId: overrides.assetId ?? 'pax-gold',
    side: overrides.side ?? 'BUY',
    price: overrides.price ?? 100,
    units: overrides.units ?? 1,
    notionalUsd: overrides.notionalUsd ?? (overrides.price ?? 100) * (overrides.units ?? 1),
    feeBps: overrides.feeBps ?? 0,
    feeUsd: overrides.feeUsd ?? 0,
    exchange: overrides.exchange ?? 'coinbase',
    reason: overrides.reason,
  };
}

describe('feeBpsForExchange', () => {
  it('maps exchanges to preset bps', () => {
    expect(feeBpsForExchange('coinbase')).toBe(60);
    expect(feeBpsForExchange('kraken')).toBe(26);
  });
});

describe('estimateFeeUsd', () => {
  it('computes bps of notional', () => {
    expect(estimateFeeUsd(1000, 60)).toBeCloseTo(6);
    expect(estimateFeeUsd(1000, 26)).toBeCloseTo(2.6);
  });
  it('never returns negative', () => {
    expect(estimateFeeUsd(-500, 60)).toBe(0);
  });
});

describe('baseSymbolFromProductId', () => {
  it('extracts and uppercases the base ticker', () => {
    expect(baseSymbolFromProductId('PAXG-USD')).toBe('PAXG');
    expect(baseSymbolFromProductId('btc-usd')).toBe('BTC');
    expect(baseSymbolFromProductId('XAUT')).toBe('XAUT');
  });
});

describe('buildPaperFill', () => {
  it('always stamps mode paper and computes notional + fee', () => {
    const f = buildPaperFill({
      suggestion: { id: 's1', type: 'arb', action: 'BUY PAXG', productId: 'PAXG-USD', side: 'BUY' },
      units: 2,
      price: 1000,
      exchange: 'coinbase',
      now: 1000,
    });
    expect(f.mode).toBe('paper');
    expect(f.symbol).toBe('PAXG');
    expect(f.assetId).toBe('pax-gold');
    expect(f.notionalUsd).toBe(2000);
    expect(f.feeBps).toBe(60);
    expect(f.feeUsd).toBeCloseTo(12);
  });

  it('clamps invalid units/price to zero instead of NaN', () => {
    const f = buildPaperFill({
      suggestion: { id: 's', type: 'arb', action: 'x', productId: 'BTC-USD', side: 'SELL' },
      units: NaN,
      price: -5,
      exchange: 'kraken',
    });
    expect(f.units).toBe(0);
    expect(f.price).toBe(0);
    expect(f.notionalUsd).toBe(0);
    expect(f.feeUsd).toBe(0);
  });
});

describe('summarizePaperLedger', () => {
  it('books realized P&L on a round trip net of fees', () => {
    const fills = [
      fill({ side: 'BUY', units: 1, price: 100, feeUsd: 1, timestamp: 1 }),
      fill({ side: 'SELL', units: 1, price: 120, feeUsd: 1, timestamp: 2 }),
    ];
    const s = summarizePaperLedger(fills);
    // avgCost = (100 + 1)/1 = 101; realized = 1*(120-101) - 1 = 18
    expect(s.realizedPnl).toBeCloseTo(18);
    expect(s.totalFees).toBeCloseTo(2);
    expect(s.fillCount).toBe(2);
    expect(s.positions[0].units).toBe(0);
  });

  it('tracks open units and unrealized P&L against current prices', () => {
    const fills = [fill({ side: 'BUY', units: 2, price: 100, feeUsd: 0, timestamp: 1 })];
    const s = summarizePaperLedger(fills, { 'pax-gold': 130 });
    expect(s.positions[0].units).toBe(2);
    expect(s.positions[0].avgCost).toBeCloseTo(100);
    expect(s.unrealizedPnl).toBeCloseTo(60);
  });

  it('returns zero unrealized when no prices supplied', () => {
    const fills = [fill({ side: 'BUY', units: 2, price: 100, timestamp: 1 })];
    expect(summarizePaperLedger(fills).unrealizedPnl).toBe(0);
  });

  it('processes fills chronologically regardless of input order', () => {
    const fills = [
      fill({ side: 'SELL', units: 1, price: 120, timestamp: 2 }),
      fill({ side: 'BUY', units: 1, price: 100, timestamp: 1 }),
    ];
    const s = summarizePaperLedger(fills);
    expect(s.realizedPnl).toBeCloseTo(20);
  });
});

describe('paperEquityCurve', () => {
  it('is empty for no fills', () => {
    expect(paperEquityCurve([])).toEqual([]);
  });

  it('accumulates realized P&L per fill', () => {
    const fills = [
      fill({ side: 'BUY', units: 1, price: 100, feeUsd: 0, timestamp: 1 }),
      fill({ side: 'SELL', units: 1, price: 110, feeUsd: 0, timestamp: 2 }),
    ];
    const curve = paperEquityCurve(fills);
    expect(curve).toHaveLength(2);
    expect(curve[0].value).toBe(0); // buy with no fee: no realized change
    expect(curve[1].value).toBeCloseTo(10);
  });
});

describe('paperFillsToCsv', () => {
  it('emits a header and one row per fill', () => {
    const csv = paperFillsToCsv([
      fill({ side: 'BUY', units: 1, price: 100, feeBps: 60, feeUsd: 0.6, timestamp: 1 }),
    ]);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('timestamp_iso');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('paper');
    expect(lines[1]).toContain('PAXG');
  });

  it('escapes commas and quotes in the action label', () => {
    const csv = paperFillsToCsv([fill({ action: 'BUY PAXG, SELL "XAUT"', timestamp: 1 })]);
    expect(csv).toContain('"BUY PAXG, SELL ""XAUT"""');
  });
});
