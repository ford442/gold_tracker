import { describe, it, expect } from 'vitest';
import { dispatchRunBacktest, dispatchRollingCorrelations } from './analyticsDispatch';
import { rollingCorrelations } from './regime';
import {
  arbPayload,
  directArb,
  directHold,
  directMr,
  directRebal,
  directRegimeArb,
  holdPayload,
  mrPayload,
  rebalPayload,
  regimeArbPayload,
  ROLLING_SERIES_A,
  ROLLING_SERIES_B,
  ROLLING_WINDOW,
  stripTradeIds,
} from './analyticsFixtures';

function expectBacktestParity(
  a: ReturnType<typeof dispatchRunBacktest>,
  b: ReturnType<typeof dispatchRunBacktest>,
) {
  expect(stripTradeIds(a)).toEqual(stripTradeIds(b));
}

describe('dispatchRunBacktest', () => {
  it('matches direct runBacktest for arbitrage', () => {
    expectBacktestParity(dispatchRunBacktest(arbPayload()), directArb());
  });

  it('matches direct runBacktest for mean reversion', () => {
    expectBacktestParity(dispatchRunBacktest(mrPayload()), directMr());
  });

  it('matches direct runBacktest for scenario lab rebalancer + hold', () => {
    expectBacktestParity(dispatchRunBacktest(rebalPayload()), directRebal());
    expectBacktestParity(dispatchRunBacktest(holdPayload()), directHold());
  });

  it('matches direct runBacktest with regime gate config', () => {
    expectBacktestParity(dispatchRunBacktest(regimeArbPayload()), directRegimeArb());
  });
});

describe('dispatchRollingCorrelations', () => {
  it('matches direct rollingCorrelations', () => {
    const direct = rollingCorrelations(ROLLING_SERIES_A, ROLLING_SERIES_B, ROLLING_WINDOW);
    const dispatched = dispatchRollingCorrelations({
      seriesA: ROLLING_SERIES_A,
      seriesB: ROLLING_SERIES_B,
      window: ROLLING_WINDOW,
    });
    expect(dispatched).toEqual(direct);
  });
});
