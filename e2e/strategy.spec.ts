import { test, expect, gotoSection } from './fixtures';

test.describe('strategy dashboard', () => {
  test('runs a classic backtest without crashing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/');
    await gotoSection(page, '4');

    const runBtn = page.getByRole('button', { name: /Run back-test over 30 days/i });
    await expect(runBtn).toBeVisible();
    await runBtn.click();

    // The backtest results render. "Final Balance (net)" is unique to the
    // StrategyDashboard stat boxes (other panels in this section also show
    // "Max Drawdown"/"Win Rate"), so it's an unambiguous signal the run finished.
    await expect(page.getByText('Final Balance (net)', { exact: true })).toBeVisible();

    expect(errors, `unexpected page errors:\n${errors.join('\n')}`).toEqual([]);
  });
});
