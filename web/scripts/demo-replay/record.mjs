#!/usr/bin/env node
/**
 * Records the demo session replay: public/demo/replay-session.json
 *
 *   node scripts/demo-replay/record.mjs
 *
 * Demo mode has no recording bytes in object storage, so `/websites/demo/replays/[id]`
 * plays this file through the same parser and player as a real session. It is a real
 * rrweb recording (the pinned version, the tracker's options) of a scripted visit to
 * Northbound, a made-up shop served from northbound.example, a reserved domain that
 * belongs to no one.
 *
 * The visit: home → product (switch colour, add to cart) → cart, where the coupon
 * request fails with a 500, the handler throws, nothing on screen changes, and the
 * visitor rage-clicks Apply. Page markers, a rage click, an error, a console line and
 * a failed request — every panel of the player has something to show.
 *
 * Output format is a chunk as the tracker uploads it: rrweb events plus the tracker's
 * custom rows ({ type: 'session_error' | 'console_event' | 'network_event', ts, url, data }).
 */
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { home, product, cart } from './site/pages.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
// Not in the package's exports map, so found beside the main entry in dist/.
const rrwebUmd = readFileSync(path.join(path.dirname(require.resolve('rrweb')), 'rrweb.umd.min.cjs'), 'utf8');
const OUT = path.join(here, '../../public/demo/replay-session.json');
const ORIGIN = 'https://northbound.example';

const pages = { '/': home, '/products/trailhead-32l': product, '/cart': cart };

// The tracker's rrweb options (public/trackers/seentics.js RRWEB_OPTIONS), minus the
// per-site text masking hooks, which mask nothing on a page like this one.
const RECORDER = `
  ${rrwebUmd};
  (() => {
    const emit = (row) => window.__nbEmit(row);
    const custom = (type, data, ts = Date.now()) => emit({ type, data, ts, url: location.href });

    window.addEventListener('error', (ev) => custom('session_error', {
      message: ev.message || 'Script error', filename: ev.filename || undefined,
      lineno: ev.lineno || undefined, colno: ev.colno || undefined, stack: ev.error && ev.error.stack || undefined,
    }), true);
    window.addEventListener('unhandledrejection', (ev) => {
      const r = ev.reason;
      custom('session_error', { message: r instanceof Error ? r.message : String(r), stack: r instanceof Error ? r.stack : undefined });
    });
    for (const level of ['log', 'info', 'warn', 'error']) {
      const orig = console[level];
      console[level] = function (...args) {
        orig.apply(console, args);
        custom('console_event', { level, args: args.map((a) => typeof a === 'string' ? a : JSON.stringify(a)) });
      };
    }
    const origFetch = window.fetch;
    window.fetch = function (input, init) {
      const method = ((init && init.method) || 'GET').toUpperCase();
      const url = typeof input === 'string' ? new URL(input, location.href).href : input.url;
      const startTs = Date.now();
      const p = origFetch.apply(this, arguments);
      p.then((res) => custom('network_event', { method, url, status: res.status, duration: Date.now() - startTs, startTs }, startTs),
             (err) => custom('network_event', { method, url, status: 0, duration: Date.now() - startTs, startTs, error: String(err) }, startTs));
      return p;
    };

    document.addEventListener('DOMContentLoaded', () => {
      rrweb.record({
        emit: (ev) => emit(ev),
        checkoutEveryNms: 60000,
        maskAllInputs: true,
        recordShadowDOM: true,
        sampling: { mousemove: 100, touchmove: 100, scroll: 150, media: 800, input: 'last' },
        inlineStylesheet: false,
        collectFonts: false,
        recordCanvas: false,
      });
    });
  })();
`;

const rows = [];
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, locale: 'en-CA' });
await context.exposeFunction('__nbEmit', (row) => { rows.push(row); });
await context.route(`${ORIGIN}/**`, (route) => {
  const url = new URL(route.request().url());
  if (url.pathname === '/api/cart/coupon') {
    return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"coupon_service_unavailable"}' });
  }
  const page = pages[url.pathname];
  if (!page) return route.fulfill({ status: 404, body: 'not found' });
  // A <script> at the top of <head>, the way a site loads the tracker. (rrweb's record()
  // crashes the renderer when started from Playwright's addInitScript instead.)
  const tag = `<script>${RECORDER.replace(/<\/script/gi, '<\\/script')}</script>`;
  return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: page().replace('<head>', `<head>${tag}`) });
});

const page = await context.newPage();
const wait = (ms) => page.waitForTimeout(ms);

// A hand moving a mouse: eased, slightly arced, never a straight line at constant speed.
let pos = { x: 800, y: 520 };
async function move(to, ms = 700) {
  const from = { ...pos };
  const steps = Math.max(4, Math.round(ms / 16));
  const bend = (Math.hypot(to.x - from.x, to.y - from.y) / 9) * (to.x > from.x ? -1 : 1);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const arc = Math.sin(Math.PI * e) * bend;
    pos = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e + arc };
    await page.mouse.move(pos.x, pos.y);
    await wait(ms / steps);
  }
  pos = to;
}
async function at(selector, dx = 0, dy = 0) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`not visible: ${selector}`);
  return { x: box.x + box.width / 2 + dx, y: box.y + box.height / 2 + dy };
}
async function click(selector, ms = 700, dx = 0, dy = 0) {
  await move(await at(selector, dx, dy), ms);
  await wait(120);
  await page.mouse.down();
  await wait(70);
  await page.mouse.up();
}
async function scroll(dy, ms = 900) {
  const steps = Math.round(ms / 50);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, dy / steps);
    await wait(50);
  }
}

// ── Home ──────────────────────────────────────────────────────────────────────
await page.goto(`${ORIGIN}/`);
await wait(1800);
await move({ x: 560, y: 360 }, 900);
await wait(900);
await scroll(520, 1300);
await wait(700);
await move(await at('[data-product="fell-shell"]', 0, -30), 900);
await wait(1100);
await move(await at('[data-product="ridge-mid"]', -20, -10), 600);
await wait(700);
await click('[data-product="trailhead-32l"]', 900, 10, -20);
await page.waitForURL('**/products/trailhead-32l');

// ── Product ───────────────────────────────────────────────────────────────────
await wait(1600);
await move(await at('.pdp h1'), 900);
await wait(1200);
await click('.swatch[data-name="Slate"]', 800);
await wait(1000);
await click('.swatch[data-name="Moss"]', 500);
await wait(1300);
await click('#add', 900);
await wait(2200);
await click('.toast a', 1000);
await page.waitForURL('**/cart');

// ── Cart ──────────────────────────────────────────────────────────────────────
await wait(1500);
await move(await at('.line >> nth=0', 0, 0), 900);
await wait(900);
await click('#coupon', 1000);
await wait(400);
await page.keyboard.type('AUTUMN15', { delay: 150 });
await wait(700);
await click('#apply', 600);
await wait(1800);
// Nothing happened. Again, harder.
for (let i = 0; i < 5; i++) {
  await page.mouse.down();
  await wait(60);
  await page.mouse.up();
  await wait(110);
}
await wait(1400);
await move(await at('.row.total'), 700);
await wait(1200);
await move(await at('#cart-pill', -4, 0), 1200);
await wait(1000);

await browser.close();

rows.sort((a, b) => (a.timestamp ?? a.ts) - (b.timestamp ?? b.ts));
mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(rows));

const rr = rows.filter((r) => typeof r.type === 'number');
const ms = rr[rr.length - 1].timestamp - rr[0].timestamp;
const kinds = rows.reduce((m, r) => ((m[r.type] = (m[r.type] || 0) + 1), m), {});
console.log(`${path.relative(process.cwd(), OUT)}: ${rows.length} rows, ${(ms / 1000).toFixed(1)}s, ${(JSON.stringify(rows).length / 1024).toFixed(0)} KB`);
console.log(kinds);
