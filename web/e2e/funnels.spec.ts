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

  /** The list endpoint, as `fetchDashboardFunnelList` reads it (a bare array is accepted). */
  const checkoutFunnel = {
    id: 'funnel-001',
    name: 'Checkout Flow',
    description: 'Main sales funnel',
    is_active: true,
    steps: [
      { id: '1', name: 'Home', type: 'pageview' },
      { id: '2', name: 'Cart', type: 'pageview' },
    ],
    created_at: new Date().toISOString(),
  };

  /**
   * `useFunnelsAnalytics` reads every funnel's report in one request,
   * `/websites/:id/funnels/stats?days=N` → `{ data: { [funnelId]: FunnelStatsPayload } }`,
   * and asks twice: once for the period (31 days by default) and once for twice the
   * period, so that what is left over is the period before, for the trend.
   *
   * `stepBreakdown` is shaped exactly as core's `buildFunnelReport` produces it:
   * 0-based `stepOrder`, and each step's `dropoffRate` is the share of the previous step
   * that did not reach it.
   */
  async function mockFunnelStats(page: import('@playwright/test').Page) {
    await page.route('**/api/v1/websites/web-123/funnels/stats?*', async (route) => {
      const days = Number(new URL(route.request().url()).searchParams.get('days'));
      const doubled = days > 31;
      // This period: 250 of 1,000. Twice the period: 400 of 2,000 → the period before
      // converted 150 of 1,000 (15%).
      const entries = doubled ? 2000 : 1000;
      const completions = doubled ? 400 : 250;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            'funnel-001': {
              totalEntries: entries,
              completions,
              conversionRate: (completions / entries) * 100,
              stepBreakdown: [
                { stepOrder: 0, count: entries, dropoffCount: 0, dropoffRate: 0 },
                { stepOrder: 1, count: completions, dropoffCount: entries - completions, dropoffRate: ((entries - completions) / entries) * 100 },
              ],
            },
          },
        }),
      });
    });
  }

  test('should display funnels list page', async ({ page }) => {
    /**
     * `fetchDashboardFunnelList` calls `/websites/:id/funnels`, not
     * `/analytics/:id/funnels`.
     *
     * The `/api/v1/` prefix is load-bearing: a bare `**\/websites/web-123/funnels*`
     * glob also matches the *page navigation* URL, and Playwright then serves this JSON
     * as the HTML document. The `*` does not cross `/`, so `/funnels/stats` is left to
     * `mockFunnelStats`.
     */
    await page.route('**/api/v1/websites/web-123/funnels*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([checkoutFunnel]),
      });
    });
    await mockFunnelStats(page);

    await page.goto('/websites/web-123/funnels');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Funnels');

    // The table is the funnel and a plain-words "What happened" line — the old raw
    // Status/Steps/Conversion columns are gone.
    const table = page.getByRole('table');
    await expect(table.getByRole('columnheader', { name: 'What happened' })).toBeVisible();

    const row = page.getByRole('row').filter({ hasText: 'Checkout Flow' });
    await expect(row).toBeVisible();
    await expect(row).toContainText('2 steps');
    await expect(row).toContainText('Main sales funnel');
    // From this period's report, with the trend against the period before (150 of 1,000).
    await expect(row).toContainText('Converts 25% (250 of 1,000)');
    await expect(row).toContainText('up from 15%');

    // The stat cards are derived from the list and the reports.
    await expect(page.getByText('1 funnel configured')).toBeVisible();
    const stat = (label: string) => page.getByText(label, { exact: true }).locator('..').locator('..');
    await expect(stat('Active Funnels')).toContainText('1');
    await expect(stat('Avg. conversion')).toContainText('25.0%');

    // Below the table, the funnel is grouped by trend; opening a group lists it.
    await expect(page.getByRole('heading', { name: 'Funnels by trend' })).toBeVisible();
    const improving = page.getByRole('button', { name: /Improving/ });
    await expect(improving).toContainText('1');
    await improving.click();
    await expect(page.getByRole('button', { name: /^Checkout Flow — Converts 25%/ })).toBeVisible();
  });

  /**
   * core's `buildFunnelReport` gives each step the drop-off *into* it (step 0 is always 0%;
   * step 1 carries the 75% lost between Home and Cart). The list read it as the drop-off
   * out of each step, named "Home → Cart (0.0%)", and never put a 75%-loss funnel in "Big leak".
   */
  test('the funnel list names the biggest leak from core\'s step breakdown', async ({ page }) => {
    await page.route('**/api/v1/websites/web-123/funnels*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([checkoutFunnel]) });
    });
    await mockFunnelStats(page);

    await page.goto('/websites/web-123/funnels');

    const row = page.getByRole('row').filter({ hasText: 'Checkout Flow' });
    await expect(row).toContainText('most leave at Home → Cart (75%)');
    await expect(page.getByRole('button', { name: /Big leak/ })).toContainText('1');
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
            // 0-based, as core reports it; dropoff is the loss on the way into a step.
            { stepOrder: 0, count: 1000, dropoffCount: 0, dropoffRate: 0 },
            { stepOrder: 1, count: 250, dropoffCount: 750, dropoffRate: 75 },
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
    // One level up from the label: the figure that holds the label and its value.
    const stat = (label: string) =>
      page.getByText(label, { exact: true }).locator('..');
    await expect(stat('Entered funnel')).toContainText('1,000');
    await expect(stat('Completed')).toContainText('250');
    await expect(stat('Conversion rate')).toContainText('25.0%');
    await expect(stat('Drop-off rate')).toContainText('75.0%');

    // The steps: each step's own count, and between them the share that carried on.
    const step = (name: string) => page.getByRole('listitem').filter({ hasText: name });
    await expect(step('Home')).toContainText('1,000');
    await expect(step('Home')).toContainText('25.0% continued · 750 left');
    await expect(step('Cart')).toContainText('250');
  });

  test('should open new funnel modal builder', async ({ page }) => {
    await page.route('**/api/v1/websites/web-123/funnels*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
    // "New Funnel" is offered to members and up only (`usePermissions().canEdit`), and
    // the role is unknown — so nothing is offered — until `/my-role` answers. The
    // catch-all's `{data:null}` reads as no role.
    await page.route('**/api/v1/user/websites/web-123/my-role', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { role: 'member' } }),
      });
    });

    await page.goto('/websites/web-123/funnels');

    await page.getByRole('button', { name: 'New Funnel' }).click();

    // The builder opens in a side sheet (a dialog), titled "New funnel".
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('heading', { name: 'New funnel' })).toBeVisible();
    await expect(sheet.getByLabel('Name', { exact: true })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Add Step' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Create funnel' })).toBeVisible();

    // Cancel closes it without creating anything.
    await sheet.getByRole('button', { name: 'Cancel' }).click();
    await expect(sheet).toBeHidden();
  });

  test('should not offer New Funnel to a viewer', async ({ page }) => {
    await page.route('**/api/v1/websites/web-123/funnels*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/v1/user/websites/web-123/my-role', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { role: 'viewer' } }) });
    });

    await page.goto('/websites/web-123/funnels');

    await expect(page.getByText('0 funnels configured')).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Funnel' })).toHaveCount(0);
  });

});
