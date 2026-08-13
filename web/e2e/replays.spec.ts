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
    // Mock sessions list API
    await page.route('**/replays/web-123*', async (route) => {
      // Only intercept the list endpoint, not individual session endpoints
      if (route.request().url().match(/replays\/web-123$/)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            sessions: [
              {
                id: 'session-001',
                session_id: 'sess-abc-123',
                country: 'US',
                browser: 'Chrome',
                os: 'macOS',
                device: 'desktop',
                entry_page: '/pricing',
                duration_seconds: 145,
                pages_viewed: 3,
                has_errors: true,
                has_rage_clicks: false,
                start_time: new Date().toISOString(),
              },
              {
                id: 'session-002',
                session_id: 'sess-xyz-987',
                country: 'GB',
                browser: 'Safari',
                os: 'iOS',
                device: 'mobile',
                entry_page: '/blog/news',
                duration_seconds: 45,
                pages_viewed: 1,
                has_errors: false,
                has_rage_clicks: true,
                start_time: new Date().toISOString(),
              },
            ],
            limit: 100,
            offset: 0,
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/websites/web-123/replays');

    // Verify header and page elements
    await expect(page.locator('h1')).toContainText('Replays');

    // Verify rows in data table
    await expect(page.locator('text=sess-abc-123')).toBeVisible();
    await expect(page.locator('text=/pricing')).toBeVisible();
    await expect(page.locator('text=sess-xyz-987')).toBeVisible();
    await expect(page.locator('text=/blog/news')).toBeVisible();

    // Verify indicators are present
    await expect(page.locator('text=Client errors')).toBeVisible();
    await expect(page.locator('text=Rage clicks')).toBeVisible();
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
