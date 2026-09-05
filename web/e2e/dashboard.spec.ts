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

    // The onboarding heading is an h3, and the placeholders are "My site" /
    // "example.com" now — the old `h1` and "My Portfolio" locators matched nothing and
    // timed out for 30s each.
    await expect(page.getByRole('heading', { name: 'Add your website' })).toBeVisible();

    // By label, so a future placeholder change does not break this again.
    await page.getByLabel('Website name').fill('Test Company Website');
    await page.getByLabel('Website domain').fill('testcompany.com');

    await page.getByRole('button', { name: /add website/i }).click();

    // The snippet phase, carrying the id the API just issued.
    await expect(page.locator('pre')).toContainText('web-999');
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

    /**
     * The dashboard payload is snake_case, with the summary figures mirrored at the top
     * level, under `metrics`, and under `comparison.current_period` — see
     * `SummaryCards.test.tsx`, which pins that three-way shape.
     *
     * The old mock sent camelCase (`visitors`, `bounceRate`) and put the breakdowns
     * inside this same payload, so every tile rendered zero and the breakdown tables
     * were empty.
     */
    await page.route('**/api/v1/analytics/dashboard/web-123*', async (route) => {
      const summary = {
        total_visitors: 1250,
        unique_visitors: 1250,
        sessions: 980,
        page_views: 4200,
        bounce_rate: 42.5,
        avg_session_time: 184,
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          website_id: 'web-123',
          date_range: '7d',
          ...summary,
          live_visitors: 12,
          session_duration: 184,
          metrics: summary,
          comparison: {
            current_period: summary,
            previous_period: {
              total_visitors: 1000,
              unique_visitors: 1000,
              sessions: 800,
              page_views: 3500,
              bounce_rate: 50,
              avg_session_time: 200,
            },
          },
        }),
      });
    });

    // Breakdowns come from `dimensions-bulk`, not from the dashboard payload.
    await page.route('**/api/v1/analytics/dimensions-bulk/web-123*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          website_id: 'web-123',
          date_range: '7d',
          top_pages: [
            { page: '/', views: 500, unique: 400 },
            { page: '/pricing', views: 300, unique: 250 },
          ],
          top_referrers: [
            { referrer: 'google.com', views: 400, unique: 350 },
            { referrer: 'direct', views: 350, unique: 300 },
          ],
          top_countries: [
            { country: 'US', views: 550, unique: 500 },
            { country: 'GB', views: 120, unique: 100 },
          ],
          top_browsers: [{ browser: 'Chrome', views: 700, unique: 600 }],
          top_devices: [
            { device: 'desktop', views: 600, unique: 520 },
            { device: 'mobile', views: 380, unique: 330 },
          ],
          top_os: [{ os: 'macOS', views: 400, unique: 350 }],
        }),
      });
    });

    await page.goto('/websites');

    // Should automatically redirect to /websites/web-123
    await expect(page).toHaveURL(/\/websites\/web-123/);

    // Each figure asserted inside its own tile. A bare `text=980` is a page-wide
    // substring match and collides with any other element containing those digits.
    const tile = (label: string) =>
      page.getByText(label, { exact: true }).locator('xpath=ancestor::div[contains(@class,"group")][1]');

    // Thousands are comma-grouped, not abbreviated — the old assertion looked for
    // "1.2K" and would never have matched.
    await expect(tile('Unique Visitors')).toContainText('1,250', { timeout: 10000 });
    await expect(tile('Page Views')).toContainText('4,200');
    await expect(tile('Bounce Rate')).toContainText('42.5%');
    // 184 seconds, rendered.
    await expect(tile('Session Duration')).toContainText('3m 4s');

    // The tile labelled "Total visitors" shows the *sessions* figure (980), not a
    // visitor count — the mock sends `sessions: 980` and `total_visitors: 1250`.
    // Asserting the number that is actually displayed rather than the one the label
    // implies; the label looks wrong, and this is where that shows up.
    await expect(tile('Total visitors')).toContainText('980');

    // The tile also renders the period-over-period delta, which is what makes
    // `comparison.previous_period` load-bearing in the mock above: 1250 vs 1000.
    await expect(tile('Unique Visitors')).toContainText('25.0%');

    // Breakdowns, from `dimensions-bulk` — a different endpoint from the summary.
    await expect(page.getByText('/pricing').first()).toBeVisible();

    // Referrer hosts are shown under their display name, so `google.com` in the
    // response renders as "Google". The old assertion looked for the raw host.
    await expect(page.getByText('Google', { exact: true }).first()).toBeVisible();
  });

});
