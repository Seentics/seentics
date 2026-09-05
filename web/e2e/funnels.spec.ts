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
    /**
     * `fetchDashboardFunnelList` calls `/websites/:id/funnels`, not
     * `/analytics/:id/funnels` — the old path matched nothing, so the catch-all in
     * `mockGlobalApiRoutes` answered and the page rendered an empty list.
     *
     * The `/api/v1/` prefix is load-bearing: a bare `**\/websites/web-123/funnels*`
     * glob also matches the *page navigation* URL, and Playwright then serves this JSON
     * as the HTML document.
     *
     * The row shape is left as-is — `normalizeDashboardFunnelFromApi` accepts
     * snake_case and camelCase, and the fetcher unwraps a bare array, `{data:[…]}` or
     * `{funnels:[…]}`.
     */
    await page.route('**/api/v1/websites/web-123/funnels*', async (route) => {
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

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Funnels');

    // Scoped to the row. A bare `text=Active` also matches the "Active Funnels" stat
    // card, which is a strict-mode violation rather than a passing assertion.
    const row = page.getByRole('row').filter({ hasText: 'Checkout Flow' });
    await expect(row).toBeVisible();
    await expect(row).toContainText('2 steps');
    await expect(row).toContainText('Main sales funnel');
    await expect(row.getByRole('cell', { name: 'Active', exact: true })).toBeVisible();

    // The stat cards are derived from the list, so they are worth asserting too.
    await expect(page.getByText('1 funnel configured')).toBeVisible();
  });

  test('should show details page for a funnel', async ({ page }) => {
    // Mock get funnels list
    await page.route('**/api/v1/websites/web-123/funnels*', async (route) => {
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

    /**
     * `getDashboardFunnelAnalytics` reads `/websites/:id/funnels/:fid/stats` and
     * expects `FunnelStatsPayload` — `totalEntries` / `completions` / `stepBreakdown`.
     * The old mock answered `/analytics/.../analytics` with an `{analytics:[…]}`
     * envelope, which matched no request; the fetcher caught the resulting failure and
     * substituted an empty response, so the page rendered zeros.
     */
    await page.route('**/api/v1/websites/web-123/funnels/funnel-001/stats*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalEntries: 1000,
          completions: 250,
          conversionRate: 25,
          stepBreakdown: [
            { stepOrder: 1, count: 1000, dropoffCount: 750, dropoffRate: 75 },
            { stepOrder: 2, count: 250, dropoffCount: 0, dropoffRate: 0 },
          ],
        }),
      });
    });

    await page.goto('/websites/web-123/funnels/funnel-001');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Checkout Flow');
    await expect(page.getByText('Main sales funnel')).toBeVisible();

    // Each headline figure is asserted next to its own label. A bare `text=250` is a
    // substring match across the whole page, which is a strict-mode violation the
    // moment any other element contains those digits.
    // Two levels up from the label: the label sits in its own icon+text row, and the
    // card above that is what also holds the value.
    const stat = (label: string) =>
      page.getByText(label, { exact: true }).locator('..').locator('..');
    await expect(stat('Entered funnel')).toContainText('1,000');
    await expect(stat('Completed')).toContainText('250');
    await expect(stat('Conversion rate')).toContainText('25.0%');
    await expect(stat('Drop-off rate')).toContainText('75.0%');

    // The step list renders both steps, in definition order.
    const steps = page.getByRole('listitem');
    await expect(steps.filter({ hasText: 'Home' })).toBeVisible();
    await expect(steps.filter({ hasText: 'Cart' })).toBeVisible();

    // Deliberately not asserting per-step counts. With `stepBreakdown` starting at
    // `stepOrder: 1`, the page renders 0 against step 1 (Home) and 1,000 against step 2
    // (Cart) — the entry count lands one step late. That looks like an off-by-one in the
    // step-order mapping, and pinning it here would freeze it as correct. The headline
    // figures above come from `totalEntries`/`completions` and are right.
  });

  test('should open new funnel modal builder', async ({ page }) => {
    // Mock get funnels list
    await page.route('**/api/v1/websites/web-123/funnels*', async (route) => {
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
