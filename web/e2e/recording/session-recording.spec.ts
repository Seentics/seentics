import { test, expect, type APIRequestContext } from '@playwright/test';
import { gunzipSync } from 'node:zlib';
import { startTrackedWebsite } from './fixture';
import { signInOrSetUpAdmin } from './admin';
import { createWebsiteAndReadSnippet } from './website';

type RecordedEvent = { type: string; sid: string; url: string; data: any };
type Detail = {
  session_id: string;
  replay_storage?: string;
  replay_chunk_urls?: { sequence: number; url: string }[];
  warm_chunks?: { data: unknown[] }[];
  meta?: { websiteId: string; pagesViewed: number; durationSeconds: number; entryPage: string };
};

function snapshotNodes(node: any): any[] {
  return [node, ...(node.childNodes ?? []).flatMap(snapshotNodes)];
}

function containsRecordedText(events: RecordedEvent[], value: string): boolean {
  return events.some(({ type, data }) => type === 'rrweb' && (
    (data.type === 2 && snapshotNodes(data.data.node).some(node => node.textContent === value)) ||
    (data.type === 3 && data.data.source === 0 && (
      (data.data.texts ?? []).some((text: any) => text.value === value) ||
      (data.data.adds ?? []).some((add: any) => snapshotNodes(add.node).some(node => node.textContent === value))
    ))
  ));
}

// Read the actual stored objects, independently of the web client's decoder.
async function storedEvents(request: APIRequestContext, detail: Detail): Promise<RecordedEvent[]> {
  const result: RecordedEvent[] = [];
  for (const chunk of [...(detail.replay_chunk_urls ?? [])].sort((a, b) => a.sequence - b.sequence)) {
    const response = await request.get(chunk.url);
    expect(response.ok(), `MinIO chunk ${chunk.sequence}: ${response.status()}`).toBeTruthy();
    const bytes = await response.body();
    const decoded = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes;
    const events = JSON.parse(decoded.toString('utf8'));
    expect(Array.isArray(events)).toBe(true);
    result.push(...events);
  }
  return result;
}

test('records real visitor actions, persists them, and reproduces them in the dashboard player', async ({ page, browser, request }, testInfo) => {
  const fixture = await startTrackedWebsite(Number(new URL(process.env.E2E_FIXTURE_URL!).port));
  const visitor = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  const tracked = await visitor.newPage();
  const transport: { url: string; status: number }[] = [];
  const failedRequests: string[] = [];
  tracked.on('response', response => {
    if (response.url().includes('/tracker/')) transport.push({ url: response.url(), status: response.status() });
  });
  tracked.on('requestfailed', req => failedRequests.push(`${req.url()}: ${req.failure()?.errorText}`));
  let events: RecordedEvent[] = [];
  let detail: Detail = { session_id: '' };

  try {
    let websiteId = '';
    let token = '';
    await test.step('Set up the OSS admin and copy the real first-website tracking snippet', async () => {
      token = await signInOrSetUpAdmin(page);
      const created = await createWebsiteAndReadSnippet(page, 'Recording E2E Store', fixture.origin);
      websiteId = created.websiteId;
      const { snippet } = created;
      fixture.installSnippet(snippet);

      const settings = await request.put(`/api/v1/user/websites/${websiteId}`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          replay_enabled: true, replay_sampling_rate: 1,
          heatmap_enabled: false, heatmap_layout_enabled: false,
          automation_enabled: false, funnel_enabled: false,
        },
      });
      expect(settings.ok(), await settings.text()).toBe(true);
    });

    const authHeaders = { Authorization: `Bearer ${token}` };
    let sessionId = '';
    const pollStorage = async (marker: string) => {
      await expect(async () => {
        const response = await request.get(`/api/v1/replays/${websiteId}/${sessionId}`, { headers: authHeaders });
        expect(response.status()).toBe(200);
        detail = await response.json();
        expect(detail.replay_storage).toBe('chunks');
        events = await storedEvents(request, detail);
        expect(containsRecordedText(events, marker), `Persisted DOM state: ${marker}`).toBe(true);
      }).toPass({ timeout: 45_000, intervals: [500, 1000, 2000] });
    };

    await test.step('Load the snippet and record clicks, inputs, scrolling, and navigation', async () => {
      const init = tracked.waitForResponse(r => r.url().includes(`/tracker/init/${websiteId}`));
      await tracked.goto(`${fixture.origin}/shop`);
      const initResponse = await init;
      expect(initResponse.ok()).toBe(true);
      expect((await initResponse.json()).config).toMatchObject({ replay_enabled: true, replay_sampling_rate: 1 });
      // Wait for the first snapshot to reach storage: loader availability alone
      // does not prove rrweb has started observing the page.
      sessionId = (await tracked.evaluate(() => localStorage.getItem('snc_sid')))!;
      expect(sessionId).toBeTruthy();
      await pollStorage('Recording test store');
      await tracked.getByRole('button', { name: 'Add to cart' }).click();
      await expect(tracked.locator('#status')).toHaveText('Cart contains 1 item');
      await tracked.getByLabel('Email', { exact: true }).fill('never-store-me@example.test');
      await tracked.getByLabel('Password', { exact: true }).fill('NeverStoreThisPassword123!');
      await tracked.getByRole('heading').click(); // blur the input (rrweb input sampling)
      await tracked.mouse.wheel(0, 900);
      await expect.poll(() => tracked.evaluate(() => scrollY)).toBeGreaterThan(500);
      await pollStorage('Cart contains 1 item');

      await tracked.getByRole('link', { name: 'Continue to checkout' }).click();
      await expect(tracked).toHaveURL(`${fixture.origin}/checkout`);
      expect(await tracked.evaluate(() => localStorage.getItem('snc_sid'))).toBe(sessionId);
      await pollStorage('Review your order');
      await tracked.getByRole('button', { name: 'Place order' }).click();
      await expect(tracked.locator('#status')).toHaveText('Order confirmed');
      // A real document navigation exercises the pagehide/unload flush. Do not
      // call recorder internals or manufacture events to make ingestion pass.
      await tracked.goto(`${fixture.origin}/done`);
      await pollStorage('Order confirmed');
    });

    await test.step('Verify durable events, metadata, and input privacy', async () => {
      const raw = JSON.stringify(events);
      expect(raw).not.toContain('never-store-me@example.test');
      expect(raw).not.toContain('NeverStoreThisPassword123!');
      expect(raw).not.toContain('Private customer note');
      expect(raw).not.toContain('Blocked account details');
      expect(events.every(event => event.sid === sessionId)).toBe(true);
      const rrweb = events.filter(event => event.type === 'rrweb').map(event => event.data);
      const timestamps = rrweb.map(event => event.timestamp);
      expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
      const paths = rrweb.filter(event => event.type === 4).map(event => new URL(event.data.href).pathname);
      expect(paths).toEqual(['/shop', '/checkout']);
      expect(rrweb.filter(event => event.type === 2).length).toBeGreaterThanOrEqual(2);
      const firstSnapshot = rrweb.find(event => event.type === 2);
      const actionNode = snapshotNodes(firstSnapshot.data.node).find(node => node.attributes?.id === 'action');
      expect(actionNode).toBeDefined();
      expect(rrweb.some(event => event.type === 3 && event.data.source === 2 &&
        event.data.type === 2 && event.data.id === actionNode.id)).toBe(true);
      const inputEvents = rrweb.filter(event => event.type === 3 && event.data.source === 5 && event.data.text);
      expect(inputEvents.length).toBeGreaterThanOrEqual(2);
      for (const event of inputEvents) expect(event.data.text).toMatch(/^\*+$/);
      expect(detail.meta).toMatchObject({ websiteId, pagesViewed: 2 });
      expect(detail.meta!.durationSeconds).toBeGreaterThan(0);
      expect(new URL(detail.meta!.entryPage).pathname).toBe('/shop');
      expect(transport.some(r => r.url.endsWith('/tracker/collect') && r.status === 200)).toBe(true);
      expect(transport.filter(r => r.status >= 400)).toEqual([]);
    });

    await test.step('Open the recorded session and compare the actual replay DOM', async () => {
      await page.goto(`/websites/${websiteId}/replays`);
      const row = page.getByRole('row').filter({ hasText: '/shop' });
      await expect(row).toHaveCount(1);
      await row.getByTitle('Watch replay').click();
      await expect(page).toHaveURL(new RegExp(`/replays/${sessionId}$`));
      const replay = page.frameLocator('.replayer-wrapper iframe');
      await expect(replay.locator('#status')).toHaveText('Order confirmed', { timeout: 45_000 });
      await expect(replay.locator('#page-title')).toHaveText('Checkout');
      await expect(replay.locator('#private-note')).not.toContainText('Private customer note');
      await expect(replay.locator('body')).not.toContainText('Blocked account details');

      // Rewind through the normal player controls, then watch the recorded DOM
      // mutations and navigation again. A blank player or mere HTTP 200 cannot pass.
      const pause = page.getByRole('button', { name: 'Pause', exact: true });
      if (await pause.isVisible()) await pause.click();
      // Keep the scroll state on screen long enough to observe it. With idle
      // skipping on, the player can jump from the shop interaction straight to
      // checkout between polling frames.
      const skipIdle = page.getByRole('button', { name: 'Skip idle time (on)', exact: true });
      if (await skipIdle.isVisible()) await skipIdle.click();
      await expect(page.getByRole('button', { name: 'Skip idle time (off)', exact: true })).toBeVisible();
      const slider = page.getByRole('slider', { name: /Seek/ });
      await slider.click({ position: { x: 0, y: 8 } });
      await page.getByRole('button', { name: 'Play', exact: true }).click();
      await expect(replay.locator('#page-title')).toHaveText('Recording test store');
      await expect(replay.locator('#status')).toHaveText('Cart contains 1 item', { timeout: 30_000 });
      await expect(replay.locator('#email')).toHaveValue('*'.repeat('never-store-me@example.test'.length));
      await expect(replay.locator('#password')).toHaveValue('*'.repeat('NeverStoreThisPassword123!'.length));
      await expect.poll(() => replay.locator('body').evaluate(element =>
        element.ownerDocument.defaultView!.scrollY,
      )).toBeGreaterThan(500);
      await expect(replay.locator('#status')).toHaveText('Order confirmed', { timeout: 30_000 });
    });
  } finally {
    await testInfo.attach('recording-diagnostics', {
      body: JSON.stringify({ detail, transport, failedRequests, eventCount: events.length }, null, 2),
      contentType: 'application/json',
    });
    await visitor.close();
    await fixture.close();
  }
});
