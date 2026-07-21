import { test as base, expect } from '@playwright/test';

/**
 * Shared E2E fixtures.
 *
 * Blocks the external market APIs so the suite is deterministic and never
 * depends on live CoinGecko / MetalPrice (rate limits, downtime). The app is
 * designed to fall back to realistic mock data when these fail, which is exactly
 * the "full mock mode" the smoke tests target.
 */
const BLOCKED_HOSTS = [
  '**/api.coingecko.com/**',
  '**/api.metalpriceapi.com/**',
  '**/allorigins.win/**',
  '**/advanced-trade-ws.coinbase.com/**',
  '**/ws.kraken.com/**',
  '**/api.coinbase.com/**',
  '**/api.kraken.com/**',
  '**/api.gemini.com/**',
];

export const test = base.extend({
  page: async ({ page }, use) => {
    for (const glob of BLOCKED_HOSTS) {
      await page.route(glob, (route) => route.abort());
    }
    await use(page);
  },
});

export { expect };

/** Navigate to a section via its number-key shortcut and wait for the DOM to settle. */
export async function gotoSection(
  page: import('@playwright/test').Page,
  key: '1' | '2' | '3' | '4' | '5',
) {
  await page.locator('body').press(key);
}
