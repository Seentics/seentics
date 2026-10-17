import { describe, expect, it, vi } from 'vitest';
import {
  HOST_CACHE_SECONDS,
  decideCustomHostRequest,
  edgeClientHeaders,
  isActivePortalHost,
  isSeenticsHost,
} from '../../functions/lib/custom-host';

describe('isSeenticsHost', () => {
  it('knows our own hosts', () => {
    for (const h of ['seentics.com', 'www.seentics.com', 'portal.seentics.com', 'SEENTICS.COM.', 'seentics-web.pages.dev', 'abc123.seentics-web.pages.dev', 'localhost', '127.0.0.1']) {
      expect([h, isSeenticsHost(h)]).toEqual([h, true]);
    }
  });

  it('treats anything else as an agency domain', () => {
    for (const h of ['reports.agency.com', 'seentics.com.evil.test', 'notseentics.com', 'pages.dev.agency.com']) {
      expect([h, isSeenticsHost(h)]).toEqual([h, false]);
    }
  });
});

describe('decideCustomHostRequest', () => {
  it('a live agency domain serves the portal and the files it needs', () => {
    for (const p of [
      '/client-portal/scp_abc', '/client-portal/scp_abc.txt', '/client-portal/invalid',
      '/_next/static/chunks/main.js', '/images/sources/google.png', '/images/country/de.png', '/favicon.ico', '/icon.svg',
    ]) {
      expect([p, decideCustomHostRequest(p, true)]).toEqual([p, 'allow']);
    }
  });

  it('sends the bare domain to the neutral invalid-link page', () => {
    expect(decideCustomHostRequest('/', true)).toBe('redirect-invalid');
  });

  it('never serves Seentics\' marketing, dashboard, docs or API on an agency domain', () => {
    for (const p of ['/pricing', '/websites/abc', '/signin', '/docs/agency', '/api/v1/user/auth/me', '/embed/w1', '/blog', '/images/app/photo-1.png', '/client-portal/../pricing']) {
      expect([p, decideCustomHostRequest(p, true)]).toEqual([p, 'not-found']);
    }
  });

  it('a domain that is not live serves nothing at all', () => {
    for (const p of ['/', '/client-portal/scp_abc', '/_next/static/x.js']) expect(decideCustomHostRequest(p, false)).toBe('not-found');
  });
});

describe('isActivePortalHost', () => {
  const memoryCache = () => {
    const store = new Map<string, Response>();
    return {
      store,
      match: vi.fn(async (r: Request) => store.get(r.url)?.clone()),
      put: vi.fn(async (r: Request, res: Response) => { store.set(r.url, res); }),
    };
  };

  it('asks the gateway once, then answers from the cache', async () => {
    const cache = memoryCache();
    const fetchMock = vi.fn(async () => Response.json({ data: { hostname: 'reports.agency.com', active: true } }));
    const deps = { fetch: fetchMock as unknown as typeof fetch, cache };
    expect(await isActivePortalHost('Reports.Agency.com', 'https://api.seentics.com', deps)).toBe(true);
    expect(await isActivePortalHost('reports.agency.com', 'https://api.seentics.com', deps)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe('https://api.seentics.com/api/v1/agency/portal/host?hostname=reports.agency.com');
    const [, cached] = [...cache.store.entries()][0]!;
    expect(cached.headers.get('Cache-Control')).toBe(`max-age=${HOST_CACHE_SECONDS.active}`);
  });

  it('reads `state: "active"` too, and anything else (or a 404) as not live', async () => {
    const ask = (res: Response) => isActivePortalHost('x.agency.com', 'https://api.seentics.com', { fetch: (async () => res) as unknown as typeof fetch });
    expect(await ask(Response.json({ data: { state: 'active' } }))).toBe(true);
    expect(await ask(Response.json({ data: { state: 'pending_dns' } }))).toBe(false);
    expect(await ask(Response.json({ data: null }))).toBe(false);
    expect(await ask(new Response('nope', { status: 404 }))).toBe(false);
  });

  it('sends the visitor address with the secret, as the API proxy does, only when the secret is set', async () => {
    const req = new Request('https://reports.agency.com/', { headers: { 'CF-Connecting-IP': '203.0.113.9' } });
    expect(edgeClientHeaders(req, 's3cret')).toEqual({ 'X-Seentics-Edge-Client-IP': '203.0.113.9', 'X-Seentics-Edge-Secret': 's3cret' });
    expect(edgeClientHeaders(req, undefined)).toEqual({});
    const fetchMock = vi.fn(async () => Response.json({ data: { active: true } }));
    await isActivePortalHost('x.agency.com', 'https://api.seentics.com', { fetch: fetchMock as unknown as typeof fetch, headers: edgeClientHeaders(req, 's3cret') });
    const init = (fetchMock.mock.calls[0] as unknown[])[1] as { headers: Record<string, string> };
    expect(init.headers['X-Seentics-Edge-Secret']).toBe('s3cret');
  });

  it('a gateway that cannot answer is a "no" that is not cached', async () => {
    const cache = memoryCache();
    const down = vi.fn(async () => new Response('', { status: 502 }));
    expect(await isActivePortalHost('x.agency.com', 'https://api.seentics.com', { fetch: down as unknown as typeof fetch, cache })).toBe(false);
    const limited = vi.fn(async () => new Response('', { status: 429 }));
    expect(await isActivePortalHost('x.agency.com', 'https://api.seentics.com', { fetch: limited as unknown as typeof fetch, cache })).toBe(false);
    const thrown = vi.fn(async () => { throw new Error('offline'); });
    expect(await isActivePortalHost('x.agency.com', 'https://api.seentics.com', { fetch: thrown as unknown as typeof fetch, cache })).toBe(false);
    expect(cache.put).not.toHaveBeenCalled();
  });
});
