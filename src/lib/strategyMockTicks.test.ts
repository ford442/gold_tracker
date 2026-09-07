import { describe, expect, it } from 'vitest';
import { generateMockTicks, MOCK_TICK_COUNT } from './strategyMockTicks';

describe('strategyMockTicks', () => {
  it('generates arbitrage ticks with PAXG and XAUT prices', () => {
    const ticks = generateMockTicks('arbitrage', 'bitcoin');
    expect(ticks).toHaveLength(MOCK_TICK_COUNT);
    expect(ticks[0].prices['pax-gold']).toBeGreaterThan(0);
    expect(ticks[0].prices['tether-gold']).toBeGreaterThan(0);
  });

  it('generates mean-reversion ticks for the selected asset', () => {
    const ticks = generateMockTicks('mean-reversion', 'bitcoin');
    expect(ticks).toHaveLength(MOCK_TICK_COUNT);
    expect(ticks[0].prices.bitcoin).toBeGreaterThan(0);
  });
});
