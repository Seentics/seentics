import { test, expect } from '@playwright/test';

/**
 * An embedded dashboard (`/embed/<site>?token=…`, inside a customer's page) loads its lower
 * sections — pages, sources, UTM — as they come near the viewport. The observer behind that
 * died when React remounted the page (Strict Mode, Fast Refresh): the sections stayed
 * skeletons and never asked for their data.
 */
const SITE = '0ec0bd4b-9593-4a8d-98e6-1b7ace3b051b';

test('an embed loads its lower sections once they are scrolled near', async ({ page }) => {
  const asked: string[] = [];
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    asked.push(path);
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (path.endsWith('/info')) return json({ data: { website: { name: 'Acme', url: 'https://acme.test' }, sections: ['analytics'] } });
    if (path.endsWith('/analytics/dashboard')) return json({ total_visitors: 3, unique_visitors: 3, page_views: 5, sessions: 3, bounce_rate: 0, avg_session_duration: 10, pages_per_session: 1.6, comparison: {} });
    if (path.endsWith('/analytics/daily-stats')) return json({ daily_stats: [] });
    if (path.endsWith('/analytics/hourly-stats')) return json({ hourly_stats: [] });
    if (path.endsWith('/analytics/live-visitors')) return json({ live_visitors: 0 });
    return json({});
  });

  await page.goto(`/embed/${SITE}?token=link-token`);
  await expect(page.getByText('Acme').first()).toBeVisible({ timeout: 60_000 });

  const lower = `/api/v1/embed/${SITE}/analytics/dimensions-bulk`;
  await expect(async () => {
    await page.mouse.wheel(0, 800);
    expect(asked).toContain(lower);
  }).toPass({ timeout: 30_000 });
  // Every call went to the embed API, with the link's token, never to the signed-in one.
  expect(asked.every((p) => p.startsWith(`/api/v1/embed/${SITE}/`))).toBe(true);
});
