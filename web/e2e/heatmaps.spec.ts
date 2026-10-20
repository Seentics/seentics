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
    // `listHeatmapPages` calls `/heatmaps/:id/pages?days=N` and reads `res.data.pages`.
    // The glob ends in `*` because the range is always sent as a query string.
    await page.route('**/api/v1/heatmaps/web-123/pages*', async (route) => {
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
              // Enough views to judge, with two problems the line should name.
              dead_click_pct: 30,
              reach_half_pct: 40,
              mobile_avg_scroll: 60,
              desktop_avg_scroll: 70,
            },
            {
              // Under 100 views: too few to judge.
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

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Heatmaps');

    // Linear-style: grouped rows, the pages needing attention first. Views are clicks + scrolls.
    const attention = page.getByRole('region', { name: 'Needs attention' });
    const pricing = attention.getByRole('listitem').filter({ hasText: '/pricing' });
    await expect(pricing).toContainText('Pricing');
    await expect(pricing).toContainText('250');
    await expect(pricing).toContainText('30%');
    await expect(pricing).toContainText('Dead clicks');
    await expect(pricing).toContainText('30% of clicks hit things that do nothing');
    const blog = page.getByRole('region', { name: 'Not enough data' }).getByRole('listitem');
    await expect(blog).toContainText('/blog');

    // Narrow to the pages that need attention; the device switches the scroll column.
    await page.getByRole('tab', { name: 'Needs attention' }).click();
    await expect(page.getByRole('region', { name: 'Not enough data' })).toHaveCount(0);
    await expect(pricing).toContainText('70%');
    await page.getByRole('button', { name: 'Mobile' }).click();
    await expect(pricing).toContainText('60%');

    // Table: every figure side by side. Cards: each page with its heat, and a choice of overlay.
    await page.getByRole('button', { name: 'Table', exact: true }).click();
    await expect(page.getByRole('columnheader', { name: /Mobile vs desktop/ })).toBeVisible();
    await expect(page.locator('tbody tr').filter({ hasText: '/pricing' })).toContainText('30%');
    await page.getByRole('button', { name: 'Cards', exact: true }).click();
    await expect(page.getByRole('group', { name: 'Overlay' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open heatmap for /pricing' })).toBeVisible();
    await page.getByRole('button', { name: 'List', exact: true }).click();

    // A row opens that page's heatmap.
    await pricing.getByRole('button', { name: 'Open heatmap for /pricing' }).click();
    await expect(page).toHaveURL(/\/websites\/web-123\/heatmaps\/_pricing$/);
  });

  test('should load visual heatmap page and toggle view types', async ({ page }) => {
    /**
     * `getHeatmapData` reads `/heatmaps/:id/data?page_path&event_type&days` and expects
     * `{ points: HeatmapPoint[] }` — clicks as 0–10000 coordinates, scroll as a 0–100
     * depth. Answered per `event_type` so the toggle is seen to change what is asked for.
     */
    const requestedTypes: string[] = [];
    await page.route('**/api/v1/heatmaps/web-123/data?*', async (route) => {
      const url = new URL(route.request().url());
      const type = url.searchParams.get('event_type') ?? '';
      requestedTypes.push(type);
      expect(url.searchParams.get('page_path')).toBe('/pricing');
      const point = (extra: Record<string, unknown>) => ({
        page_path: '/pricing', device_type: 'desktop', target_selector: '', cap_vw: 1280, cap_vh: 720, ...extra,
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          page_path: '/pricing',
          points: type === 'scroll'
            ? [point({ event_type: 'scroll', x_percent: 0, y_percent: 80, intensity: 3 })]
            : [
                point({ event_type: 'click', x_percent: 2500, y_percent: 3500, intensity: 1 }),
                point({ event_type: 'click', x_percent: 6500, y_percent: 4500, intensity: 2 }),
              ],
        }),
      });
    });

    // No captured background yet (`{ layout: null }`), so the page offers heat only.
    await page.route('**/api/v1/heatmaps/web-123/layout-snapshot?*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ layout: null }) });
    });

    /**
     * The insights panel beside the heatmap reads `/heatmaps/:id/insights` →
     * `{ data: HeatmapInsights }`. Left to the catch-all's `{ data: null }` the panel
     * dereferences `null.analysis` and the whole page falls to the error boundary.
     */
    await page.route('**/api/v1/heatmaps/web-123/insights?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            analysis: {
              page_path: '/pricing', days: 30, device: 'all', sufficient: false,
              reason: 'Only 2 clicks so far — check back after more visits.',
              overall: null, devices: [], signals: [], limits: [],
            },
            insights: { source: 'rules', findings: [], generated_at: new Date().toISOString(), reason: null, retry_after_sec: null },
            ai_configured: false,
          },
        }),
      });
    });

    // The list links here with the path's slashes as underscores: "/pricing" → "_pricing".
    await page.goto('/websites/web-123/heatmaps/_pricing');

    const toolbar = page.getByRole('toolbar', { name: 'Heatmap' });
    await expect(toolbar.getByRole('button', { name: 'Heatmaps' })).toBeVisible();
    await expect(toolbar.locator('code')).toHaveText('/pricing');
    await expect(toolbar).toContainText('2 pts');

    // The insights panel says why it has nothing to say yet.
    const insights = page.getByRole('complementary', { name: 'Page insights' });
    await expect(insights.getByText('Not enough data yet')).toBeVisible();
    await expect(insights).toContainText('Only 2 clicks so far');

    // Clicks is the default view; switching to Scroll asks for scroll data and marks it active.
    const clicksButton = toolbar.getByRole('button', { name: 'Clicks' });
    const scrollButton = toolbar.getByRole('button', { name: 'Scroll' });
    await expect(clicksButton).toHaveClass(/bg-primary\/10/);
    await expect(scrollButton).not.toHaveClass(/bg-primary\/10/);

    await scrollButton.click();
    await expect(scrollButton).toHaveClass(/bg-primary\/10/);
    await expect(clicksButton).not.toHaveClass(/bg-primary\/10/);
    await expect.poll(() => requestedTypes).toContain('scroll');
    expect(requestedTypes[0]).toBe('click');
  });

});
