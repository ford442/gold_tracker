import { test, expect, gotoSection } from './fixtures';

test.describe('app shell', () => {
  test('loads in mock mode with zero env', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/');

    // Header brand renders.
    await expect(page.getByText('GoldTrackr', { exact: true })).toBeVisible();
    await expect(page.getByRole('banner')).toBeVisible();
    // Overview mounts a price dashboard (mock data) — at least one price card.
    await expect(page.getByText('PAXG', { exact: false }).first()).toBeVisible();

    expect(errors, `unexpected page errors:\n${errors.join('\n')}`).toEqual([]);
  });
});

test.describe('theme toggle', () => {
  test('D key toggles light/dark and persists on the root element', async ({ page }) => {
    await page.goto('/');
    const root = page.locator('html');

    const startsLight = await root.evaluate((el) => el.classList.contains('light'));

    await page.locator('body').press('d');
    await expect
      .poll(() => root.evaluate((el) => el.classList.contains('light')))
      .toBe(!startsLight);

    await page.locator('body').press('d');
    await expect
      .poll(() => root.evaluate((el) => el.classList.contains('light')))
      .toBe(startsLight);
  });
});

test.describe('settings modal', () => {
  test('S key opens and closes the settings modal', async ({ page }) => {
    await page.goto('/');

    await page.locator('body').press('s');
    await expect(page.getByText('Trading Settings', { exact: false })).toBeVisible();

    await page.locator('body').press('s');
    await expect(page.getByText('Trading Settings', { exact: false })).toBeHidden();
  });
});

test.describe('section navigation', () => {
  const sections: Array<{ key: '1' | '2' | '3' | '4' | '5'; id: string }> = [
    { key: '2', id: 'analytics' },
    { key: '3', id: 'portfolio' },
    { key: '4', id: 'strategies' },
    { key: '5', id: 'markets' },
    { key: '1', id: 'overview' },
  ];

  test('number keys switch the active section shell', async ({ page }) => {
    await page.goto('/');
    for (const { key, id } of sections) {
      await gotoSection(page, key);
      // The <main> region carries the active section id.
      await expect(page.locator(`main#${id}`)).toBeVisible();
    }
  });
});
