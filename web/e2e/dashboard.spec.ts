import { test, expect } from '@playwright/test';
import { mockGlobalApiRoutes, injectAuthState } from './helpers/mock-api';

test.describe('Dashboard E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    await injectAuthState(page);
    await mockGlobalApiRoutes(page);
  });

  test('should show onboarding if the user has no websites', async ({ page }) => {
    // Mock getWebsites to return empty array
    await page.route('**/user/websites', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [] }),
        });
      } else {
        // POST — addWebsite
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              website: {
                id: 'web-999',
                site_id: 'web-999',
                name: 'Test Company Website',
                url: 'https://testcompany.com',
                is_verified: false,
              },
            },
          }),
        });
      }
    });

    await page.goto('/websites');

    // Should see onboarding page title
    await expect(page.locator('h1')).toContainText('Add your website');

    // Fill form to add website
    await page.fill('input[placeholder="My Portfolio"]', 'Test Company Website');
    await page.fill('input[placeholder="myportfolio.com"]', 'testcompany.com');

    await page.click('button[type="submit"]');

    // Should switch to snippet phase
    await expect(page.locator('h2')).toContainText('Install tracking code');
    await expect(page.locator('pre')).toContainText('data-website-id="web-999"');
  });

  test('should redirect to website dashboard if websites exist', async ({ page }) => {
    // Mock getWebsites to return a website
    await page.route('**/user/websites', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'web-123',
              name: "Jane's Site",
              url: 'https://janesite.com',
              site_id: 'web-123',
            },
          ],
        }),
      });
    });

    // Mock dashboard data endpoint
    await page.route('**/analytics/dashboard/web-123*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          visitors: 1250,
          sessions: 980,
          bounceRate: 42.5,
          avgDuration: 184,
          liveVisitors: 12,
          statsOverTime: [],
          topPages: [
            { path: '/', views: 500 },
            { path: '/pricing', views: 300 },
          ],
          referrers: [
            { referrer: 'google.com', count: 400 },
            { referrer: 'direct', count: 350 },
          ],
          devices: [
            { device: 'desktop', count: 600 },
            { device: 'mobile', count: 380 },
          ],
          countries: [
            { country: 'US', count: 550 },
            { country: 'GB', count: 120 },
          ],
        }),
      });
    });

    // Mock daily stats
    await page.route('**/analytics/daily-stats/web-123*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ stats: [] }),
      });
    });

    // Mock hourly stats
    await page.route('**/analytics/hourly-stats/web-123*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ stats: [] }),
      });
    });

    // Mock visitor insights
    await page.route('**/analytics/visitor-insights/web-123*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ insights: {} }),
      });
    });

    // Mock live visitors
    await page.route('**/analytics/live-visitors/web-123*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(12),
      });
    });

    // Mock heatmap screenshot check
    await page.route('**/heatmaps/web-123/playwright-screenshot*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ exists: false }),
      });
    });

    await page.goto('/websites');

    // Should automatically redirect to /websites/web-123
    await expect(page).toHaveURL(/\/websites\/web-123/);

    // Verify analytics components render statistics correctly
    await expect(page.locator('text=1.2K')).toBeVisible({ timeout: 10000 }); // visitors count
    await expect(page.locator('text=980')).toBeVisible(); // sessions count
    await expect(page.locator('text=42.5%')).toBeVisible(); // bounce rate

    // Verify breakdowns table content
    await expect(page.locator('text=google.com')).toBeVisible();
    await expect(page.locator('text=/pricing')).toBeVisible();
  });

});
