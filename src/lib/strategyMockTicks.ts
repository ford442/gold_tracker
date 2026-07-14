import type { BacktestTick } from '@lib/strategyEngine';

function randn(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

const BASE_PRICES: Record<string, number> = {
  'pax-gold': 3280.5,
  'tether-gold': 3284.2,
  bitcoin: 97450,
  ethereum: 3850,
};

export const MOCK_TICK_COUNT = 720;

export function generateMockTicks(
  strategyType: 'arbitrage' | 'mean-reversion',
  mrAsset: string,
): BacktestTick[] {
  const now = Date.now();
  const ticks: BacktestTick[] = [];

  if (strategyType === 'arbitrage') {
    let paxg = BASE_PRICES['pax-gold'];
    let xaut = BASE_PRICES['tether-gold'];

    for (let i = 0; i < MOCK_TICK_COUNT; i++) {
      const timestamp = now - (MOCK_TICK_COUNT - i) * 3_600_000;
      paxg *= Math.exp(0.0001 + 0.003 * randn());
      const isSpreadEvent = Math.random() < 0.08;
      const noise = isSpreadEvent ? randn() * 0.012 : randn() * 0.0015;
      xaut = paxg * (1 + noise);

      ticks.push({
        timestamp,
        prices: {
          'pax-gold': parseFloat(paxg.toFixed(4)),
          'tether-gold': parseFloat(xaut.toFixed(4)),
        },
      });
    }
  } else {
    const asset = mrAsset;
    const mu = BASE_PRICES[asset] ?? 10_000;
    const theta = 0.03;
    const sigma = mu * 0.008;
    let price = mu;

    for (let i = 0; i < MOCK_TICK_COUNT; i++) {
      const timestamp = now - (MOCK_TICK_COUNT - i) * 3_600_000;
      price = price + theta * (mu - price) + sigma * randn();
      price = Math.max(price, mu * 0.5);

      ticks.push({
        timestamp,
        prices: { [asset]: parseFloat(price.toFixed(4)) },
      });
    }
  }

  return ticks;
}

export function downsampleEquityCurve<T>(curve: T[], maxPoints = 200): T[] {
  if (curve.length <= maxPoints) return curve;
  const step = Math.ceil(curve.length / maxPoints);
  return curve.filter((_, i) => i % step === 0 || i === curve.length - 1);
}
