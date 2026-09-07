import { expect, test, type APIRequestContext, type Locator } from '@playwright/test';
import { startTrackedWebsite } from './fixture';
import { signInOrSetUpAdmin } from './admin';
import { createWebsiteAndReadSnippet } from './website';

type HeatmapPoint = {
  x_percent: number;
  y_percent: number;
  intensity: number;
  target_selector: string;
  cap_vw: number | null;
  cap_vh: number | null;
};

type Layout = { html_url?: string; doc_width: number; doc_height: number };

async function heatmapPoints(
  request: APIRequestContext,
  websiteId: string,
  token: string,
  type: 'click' | 'scroll',
  pagePath = '/shop',
): Promise<HeatmapPoint[]> {
  const response = await request.get(`/api/v1/heatmaps/${websiteId}/data`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { page_path: pagePath, event_type: type },
  });
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()).points;
}

/** The canvas is the final visual contract: test a small region, not one antialiased pixel. */
async function canvasHasPaintNear(canvas: Locator, x: number, y: number) {
  return canvas.evaluate((element, point) => {
    const canvas = element as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    const left = Math.max(0, Math.round(point.x) - 4);
    const top = Math.max(0, Math.round(point.y) - 4);
    const width = Math.min(9, canvas.width - left);
    const height = Math.min(9, canvas.height - top);
    return [...ctx.getImageData(left, top, width, height).data].some((value, index) => index % 4 === 3 && value > 0);
  }, { x, y });
}

test('collects real heatmap clicks and scroll depth, stores a visitor DOM snapshot, and aligns both in the dashboard', async ({ page, browser, request }, testInfo) => {
  const fixture = await startTrackedWebsite(Number(new URL(process.env.E2E_FIXTURE_URL!).port));
  const visitor = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const tracked = await visitor.newPage();
  const transport: { url: string; status: number }[] = [];
  tracked.on('response', response => {
    if (response.url().includes('/tracker/')) transport.push({ url: response.url(), status: response.status() });
  });

  try {
    let websiteId = '';
    let token = '';
    await test.step('Create a real tracked website with heatmaps and layout capture enabled', async () => {
      token = await signInOrSetUpAdmin(page);
      const created = await createWebsiteAndReadSnippet(page, 'Heatmap E2E Store', fixture.origin);
      websiteId = created.websiteId;
      const { snippet } = created;
      fixture.installSnippet(snippet);

      const settings = await request.put(`/api/v1/user/websites/${websiteId}`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          replay_enabled: false,
          heatmap_enabled: true,
          heatmap_layout_enabled: true,
          heatmap_exclude_patterns: '/checkout',
          automation_enabled: false,
          funnel_enabled: false,
        },
      });
      expect(settings.ok(), await settings.text()).toBe(true);
    });

    let clickPoints: HeatmapPoint[] = [];
    let scrollPoints: HeatmapPoint[] = [];
    let layout: Layout | null = null;
    let expectedClicks: { nx: number; ny: number; selector: string; intensity: number }[] = [];
    let expectedScrollDepth = 0;

    await test.step('Browse the real site and record known click and scroll coordinates', async () => {
      const init = tracked.waitForResponse(r => r.url().includes(`/tracker/init/${websiteId}`));
      await tracked.goto(`${fixture.origin}/shop`);
      expect((await init).ok()).toBe(true);
      await expect(tracked.locator('#footer')).toBeVisible();

      const documentMetrics = await tracked.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        viewportHeight: innerHeight,
      }));
      for (const [selector, hint] of [['#page-title', 'h1#page-title'], ['#action', 'button#action']] as const) {
        const box = await tracked.locator(selector).boundingBox();
        expect(box).not.toBeNull();
        expectedClicks.push({
          nx: (box!.x + box!.width / 2) / documentMetrics.width,
          ny: (box!.y + box!.height / 2) / documentMetrics.height,
          selector: hint,
          intensity: 1,
        });
        await tracked.locator(selector).click();
      }
      await expect(tracked.locator('#status')).toHaveText('Cart contains 1 item');
      // A repeat click must aggregate into the same storage cell rather than
      // producing an extra dot; a blocked region must produce no dot at all.
      await tracked.locator('#action').click();
      expectedClicks.find(point => point.selector === 'button#action')!.intensity = 2;
      await tracked.locator('#blocked').click();

      await tracked.mouse.wheel(0, 500);
      await expect.poll(() => tracked.evaluate(() => scrollY)).toBeGreaterThan(300);
      await tracked.waitForTimeout(600); // exceeds tracker scroll throttling
      await tracked.mouse.wheel(0, 500);
      await expect.poll(() => tracked.evaluate(() => scrollY)).toBeGreaterThan(700);
      const scrollY = await tracked.evaluate(() => window.scrollY);
      expectedScrollDepth = scrollY / (documentMetrics.height - documentMetrics.viewportHeight);

      // The tracker creates the inert visitor DOM snapshot 2.5 s after load. Leaving
      // the page forces the final click/scroll batch out via the real pagehide path.
      await tracked.waitForTimeout(3_000);
      // This route is explicitly excluded. It exercises the configuration gate
      // for clicks, scrolling, and the delayed DOM-snapshot capture path.
      await tracked.goto(`${fixture.origin}/checkout`);
      await expect(tracked.getByRole('button', { name: 'Place order' })).toBeVisible();
      await tracked.waitForTimeout(3_000);
      await tracked.getByRole('button', { name: 'Place order' }).click();
      await tracked.mouse.wheel(0, 800);
      await tracked.goto(`${fixture.origin}/done`);
    });

    await test.step('Read the persisted points and DOM snapshot directly from the real APIs', async () => {
      await expect(async () => {
        clickPoints = await heatmapPoints(request, websiteId, token, 'click');
        scrollPoints = await heatmapPoints(request, websiteId, token, 'scroll');
        const response = await request.get(`/api/v1/heatmaps/${websiteId}/layout-snapshot`, {
          headers: { Authorization: `Bearer ${token}` }, params: { page_path: '/shop' },
        });
        expect(response.ok(), await response.text()).toBe(true);
        layout = (await response.json()).layout;
        expect(clickPoints).toHaveLength(expectedClicks.length);
        expect(scrollPoints.length).toBeGreaterThanOrEqual(2);
        expect(layout?.html_url).toBeTruthy();
      }).toPass({ timeout: 45_000, intervals: [500, 1000, 2000] });

      for (const expected of expectedClicks) {
        const actual = clickPoints.find(point => point.target_selector === expected.selector);
        expect(actual, `recorded ${expected.selector}`).toBeDefined();
        expect(actual!.x_percent / 10_000).toBeCloseTo(expected.nx, 2);
        expect(actual!.y_percent / 10_000).toBeCloseTo(expected.ny, 2);
        expect(actual!.intensity).toBe(expected.intensity);
        expect(actual!.cap_vw).toBe(1280);
        expect(actual!.cap_vh).toBe(720);
      }
      expect(Math.max(...scrollPoints.map(point => point.y_percent / 100))).toBeCloseTo(expectedScrollDepth, 1);
      expect(layout!.doc_width).toBeGreaterThanOrEqual(1280);
      expect(layout!.doc_height).toBeGreaterThan(1_000);

      const snapshot = await request.get(layout!.html_url!);
      expect(snapshot.ok(), await snapshot.text()).toBe(true);
      const html = await snapshot.text();
      expect(html).toContain('id="page-title"');
      expect(html).toContain('id="action"');
      expect(html).toContain('End of catalog');
      expect(html).not.toContain('<script src=');
      // The heatmap underlay is durable HTML in object storage, so its privacy
      // contract is just as important as replay's event masking.
      expect(html).not.toContain('Private customer note');
      expect(html).not.toContain('Blocked account details');
      expect(html).not.toContain('prefilled-private@example.test');
      expect(html).toContain('Masked content');
      expect(html).toContain('Blocked content');
      expect(transport.some(item => item.url.endsWith('/tracker/collect') && item.status === 200)).toBe(true);
      expect(transport.filter(item => item.status >= 400)).toEqual([]);

      const excludedPoints = await heatmapPoints(request, websiteId, token, 'click', '/checkout');
      expect(excludedPoints).toEqual([]);
      const excludedLayout = await request.get(`/api/v1/heatmaps/${websiteId}/layout-snapshot`, {
        headers: { Authorization: `Bearer ${token}` }, params: { page_path: '/checkout' },
      });
      expect(excludedLayout.ok(), await excludedLayout.text()).toBe(true);
      expect((await excludedLayout.json()).layout).toBeNull();
    });

    await test.step('Render the actual dashboard heatmap over the stored visitor DOM', async () => {
      await page.goto(`/websites/${websiteId}/heatmaps/_shop`);
      await expect(page.getByText('2 pts')).toBeVisible({ timeout: 45_000 });
      const snapshot = page.frameLocator('iframe[title="Page snapshot"]');
      await expect(snapshot.locator('#page-title')).toHaveText('Recording test store');
      await expect(snapshot.locator('#action')).toHaveText('Add to cart');
      await expect(snapshot.locator('#footer')).toContainText('End of catalog');

      const canvas = page.locator('canvas').last();
      await expect(canvas).toBeVisible();
      const clickCanvas = await canvas.evaluate(element => ({ width: (element as HTMLCanvasElement).width, height: (element as HTMLCanvasElement).height }));
      for (const point of clickPoints) {
        expect(await canvasHasPaintNear(canvas, point.x_percent / 10_000 * clickCanvas.width, point.y_percent / 10_000 * clickCanvas.height)).toBe(true);
      }

      await page.getByRole('button', { name: 'Scroll' }).click();
      const deepestScroll = Math.max(...scrollPoints.map(point => point.y_percent / 100));
      await expect.poll(() => page.locator('canvas').last().evaluate((element, depth) => {
        const canvas = element as HTMLCanvasElement;
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;
        const y = Math.min(canvas.height - 1, Math.max(0, Math.round(depth * canvas.height)));
        return ctx.getImageData(Math.floor(canvas.width / 2), y, 1, 1).data[3] > 0;
      }, deepestScroll)).toBe(true);
    });
  } finally {
    await testInfo.attach('heatmap-diagnostics', {
      body: JSON.stringify({ transport }, null, 2), contentType: 'application/json',
    });
    await visitor.close();
    await fixture.close();
  }
});
