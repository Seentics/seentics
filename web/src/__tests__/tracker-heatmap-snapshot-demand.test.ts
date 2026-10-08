import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const trackers = path.resolve(__dirname, '../../public/trackers');
const read = (file: string) => readFileSync(path.join(trackers, file), 'utf8');
const core = read('seentics.js');
/**
 * The heatmap extension as one self-registering script, as the build ships it. Its only
 * import is `registerExtension`, inlined here: esbuild, which the build bundles it with,
 * cannot run in this jsdom environment.
 */
const heatmaps =
  read('ext-register.js').replace('export const registerExtension', 'const registerExtension') +
  read('ext-heatmaps.js').replace(/^import \{ registerExtension \} from '\.\/ext-register\.js';$/m, '');

const WEBSITE_ID = 'site-heat';
const EXT_FILE = 'ext-heat-test.js';
/** A site with heatmaps and layout capture on, needing no consent. */
const CONFIG = { heatmap_enabled: true, heatmap_layout_enabled: true, consent_mode: 'none' };

/**
 * Runs the tracker with the heatmap extension already registered (as when another tracker
 * on the page loaded it), answering `/snapshot-needed` with `status` and `needed`.
 * Returns the snapshot-needed URLs asked for.
 */
async function runTracker(status: number, needed: boolean) {
  const asked: string[] = [];
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    const u = String(url);
    if (u.includes('/snapshot-needed/')) {
      asked.push(u);
      return Promise.resolve(new Response(JSON.stringify({ needed }), { status }));
    }
    return Promise.resolve(new Response(JSON.stringify({ config: CONFIG }), { status: 200 }));
  }));

  // Register the extension under the name the core will look it up by.
  (window as unknown as Record<string, unknown>).__SNC_EXTENSIONS__ = { l: EXT_FILE };
  const ext = document.createElement('script');
  Object.defineProperty(ext, 'src', { value: `https://seentics.com/trackers/${EXT_FILE}`, configurable: true });
  Object.defineProperty(document, 'currentScript', { value: ext, configurable: true });
  new Function(heatmaps)();

  localStorage.setItem(`snc_cfg:${WEBSITE_ID}`, JSON.stringify(CONFIG));
  const script = document.createElement('script');
  Object.defineProperty(script, 'src', { value: 'https://seentics.com/trackers/seentics.min.js', configurable: true });
  script.setAttribute('data-website-id', WEBSITE_ID);
  Object.defineProperty(document, 'currentScript', { value: script, configurable: true });
  delete (window as unknown as Record<string, unknown>).__seentics_sites;
  new Function(core)();
  return asked;
}

/** The marker the extension sets once it has queued a snapshot of this path. */
const snapshotQueued = () => sessionStorage.getItem(`snc_hmshot:${WEBSITE_ID}:${location.pathname}`) === '1';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  delete (window as unknown as Record<string, unknown>).__sncx;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as unknown as Record<string, unknown>).__SNC_EXTENSIONS__;
});

describe('heatmap layout capture asks the server first', () => {
  it('captures nothing when the server says the page is covered', async () => {
    const asked = await runTracker(200, false);
    await vi.waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0]).toContain(`/api/v1/tracker/snapshot-needed/${WEBSITE_ID}?path=`);
    // Well past the 2.5 s post-render delay a capture would wait for.
    await new Promise((resolve) => setTimeout(resolve, 3_500));
    expect(snapshotQueued()).toBe(false);
  }, 10_000);

  it('captures the page when the server says it is needed', async () => {
    await runTracker(200, true);
    await vi.waitFor(() => expect(snapshotQueued()).toBe(true), { timeout: 6_000 });
  }, 10_000);

  it('captures as before against a server that predates the question (404)', async () => {
    await runTracker(404, false);
    await vi.waitFor(() => expect(snapshotQueued()).toBe(true), { timeout: 6_000 });
  }, 10_000);
});
