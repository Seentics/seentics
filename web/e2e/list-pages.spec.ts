import { test, expect } from '@playwright/test';

/**
 * The list pages built on the shared collection pieces (components/ui/collection), on the
 * demo site: each has the sort and filter toolbar, a layout switch, and its own layouts.
 * Demo mode answers from fixtures, so no API mock is needed.
 */
test.describe('List pages (demo)', () => {
  test('automations: grouped list, a table, and cards that show the popup', async ({ page }) => {
    await page.goto('/websites/demo/automations');
    await expect(page.getByRole('heading', { level: 1, name: 'Automations' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Working' })).toBeVisible();

    await page.getByRole('button', { name: 'Table', exact: true }).click();
    await expect(page.getByRole('columnheader', { name: /Trigger → action/ })).toBeVisible();

    await page.getByRole('button', { name: 'Cards', exact: true }).click();
    // The spin-to-win card draws the real popup from its stored definition.
    await expect(page.locator('.snc-overlay').first()).toBeAttached();

    await page.getByRole('button', { name: 'Filter' }).click();
    await page.getByRole('menuitem', { name: 'Status' }).hover();
    await page.getByRole('menuitemradio', { name: 'Switched off' }).click();
    await expect(page.getByRole('button', { name: 'Remove filter: Status is Switched off' })).toBeVisible();
    await expect(page.getByRole('switch', { name: /^Activate / })).toHaveCount(1);
  });

  test('errors: status tabs, trend groups, and a table', async ({ page }) => {
    await page.goto('/websites/demo/errors');
    await expect(page.getByRole('tab', { name: 'Unresolved' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('region', { name: 'New' })).toBeVisible();

    await page.getByRole('button', { name: 'Table', exact: true }).click();
    await expect(page.getByRole('columnheader', { name: /Occurrences/ })).toHaveAttribute('aria-sort', 'descending');

    // An error opens its detail, and the way back returns to the list.
    await page.locator('tbody tr').first().click();
    await page.getByRole('button', { name: 'All errors' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Errors' })).toBeVisible();
  });

  test('funnels: grouped by trend, a table, and cards with each funnel\'s shape', async ({ page }) => {
    await page.goto('/websites/demo/funnels');
    await expect(page.getByRole('heading', { level: 1, name: 'Funnels' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Getting worse' })).toBeVisible();

    await page.getByRole('button', { name: 'Table', exact: true }).click();
    await expect(page.getByRole('columnheader', { name: /Biggest drop/ })).toBeVisible();

    await page.getByRole('button', { name: 'Cards', exact: true }).click();
    await page.getByRole('button', { name: 'Main Conversion Path', exact: true }).click();
    await expect(page).toHaveURL(/\/websites\/demo\/funnels\/demo-funnel-1/);
  });
});
