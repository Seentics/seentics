import { test, expect } from '@playwright/test';
import { mockGlobalApiRoutes, injectAuthState } from './helpers/mock-api';

test.describe('Website Settings E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    await injectAuthState(page);
    await mockGlobalApiRoutes(page);

    // Mock get websites list
    await page.route('**/user/websites', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'web-123',
              name: "Jane's Portfolio",
              url: 'https://janesite.com',
              site_id: 'web-123',
              created_at: new Date().toISOString(),
              is_verified: true,
            },
          ],
        }),
      });
    });
  });

  test('should load websites settings list, edit, view snippet, and delete dialogs', async ({ page }) => {
    await page.goto('/websites/web-123/settings/websites');

    // Verify title and description
    await expect(page.locator('h1')).toContainText('Websites');
    await expect(page.locator("text=Jane's Portfolio")).toBeVisible();
    await expect(page.locator('text=https://janesite.com')).toBeVisible();

    // Click dropdown menu trigger for actions
    await page.click('button:has-text("Open menu")');

    await page.getByRole('menuitem', { name: /tracking snippet/i }).click();

    // Scoped to the dialog. A bare `text=Tracking snippet` is a substring match that
    // resolves to three elements — the menu item, the dialog title and the description
    // — which is a strict-mode violation, not a pass.
    const snippetDialog = page.getByRole('dialog');
    await expect(snippetDialog).toBeVisible();
    await expect(snippetDialog.locator('pre')).toContainText('web-123');

    // Close dialog
    await page.keyboard.press('Escape');

    // Open menu again
    await page.click('button:has-text("Open menu")');

    // By menu-item role, so "Edit" cannot also match "Edit website" elsewhere on the
    // page — the substring selector resolved to several elements.
    await page.getByRole('menuitem', { name: /^Edit/ }).click();

    const editDialog = page.getByRole('dialog');
    await expect(editDialog).toBeVisible();
    await expect(page.locator('#settings-websites-edit-name')).toHaveValue("Jane's Portfolio");

    // Close edit dialog
    await page.click('button:has-text("Cancel")');

    // Open menu again
    await page.click('button:has-text("Open menu")');

    await page.getByRole('menuitem', { name: /^Delete/ }).click();

    await expect(page.getByRole('dialog')).toContainText('Delete website');
  });

});
