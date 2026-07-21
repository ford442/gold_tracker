import { test, expect, gotoSection } from './fixtures';

test.describe('markets — global arbitrage monitor', () => {
  test('shows cross-venue quote table with mock fixtures', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/');
    await gotoSection(page, '5');

    await expect(page.getByRole('heading', { name: 'Global Arbitrage Monitor' })).toBeVisible();

    await expect(page.getByRole('columnheader', { name: 'Venue' })).toBeVisible();
    await expect(page.getByRole('cell', { name: /Coinbase/i })).toBeVisible();
    await expect(page.getByRole('cell', { name: /Kraken/i })).toBeVisible();
    await expect(page.getByRole('cell', { name: /Gemini/i })).toBeVisible();

    await expect(page.getByText('MOCK', { exact: true }).first()).toBeVisible();

    const executeBtn = page.getByRole('button', { name: /DRY RUN ARB|EXECUTE ARB/i });
    await expect(executeBtn).toBeVisible();
    await expect(executeBtn).toBeEnabled();

    expect(errors, `unexpected page errors:\n${errors.join('\n')}`).toEqual([]);
  });
});
