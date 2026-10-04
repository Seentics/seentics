import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const source = readFileSync(path.resolve(__dirname, '../../public/trackers/seentics.js'), 'utf8');

/** Runs the tracker as if loaded by `<script src=…>`, and returns the URL its init call went to. */
async function initUrl(attrs: Record<string, string>): Promise<string> {
  const script = document.createElement('script');
  for (const [name, value] of Object.entries(attrs)) {
    if (name === 'src') Object.defineProperty(script, 'src', { value, configurable: true });
    else script.setAttribute(name, value);
  }
  Object.defineProperty(document, 'currentScript', { value: script, configurable: true });
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    calls.push(String(url));
    return Promise.resolve(new Response(JSON.stringify({ config: {} }), { status: 200 }));
  }));
  // Each run is a fresh page as far as the tracker's once-per-site guard is concerned.
  delete (window as unknown as Record<string, unknown>).__seentics_sites;
  new Function(source)();
  await vi.waitFor(() => expect(calls.some((url) => url.includes('/api/v1/tracker/init/'))).toBe(true));
  return calls.find((url) => url.includes('/api/v1/tracker/init/'))!;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('tracker API host', () => {
  it('sends Seentics Cloud installs straight to the API, not through the dashboard host', async () => {
    expect(await initUrl({ src: 'https://seentics.com/trackers/seentics.min.js', 'data-website-id': 'site-1' }))
      .toBe('https://api.seentics.com/api/v1/tracker/init/site-1');
    expect(await initUrl({ src: 'https://www.seentics.com/trackers/seentics.min.js', 'data-website-id': 'site-2' }))
      .toBe('https://api.seentics.com/api/v1/tracker/init/site-2');
  });

  it('keeps a self-hosted install on the host that served the script', async () => {
    expect(await initUrl({ src: 'https://analytics.example.org/trackers/seentics.min.js', 'data-website-id': 'site-3' }))
      .toBe('https://analytics.example.org/api/v1/tracker/init/site-3');
  });

  it('uses data-api-host when the page sets one', async () => {
    expect(await initUrl({ src: 'https://seentics.com/trackers/seentics.min.js', 'data-website-id': 'site-4', 'data-api-host': 'https://collect.example.org/api/v1' }))
      .toBe('https://collect.example.org/api/v1/tracker/init/site-4');
  });
});
