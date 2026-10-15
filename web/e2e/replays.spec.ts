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
            // Per-group totals, counted by core, drive the "Session groups" card.
            groups: { errors: 1, rage: 1, forms: 1 },
          },
        }),
      });
    });

    await page.goto('/websites/web-123/replays');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Session Replays');

    // The table is Location, Duration, "What happened" and Recorded. Browser and OS
    // columns were dropped for the one-line summary (6bb44878), so they are not asserted.
    const table = page.getByRole('table');
    for (const header of ['Location', 'Duration', 'What happened', 'Recorded']) {
      await expect(table.getByRole('columnheader', { name: header })).toBeVisible();
    }

    const rows = page.getByRole('row');
    const pricing = rows.filter({ hasText: '/pricing' });
    const blog = rows.filter({ hasText: '/blog/news' });
    const checkout = rows.filter({ hasText: 'shipping step' });

    // Location, and the duration rendered rather than raw seconds, with the page count.
    await expect(pricing).toContainText('US');
    await expect(pricing).toContainText('2m 25s');
    await expect(pricing).toContainText('3 pages');
    await expect(blog).toContainText('GB');
    await expect(blog).toContainText('0m 45s');
    await expect(blog).toContainText('1 page');

    // "What happened": from the ingest flags until a session is analysed, then core's summary.
    await expect(pricing).toContainText('Hit an error · 3 pages from /pricing');
    await expect(blog).toContainText('Rage-clicked · 1 page from /blog/news');
    await expect(checkout).toContainText('Started the checkout form and left at the shipping step');
    await expect(checkout).toContainText('DE');

    // The headline figures come from the response's own `summary`, not from counting the page.
    // `.first()`: the stat cards come before the session groups, which also has a "Rage clicks" row.
    const stat = (label: string) => page.getByText(label, { exact: true }).first().locator('..').locator('..');
    await expect(stat('Total Sessions')).toContainText('3');
    await expect(stat('Avg Duration')).toContainText('2m 43s');
    await expect(stat('With Errors')).toContainText('1');
    await expect(stat('Rage clicks')).toContainText('1');
    await expect(page.getByText('3 sessions recorded')).toBeVisible();
    await expect(page.getByText('1–3 of 3 rows')).toBeVisible();

    // Below the table, sessions are grouped by what kind of visit they were.
    await expect(page.getByRole('heading', { name: 'Session groups' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Errors.*Hit a JavaScript/ })).toContainText('1');
    await expect(page.getByRole('button', { name: /^Rage clicks/ })).toContainText('1');
    await expect(page.getByRole('button', { name: /^Abandoned forms/ })).toContainText('1');

    // Watch opens the player for that session.
    await blog.getByRole('button', { name: 'Watch' }).click();
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
