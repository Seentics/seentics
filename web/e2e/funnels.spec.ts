import { test, expect } from '@playwright/test';
import { mockGlobalApiRoutes, injectAuthState } from './helpers/mock-api';

test.describe('Funnels E2E Tests', () => {

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

  test('should display funnels list page', async ({ page }) => {
    // Mock funnels API response
    await page.route('**/analytics/web-123/funnels', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'funnel-001',
            name: 'Checkout Flow',
            description: 'Main sales funnel',
            is_active: true,
            steps: [
              { id: '1', name: 'Home', type: 'pageview' },
              { id: '2', name: 'Cart', type: 'pageview' },
            ],
            created_at: new Date().toISOString(),
          },
        ]),
      });
    });

    await page.goto('/websites/web-123/funnels');

    // Verify header title
    await expect(page.locator('h1')).toContainText('Funnels');

    // Verify table shows the funnel
    await expect(page.locator('text=Checkout Flow')).toBeVisible();
    await expect(page.locator('text=2 steps')).toBeVisible();
    await expect(page.locator('text=Active')).toBeVisible();
  });

  test('should show details page for a funnel', async ({ page }) => {
    // Mock get funnels list
    await page.route('**/analytics/web-123/funnels', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'funnel-001',
            name: 'Checkout Flow',
            description: 'Main sales funnel',
            is_active: true,
            steps: [
              { id: '1', name: 'Home', type: 'pageview' },
              { id: '2', name: 'Cart', type: 'pageview' },
            ],
            created_at: new Date().toISOString(),
          },
        ]),
      });
    });

    // Mock funnel analytics endpoint
    await page.route('**/analytics/web-123/funnels/funnel-001/analytics*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          analytics: [
            {
              total_starts: 1000,
              total_conversions: 250,
              conversion_rate: 25.0,
              drop_off_rate: 75.0,
              step_metrics: [
                { step: 1, count: 1000, drop_off: 750, drop_off_rate: 75.0 },
                { step: 2, count: 250, drop_off: 0, drop_off_rate: 0.0 },
              ],
            },
          ],
        }),
      });
    });

    await page.goto('/websites/web-123/funnels/funnel-001');

    // Check title and details
    await expect(page.locator('h1')).toContainText('Checkout Flow');
    await expect(page.locator('text=Main sales funnel')).toBeVisible();

    // Check stats are rendered
    await expect(page.locator('text=1,000')).toBeVisible(); // entries
    await expect(page.locator('text=250')).toBeVisible(); // conversions
    await expect(page.locator('text=25.0%')).toBeVisible(); // completion rate
    await expect(page.locator('text=75.0%')).toBeVisible(); // drop-off rate

    // Verify visualization renders steps
    await expect(page.locator('text=Home')).toBeVisible();
    await expect(page.locator('text=Cart')).toBeVisible();
    await expect(page.locator('text=750 users dropped off')).toBeVisible();
  });

  test('should open new funnel modal builder', async ({ page }) => {
    // Mock get funnels list
    await page.route('**/analytics/web-123/funnels', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/websites/web-123/funnels');

    // Click on New Funnel button
    await page.click('button:has-text("New Funnel")');

    // Expect the modal dialog to be visible
    await expect(page.locator('text=Create New Funnel')).toBeVisible();
  });

});
