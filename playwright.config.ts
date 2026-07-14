import { defineConfig } from '@playwright/test';

/**
 * Playwright smoke E2E config (issue #36).
 *
 * - Serves a production build via `vite preview` so tests run against the same
 *   code-split bundle CI ships.
 * - External market APIs (CoinGecko / MetalPrice / allorigins) are blocked per
 *   test in `e2e/fixtures.ts`, so runs are deterministic and never hit live
 *   services — the app falls back to its built-in mock data.
 * - Screenshot baselines are intentionally NOT enabled by default (the glass UI
 *   uses random mock sparklines); we capture screenshots/traces only on failure.
 */
const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['github'], ['list'], ['html', { open: 'never' }]]
    : [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      // Bundled Chromium (no `channel`) so CI and the sandbox both use the
      // Playwright-managed browser rather than a system Chrome install.
      use: { browserName: 'chromium', viewport: { width: 1280, height: 900 } },
    },
  ],

  webServer: {
    // Self-contained: build then preview, so the job needs no separate build step.
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
