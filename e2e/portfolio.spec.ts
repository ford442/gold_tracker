import { test, expect, gotoSection } from './fixtures';

test.describe('portfolio', () => {
  test('add a demo position then remove it', async ({ page }) => {
    await page.goto('/');
    await gotoSection(page, '3');

    // Empty state first.
    await expect(page.getByText('No positions yet', { exact: false })).toBeVisible();

    // Seed the demo position (5 PAXG @ $3,200).
    await page.getByRole('button', { name: /Add Demo Position/i }).click();

    // Holdings table now has a PAXG row with a remove control.
    const removeBtn = page.getByRole('button', { name: 'Remove PAXG position' });
    await expect(removeBtn).toBeVisible();

    // Remove it → back to the empty state.
    await removeBtn.click();
    await expect(page.getByText('No positions yet', { exact: false })).toBeVisible();
  });

  test('add a position via the manual form', async ({ page }) => {
    await page.goto('/');
    await gotoSection(page, '3');

    await page.getByRole('button', { name: 'Add new position' }).click();
    await page.getByLabel('Amount').fill('1.5');
    await page.getByLabel('Buy price in USD').fill('3100');
    await page.getByRole('button', { name: 'Add position' }).click();

    // A remove control appears for the newly added holding.
    await expect(page.getByRole('button', { name: /Remove .* position/ })).toBeVisible();
  });
});
