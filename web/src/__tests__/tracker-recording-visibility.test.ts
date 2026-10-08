import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const source = readFileSync(path.resolve(__dirname, '../../public/trackers/seentics.js'), 'utf8');

const WEBSITE_ID = 'site-rec';
/** A site that records every visitor and needs no consent, as /tracker/init would describe it. */
const CONFIG = {
  replay_enabled: true,
  replay_sampling_rate: 1,
  consent_mode: 'none',
};

let visibility: DocumentVisibilityState = 'visible';

function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event('visibilitychange'));
}

/**
 * Runs the tracker with a stand-in for rrweb's `record`, and returns how many times
 * recording was started and stopped. The site's configuration is cached as a previous
 * visit would have left it, so recording starts as the page opens.
 */
async function runTracker() {
  const counts = { starts: 0, stops: 0 };
  (window as unknown as Record<string, unknown>).__rrweb_record = () => {
    counts.starts++;
    return () => { counts.stops++; };
  };
  localStorage.setItem(`snc_cfg:${WEBSITE_ID}`, JSON.stringify(CONFIG));

  const script = document.createElement('script');
  Object.defineProperty(script, 'src', { value: 'https://seentics.com/trackers/seentics.min.js', configurable: true });
  script.setAttribute('data-website-id', WEBSITE_ID);
  Object.defineProperty(document, 'currentScript', { value: script, configurable: true });
  vi.stubGlobal('fetch', vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify({ config: CONFIG }), { status: 200 })),
  ));
  delete (window as unknown as Record<string, unknown>).__seentics_sites;
  new Function(source)();
  return counts;
}

beforeEach(() => {
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { get: () => visibility, configurable: true });
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as unknown as Record<string, unknown>).__rrweb_record;
});

describe('tracker recording and tab visibility', () => {
  it('stops recording while the tab is hidden and starts again when the visitor returns', async () => {
    const counts = await runTracker();
    await vi.waitFor(() => expect(counts.starts).toBe(1));

    setVisibility('hidden');
    expect(counts.stops).toBe(1);

    setVisibility('visible');
    await vi.waitFor(() => expect(counts.starts).toBe(2));
    expect(counts.stops).toBe(1);
  });

  it('does not start recording a page opened in a background tab until it is looked at', async () => {
    visibility = 'hidden';
    const counts = await runTracker();
    // Give the recorder every chance to start; it must not while the tab is hidden.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(counts.starts).toBe(0);

    setVisibility('visible');
    await vi.waitFor(() => expect(counts.starts).toBe(1));
  });
});
