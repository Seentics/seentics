import { test, expect } from '@playwright/test';

/**
 * The Leads page on the demo site: every form's submissions on one list, and the contacts
 * behind them. Demo mode answers from lib/demo/leads, so no API mock is needed; writes are
 * refused by the demo guard, which is why this only reads.
 */
test.describe('Leads page (demo)', () => {
  test('lists submissions, switches to contacts, and opens a contact', async ({ page }) => {
    await page.goto('/websites/demo/leads');

    await expect(page.getByRole('heading', { level: 1, name: 'Leads' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Submissions/ })).toHaveAttribute('aria-selected', 'true');
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(1);

    await page.getByRole('tab', { name: /Contacts/ }).click();
    await expect(page).toHaveURL(/tab=contacts/);
    await expect(page.getByRole('group', { name: 'Filter by status' })).toBeVisible();

    // Opening a contact by its email shows the drawer with their form submissions.
    const firstEmail = (await page.locator('tbody tr').first().getByText(/@example\.com/).first().textContent())!.trim();
    await page.getByText(firstEmail, { exact: true }).first().click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByRole('heading', { name: firstEmail })).toBeVisible();
    await expect(drawer.getByText(/Form submissions/)).toBeVisible();
    await expect(page).toHaveURL(/contact=/);
  });

  test('is in the sidebar, right after Automations', async ({ page }) => {
    await page.goto('/websites/demo');
    const labels = await page.locator('aside nav a').allInnerTexts();
    const i = labels.findIndex((l) => l.trim() === 'Automations');
    expect(labels[i + 1]?.trim()).toBe('Leads');
  });
});
