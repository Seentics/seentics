import { test, expect } from '@playwright/test';

/**
 * The Leads page on the demo site: every form's submissions on one list, and the contacts
 * behind them. Demo mode answers from lib/demo/leads, so no API mock is needed; writes are
 * refused by the demo guard, which is why this only reads.
 */
test.describe('Leads page (demo)', () => {
  test('shows people as a list, table or board, filters them, and opens one', async ({ page }) => {
    await page.goto('/websites/demo/leads');

    await expect(page.getByRole('heading', { level: 1, name: 'Leads' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /People/ })).toHaveAttribute('aria-selected', 'true');

    // List: grouped by status, the ones to act on first.
    await expect(page.getByRole('region', { name: 'Qualified' })).toBeVisible();

    // Table: one row per person; the layout is remembered on the next visit.
    await page.getByRole('button', { name: 'Table', exact: true }).click();
    const rows = page.locator('tbody tr');
    expect(await rows.count()).toBeGreaterThan(1);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Table', exact: true })).toHaveAttribute('aria-pressed', 'true');

    // Filters as Attio has them: pick a field and a value; the chip removes it.
    await page.getByRole('button', { name: 'Filter' }).click();
    await page.getByRole('menuitem', { name: 'Status' }).hover();
    await page.getByRole('menuitemradio', { name: 'Customer' }).click();
    const chip = page.getByRole('button', { name: 'Remove filter: Status is Customer' });
    await expect(chip).toBeVisible();
    await expect(page.getByRole('combobox', { name: /^Status of / }).first()).toContainText('Customer');
    await chip.click();
    await expect(chip).toHaveCount(0);

    // Board: a column per status.
    await page.getByRole('button', { name: 'Board', exact: true }).click();
    await expect(page.getByRole('region', { name: 'New' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Customer' })).toBeVisible();

    // Opening a person shows the drawer with their form submissions.
    await page.getByRole('button', { name: 'Table', exact: true }).click();
    const firstEmail = (await rows.first().getByText(/@example\.com/).first().textContent())!.trim();
    await rows.first().getByText(firstEmail, { exact: true }).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByRole('heading', { name: firstEmail })).toBeVisible();
    await expect(drawer.getByText(/Form submissions/)).toBeVisible();
    await expect(page).toHaveURL(/contact=/);
  });

  test('lists every form\'s submissions', async ({ page }) => {
    await page.goto('/websites/demo/leads');
    await page.getByRole('tab', { name: /Submissions/ }).click();
    await expect(page).toHaveURL(/tab=submissions/);
    await expect(page.getByRole('button', { name: /^Remove filter: Date is/ })).toBeVisible();
    expect(await page.locator('tbody tr').count()).toBeGreaterThan(1);
  });

  test('is in the sidebar, right after Automations', async ({ page }) => {
    await page.goto('/websites/demo');
    const labels = await page.locator('aside nav a').allInnerTexts();
    const i = labels.findIndex((l) => l.trim() === 'Automations');
    expect(labels[i + 1]?.trim()).toBe('Leads');
  });
});
