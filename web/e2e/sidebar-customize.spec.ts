import { test, expect } from '@playwright/test';

/** Hiding sidebar pages: kept across reloads, the open page always shown, Overview locked. */
test.describe('Sidebar customize (demo)', () => {
  const labels = (page: import('@playwright/test').Page) =>
    page.locator('aside nav a:visible').allInnerTexts().then((l) => l.map((s) => s.trim()));

  test('hides and brings back pages', async ({ page }) => {
    await page.goto('/websites/demo');
    await expect(page.locator('aside nav a:visible', { hasText: 'Heatmaps' })).toBeVisible();

    await page.getByRole('button', { name: 'Customize' }).click();
    const dialog = page.getByRole('dialog', { name: 'Customize sidebar' });
    await expect(dialog.getByRole('switch', { name: 'Show Overview in the sidebar' })).toBeDisabled();
    await dialog.getByRole('switch', { name: 'Show Heatmaps in the sidebar' }).click();
    await dialog.getByRole('switch', { name: 'Show Revenue in the sidebar' }).click();
    await expect(dialog.getByText('10 of 12 shown')).toBeVisible();
    await dialog.getByRole('button', { name: 'Done' }).click();

    expect(await labels(page)).not.toContain('Heatmaps');
    await expect(page.getByRole('button', { name: /Customize/ })).toContainText('2 hidden');

    await page.reload();
    expect(await labels(page)).not.toContain('Revenue');

    // A hidden page still opens, and shows in the sidebar while it is open.
    await page.goto('/websites/demo/revenue');
    expect(await labels(page)).toContain('Revenue');

    await page.getByRole('button', { name: /Customize/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Show all' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
    expect(await labels(page)).toContain('Heatmaps');
  });
});
