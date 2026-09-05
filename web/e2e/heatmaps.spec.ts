import { test, expect } from '@playwright/test';
import { mockGlobalApiRoutes, injectAuthState } from './helpers/mock-api';

test.describe('Heatmaps E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    await injectAuthState(page);
    await mockGlobalApiRoutes(page);

    // Mock getWebsites — needed by sidebar website switcher
    await page.route('**/user/websites', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: 'web-123', name: "Jane's Site", url: 'https://janesite.com', site_id: 'web-123' },
          ],
        }),
      });
    });
  });

  test('should display heatmaps list page', async ({ page }) => {
    // `listHeatmapPages` calls `/heatmaps/:id/pages` and reads `res.data.pages`.
    // This mock used to answer `/heatmaps/web-123` with a bare array, so it matched no
    // request and the client rendered an empty list.
    await page.route('**/heatmaps/web-123/pages', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          pages: [
            {
              page_path: '/pricing',
              click_count: 150,
              scroll_count: 100,
              avg_scroll: 65,
              last_seen: new Date().toISOString(),
            },
            {
              page_path: '/blog',
              click_count: 50,
              scroll_count: 40,
              avg_scroll: 80,
              last_seen: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.goto('/websites/web-123/heatmaps');

    // Check headers
    await expect(page.locator('h1')).toContainText('Heatmaps');

    // Check stats cards content
    await expect(page.locator('text=Total Views')).toBeVisible();

    // Check data table content
    await expect(page.locator('text=/pricing')).toBeVisible();
    await expect(page.locator('text=/blog')).toBeVisible();
  });

  test('should load visual heatmap page and toggle view types', async ({ page }) => {
    // Mock heatmap data API response
    await page.route('**/heatmaps/web-123/data*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          clicks: [
            { nx: 0.25, ny: 0.35, intensity: 1, device: 'desktop' },
            { nx: 0.65, ny: 0.45, intensity: 2, device: 'desktop' },
          ],
          scrolls: [],
        }),
      });
    });

    // Mock page screenshot existence check
    await page.route('**/heatmaps/web-123/playwright-screenshot*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          exists: true,
          screenshot: {
            image_url: 'https://seentics-replays.s3.amazonaws.com/mock-screenshot.jpg',
          },
        }),
      });
    });

    // The slug for "/pricing" is slugified as "pricing"
    await page.goto('/websites/web-123/heatmaps/pricing');

    // Expect the page title and breadcrumbs to load
    await expect(page.locator('text=Pricing')).toBeVisible();

    // Verify view mode toggles are visible (Clicks is active by default)
    const clicksButton = page.locator('button:has-text("Clicks")');
    await expect(clicksButton).toBeVisible();

    const scrollButton = page.locator('button:has-text("Scroll")');
    await expect(scrollButton).toBeVisible();

    // Toggle mode to scroll and verify the class or state updates
    await scrollButton.click();
    await expect(scrollButton).toHaveClass(/bg-background|bg-muted/);
  });

});
