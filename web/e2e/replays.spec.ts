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
          ],
          limit: 20,
          offset: 0,
          total: 2,
          summary: {
            total: 2,
            withErrors: 1,
            withRageClicks: 1,
            avgDurationSeconds: 95,
          },
        }),
      });
    });

    await page.goto('/websites/web-123/replays');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Session Replays');

    // One row per session, asserted through the table rather than by session id — the
    // list shows location, client, entry page, duration and signals, and has never
    // rendered the id. The previous assertions waited 30s for `sess-abc-123` and timed
    // out on a page that was rendering both sessions correctly.
    const rows = page.getByRole('row');
    await expect(rows.filter({ hasText: '/pricing' })).toBeVisible();
    await expect(rows.filter({ hasText: '/blog/news' })).toBeVisible();

    // The client column, which is what identifies a session to the user.
    await expect(rows.filter({ hasText: 'Chrome' })).toContainText('macOS');
    await expect(rows.filter({ hasText: 'Safari' })).toContainText('iOS');

    // Duration is rendered, not raw seconds: 145s and 45s.
    await expect(rows.filter({ hasText: '/pricing' })).toContainText('2m 25s');
    await expect(rows.filter({ hasText: '/blog/news' })).toContainText('0m 45s');

    // The per-row signal chips, from `hasErrors` and `hasRageClicks`.
    await expect(rows.filter({ hasText: '/pricing' })).toContainText('Errors');
    await expect(rows.filter({ hasText: '/blog/news' })).toContainText('Rage');

    // The summary comes from the response's own `summary`, not from counting the page.
    await expect(page.getByText('2 sessions recorded')).toBeVisible();
    await expect(page.getByText('1–2 of 2 rows')).toBeVisible();
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
