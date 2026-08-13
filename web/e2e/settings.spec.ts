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

    // Click dropdown menu item: View tracking snippet
    await page.click('text=View tracking snippet');

    // Verify dialog with snippet opens
    await expect(page.locator('text=Tracking snippet')).toBeVisible();
    await expect(page.locator('pre')).toContainText('data-website-id="web-123"');

    // Close dialog
    await page.keyboard.press('Escape');

    // Open menu again
    await page.click('button:has-text("Open menu")');

    // Click dropdown menu item: Edit
    await page.click('text=Edit');

    // Verify Edit website dialog opens
    await expect(page.locator('text=Edit website')).toBeVisible();
    const nameInput = page.locator('#settings-websites-edit-name');
    await expect(nameInput).toHaveValue("Jane's Portfolio");

    // Close edit dialog
    await page.click('button:has-text("Cancel")');

    // Open menu again
    await page.click('button:has-text("Open menu")');

    // Click dropdown menu item: Delete
    await page.click('text=Delete');

    // Verify Delete website dialog opens
    await expect(page.locator('text=Delete website?')).toBeVisible();
  });

});
