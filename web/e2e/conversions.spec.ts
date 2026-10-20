import { test, expect } from '@playwright/test';

/**
 * The Conversions page on the demo site: connected platforms, the period's figures and the events
 * sent. Demo mode answers from lib/demo/conversions, so no API mock is needed; writes are refused
 * by the demo guard, which is why this only opens the connect dialog rather than connecting.
 */
test.describe('Conversions page (demo)', () => {
  test('shows the connected platforms, then every conversion in a table with a tab per status', async ({ page }) => {
    await page.goto('/websites/demo/conversions');

    await expect(page.getByRole('heading', { level: 1, name: 'Conversions' })).toBeVisible();
    await expect(page.getByRole('article', { name: /^Meta/ })).toBeVisible();
    await expect(page.getByRole('article', { name: /^Google Analytics 4/ })).toBeVisible();
    await expect(page.getByRole('article', { name: /^TikTok/ })).toBeVisible();
    await expect(page.getByRole('article', { name: /^LinkedIn/ })).toBeVisible();

    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(5);

    // The Failed tab narrows the table to failures, each with a retry.
    await page.getByRole('tab', { name: 'Failed' }).click();
    await expect(page.getByRole('tab', { name: 'Failed' })).toHaveAttribute('aria-selected', 'true');
    await expect(rows.first()).toContainText('Failed');
    await expect(rows.first().getByRole('button', { name: 'Retry' })).toBeVisible();
    for (const row of await rows.all()) await expect(row).toContainText('Failed');
  });

  test('opens the connect dialog for Meta, asking for the pixel and token', async ({ page }) => {
    await page.goto('/websites/demo/conversions');
    await page.getByRole('button', { name: 'Connect platform' }).click();
    await page.getByRole('menuitem', { name: /Meta/ }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Connect Meta' })).toBeVisible();
    await expect(dialog.getByLabel('Pixel ID')).toBeVisible();
    await expect(dialog.getByLabel('Conversions API access token')).toBeVisible();
    // Continue stays off until the pixel id looks like one.
    await expect(dialog.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await dialog.getByLabel('Pixel ID').fill('104851239920392');
    await dialog.getByLabel('Conversions API access token').fill('EAAtest');
    await dialog.getByRole('button', { name: 'Continue' }).click();
    await expect(dialog.getByText('Step 2 of 2')).toBeVisible();
    await expect(dialog.getByLabel('Purchase is sent as')).toHaveValue('Purchase');
  });

  test('connects LinkedIn by ad account, with each event sent to a conversion rule', async ({ page }) => {
    await page.goto('/websites/demo/conversions');
    await page.getByRole('button', { name: 'Connect platform' }).click();
    await page.getByRole('menuitem', { name: /LinkedIn/ }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Connect LinkedIn' })).toBeVisible();
    await dialog.getByLabel('Ad account ID').fill('512345678');
    await dialog.getByLabel('Access token').fill('AQXtesttoken');
    await dialog.getByRole('button', { name: 'Continue' }).click();
    // No standard names: every kind starts off, and switching one on asks for a rule id.
    await expect(dialog.getByRole('switch', { name: 'Send purchase events' })).not.toBeChecked();
    await dialog.getByRole('switch', { name: 'Send purchase events' }).click();
    await expect(dialog.getByLabel('Purchase is sent as')).toHaveAttribute('placeholder', 'Conversion rule ID');
  });

  test('is in the sidebar, right after Revenue', async ({ page }) => {
    await page.goto('/websites/demo');
    const labels = await page.locator('aside nav a').allInnerTexts();
    const i = labels.findIndex((l) => l.trim() === 'Revenue');
    expect(labels[i + 1]?.trim()).toBe('Conversions');
  });
});
