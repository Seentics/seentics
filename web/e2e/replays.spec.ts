import { test, expect } from '@playwright/test';
import { mockGlobalApiRoutes, injectAuthState } from './helpers/mock-api';

test.describe('Session Replays E2E Tests', () => {

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

  test('should display session replays list', async ({ page }) => {
    /**
     * `listSessions` calls `/replays/:id` with `?limit&offset`, and reads camelCase
     * `ReplaySession` fields.
     *
     * The previous mock matched on `/replays\/web-123$/`, which the query string means
     * never matches — so it fell through to `route.continue()`, hit a backend that is
     * not running, and the page bounced to /signin. It also returned snake_case rows the
     * client does not read.
     */
    await page.route('**/replays/web-123?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sessions: [
            {
              sessionId: 'sess-abc-123',
              websiteId: 'web-123',
              country: 'US',
              browser: 'Chrome',
              os: 'macOS',
              device: 'desktop',
              entryPage: '/pricing',
              durationSeconds: 145,
              pagesViewed: 3,
              hasErrors: true,
              hasRageClicks: false,
              startedAt: new Date().toISOString(),
            },
            {
              sessionId: 'sess-xyz-987',
              websiteId: 'web-123',
              country: 'GB',
              browser: 'Safari',
              os: 'iOS',
              device: 'mobile',
              entryPage: '/blog/news',
              durationSeconds: 45,
              pagesViewed: 1,
              hasErrors: false,
              hasRageClicks: true,
              startedAt: new Date().toISOString(),
            },
            {
              // Analysed by core: its own one-line summary wins over the ingest flags.
              sessionId: 'sess-ana-555',
              websiteId: 'web-123',
              country: 'DE',
              browser: 'Firefox',
              os: 'Linux',
              device: 'desktop',
              entryPage: '/checkout',
              durationSeconds: 300,
              pagesViewed: 4,
              hasErrors: false,
              hasRageClicks: false,
              frustrationScore: 72,
              signalCounts: { form_abandon: 1 },
              summary: 'Started the checkout form and left at the shipping step',
              startedAt: new Date().toISOString(),
            },
          ],
          limit: 20,
          offset: 0,
          total: 3,
          summary: {
            total: 3,
            withErrors: 1,
            withRageClicks: 1,
            avgDurationSeconds: 163,
            groups: { errors: 1, rage: 1, forms: 1 },
          },
        }),
      });
    });

    await page.goto('/websites/web-123/replays');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Session replays');

    // Linear-style: one line per session, grouped, the ones that need a look first.
    const rows = page.getByRole('listitem');
    const pricing = rows.filter({ hasText: '/pricing' });
    const blog = rows.filter({ hasText: 'Rage-clicked' });
    const checkout = rows.filter({ hasText: 'shipping step' });
    await expect(page.getByRole('region', { name: 'Needs a look' })).toContainText('Hit an error · 3 pages from /pricing');
    await expect(page.getByText('3 sessions', { exact: true })).toBeVisible();

    // Location and the duration rendered rather than raw seconds.
    await expect(pricing).toContainText('US');
    await expect(pricing).toContainText('2m 25s');
    await expect(blog).toContainText('GB');
    await expect(blog).toContainText('0m 45s');

    // The labels: the ingest flags until a session is analysed, then core's summary.
    await expect(pricing).toContainText('JS error');
    await expect(blog).toContainText('Rage clicks');
    await expect(checkout).toContainText('Started the checkout form and left at the shipping step');
    await expect(checkout).toContainText('Abandoned form');

    // The Filter menu narrows by device; the chip removes it.
    await page.getByRole('button', { name: 'Filter' }).click();
    await page.getByRole('menuitem', { name: 'Device' }).hover();
    await page.getByRole('menuitemradio', { name: 'Mobile' }).click();
    const chip = page.getByRole('button', { name: 'Remove filter: Device is Mobile' });
    await expect(chip).toBeVisible();
    await chip.click();
    await expect(chip).toHaveCount(0);

    // Sorting newest first; the table layout shows every field.
    await page.getByRole('button', { name: /Sorted by/ }).click();
    await page.getByRole('menuitemradio', { name: 'Newest first' }).click();
    await expect(page.getByRole('button', { name: /Sorted by\s*Newest first/ })).toBeVisible();
    await page.getByRole('button', { name: 'Table', exact: true }).click();
    await expect(page.getByRole('columnheader', { name: /Entry page/ })).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(3);
    await page.getByRole('button', { name: 'List', exact: true }).click();

    // Watch opens the player for that session.
    await blog.hover();
    await blog.getByRole('button', { name: 'Watch replay' }).click();
    await expect(page).toHaveURL(/\/websites\/web-123\/replays\/sess-xyz-987$/);
  });

  test('should open replay player page and show player content', async ({ page }) => {
    // Mock getSessionApiResponse to return session metadata
    await page.route('**/replays/web-123/sess-abc-123', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          meta: {
            id: 'session-001',
            session_id: 'sess-abc-123',
            country: 'US',
            browser: 'Chrome',
            os: 'macOS',
            device: 'desktop',
            entry_page: '/pricing',
            duration_seconds: 145,
            pages_viewed: 3,
            has_errors: false,
            has_rage_clicks: false,
            start_time: new Date().toISOString(),
          },
          replay_chunk_urls: [],
          recording_pending: false,
        }),
      });
    });

    await page.goto('/websites/web-123/replays/sess-abc-123');

    // Should load the page and render player elements
    await expect(page.locator('span:has-text("sess-abc-123")')).toBeVisible();

    // Since there are no chunks, it should show "No recording for this session"
    await expect(page.locator('text=No recording for this session')).toBeVisible();
  });

});
