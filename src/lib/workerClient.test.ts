import { describe, it, expect } from 'vitest';
import { dispatchRunBacktest, dispatchRollingCorrelations } from './analyticsDispatch';
import { runBacktestAsync, rollingCorrelationsAsync } from './workerClient';
import {
  rebalPayload,
  ROLLING_CLIENT_A,
  ROLLING_CLIENT_B,
  ROLLING_CLIENT_WINDOW,
  stripTradeIds,
} from './analyticsFixtures';

describe('workerClient main-thread fallback', () => {
  it('runBacktestAsync with forceMainThread matches dispatch', async () => {
    const payload = rebalPayload();
    const dispatched = dispatchRunBacktest(payload);
    const viaClient = await runBacktestAsync(payload, { forceMainThread: true });
    expect(stripTradeIds(viaClient)).toEqual(stripTradeIds(dispatched));
  });

  it('rollingCorrelationsAsync with forceMainThread matches dispatch', async () => {
    const dispatched = dispatchRollingCorrelations({
      seriesA: ROLLING_CLIENT_A,
      seriesB: ROLLING_CLIENT_B,
      window: ROLLING_CLIENT_WINDOW,
    });
    const viaClient = await rollingCorrelationsAsync(
      { seriesA: ROLLING_CLIENT_A, seriesB: ROLLING_CLIENT_B, window: ROLLING_CLIENT_WINDOW },
      { forceMainThread: true },
    );
    expect(viaClient).toEqual(dispatched);
  });
});
