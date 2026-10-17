// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  constantTimeEqual,
  contentSecurityPolicy,
  decideCustomHostRequest,
  effectiveHost,
  isSeenticsHost,
  lookupCustomHost,
  serveCustomHost,
  type CacheLike,
} from '../../functions/lib/custom-host';
import { applyBrandToHtml, type RewriterElement, type RewriterLike } from '../../functions/lib/custom-host';
import { isSeenticsCookie, proxyApiRequest } from '../../functions/lib/api-proxy';
import { isSeenticsHostname } from '@/lib/seentics-host';

const SECRET = 'edge-secret-123';
const ENV = { EDGE_PROXY_SECRET: SECRET, GATEWAY_URL: 'https://gw.test' };

describe('isSeenticsHost', () => {
  const ours = ['seentics.com', 'www.seentics.com', 'portal.seentics.com', 'SEENTICS.COM.', 'seentics-web.pages.dev', 'abc123.seentics-web.pages.dev', 'localhost', '127.0.0.1'];
  const theirs = ['reports.agency.com', 'seentics.com.evil.test', 'notseentics.com', 'pages.dev.agency.com'];

  it('knows our own hosts', () => {
    for (const h of ours) expect([h, isSeenticsHost(h)]).toEqual([h, true]);
  });

  it('treats anything else as an agency domain', () => {
    for (const h of theirs) expect([h, isSeenticsHost(h)]).toEqual([h, false]);
  });

  it('agrees with the browser-side copy', () => {
    for (const h of [...ours, ...theirs]) expect([h, isSeenticsHostname(h)]).toEqual([h, isSeenticsHost(h)]);
  });
});

describe('effectiveHost', () => {
  const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });

  it('believes the Worker’s original host only with the right secret', () => {
    expect(effectiveHost(req('https://seentics-web.pages.dev/websites', { 'X-Seentics-Original-Host': 'Reports.Agency.com', 'X-Seentics-Edge-Secret': SECRET }), ENV)).toBe('reports.agency.com');
    expect(effectiveHost(req('https://seentics-web.pages.dev/websites', { 'X-Seentics-Original-Host': 'reports.agency.com', 'X-Seentics-Edge-Secret': 'wrong' }), ENV)).toBe('seentics-web.pages.dev');
    expect(effectiveHost(req('https://seentics-web.pages.dev/websites', { 'X-Seentics-Original-Host': 'reports.agency.com' }), ENV)).toBe('seentics-web.pages.dev');
  });

  it('ignores the header when no secret is configured', () => {
    expect(effectiveHost(req('https://seentics.com/', { 'X-Seentics-Original-Host': 'reports.agency.com', 'X-Seentics-Edge-Secret': '' }), {})).toBe('seentics.com');
    expect(effectiveHost(req('https://seentics.com/', { 'X-Seentics-Original-Host': 'reports.agency.com', 'X-Seentics-Edge-Secret': 'x' }), {})).toBe('seentics.com');
  });

  it('falls back to the URL host (routed straight to Pages), without its port', () => {
    expect(effectiveHost(req('https://reports.agency.com:8443/signin'), ENV)).toBe('reports.agency.com');
  });

  it('refuses a trusted header that is not a hostname', () => {
    expect(effectiveHost(req('https://x.pages.dev/', { 'X-Seentics-Original-Host': 'evil.test/path', 'X-Seentics-Edge-Secret': SECRET }), ENV)).toBe('x.pages.dev');
  });

  it('compares secrets byte for byte', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('decideCustomHostRequest', () => {
  const allowed = [
    '/signin', '/signin/', '/signin.txt', '/signin/__next.signin.txt', '/signin/verify', '/signin/verify.txt',
    '/websites', '/websites/abc', '/websites/abc/events', '/websites/abc/replays/s1', '/websites/abc/heatmaps',
    '/websites/abc/settings/goals', '/websites/abc/settings/privacy', '/websites/abc/events/__next.websites.$d$websiteId.events.txt',
    '/embed/w1', '/embed/w1.txt', '/api/v1/client/me', '/api/v1/client-auth/brand', '/_next/static/chunks/a.js',
    '/images/country/us.svg', '/favicon.ico', '/icon.svg',
  ];
  const denied = [
    '/pricing', '/docs', '/docs/agency', '/blog', '/blog/x', '/agency', '/agency/clients', '/agencies', '/signup', '/setup',
    '/tools/page-speed', '/contact', '/terms', '/index.html', '/__next._tree.txt', '/websites/manage', '/websites/demo',
    '/websites/abc/developers', '/websites/abc/docs', '/websites/abc/ui-blocks', '/websites/abc/developers.txt',
    ...['billing', 'team', 'profile', 'support', 'websites', 'tracking', 'features', 'integrations', 'alerts'].map(t => `/websites/abc/settings/${t}`),
    '/websites/abc/settings/billing.txt', '/embed', '/api/contact', '/api/tools/page-speed', '/forgot-password', '/share/x', '/public/x',
    '/client-portal/scp_abc', '/trackers/seentics.min.js',
  ];

  it('serves the client dashboard, sign-in, embeds, the API and static files', () => {
    for (const p of allowed) expect([p, decideCustomHostRequest(p).kind]).toEqual([p, 'allow']);
  });

  it('serves nothing of Seentics’ own', () => {
    for (const p of denied) expect([p, decideCustomHostRequest(p).kind]).toEqual([p, 'not-found']);
  });

  it('sends / to the dashboard and keeps robots out', () => {
    expect(decideCustomHostRequest('/')).toEqual({ kind: 'redirect', location: '/websites' });
    expect(decideCustomHostRequest('/robots.txt')).toEqual({ kind: 'robots' });
  });
});

function memoryCache(): CacheLike & { store: Map<string, Response> } {
  const store = new Map<string, Response>();
  return {
    store,
    match: async (r: Request) => store.get(r.url)?.clone(),
    put: async (r: Request, res: Response) => void store.set(r.url, res),
  };
}

describe('serveCustomHost', () => {
  const visit = (path: string) =>
    new Request(`https://seentics-web.pages.dev${path}`, {
      headers: { 'X-Seentics-Original-Host': 'reports.agency.com', 'X-Seentics-Edge-Secret': SECRET, 'CF-Connecting-IP': '203.0.113.9' },
    });
  const gateway = (status: number) =>
    vi.fn(async () => new Response(status === 200 ? JSON.stringify({ data: { brand_name: 'Meridian', logo_url: 'https://cdn.meridian.test/logo.png', slug: 'meridian' } }) : '{}', { status }));
  const page = () => vi.fn(async () => new Response('<html></html>', { status: 200, headers: { 'X-Frame-Options': 'SAMEORIGIN', 'Content-Type': 'text/html' } }));

  it('looks the host up at the gateway with the edge headers, and caches the answer', async () => {
    const fetch = gateway(200);
    const cache = memoryCache();
    const next = page();
    const res = await serveCustomHost(visit('/websites'), ENV, next, { fetch, cache });
    expect(res.status).toBe(200);
    expect(next).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://gw.test/api/v1/client-auth/brand?host=reports.agency.com');
    const h = new Headers(init.headers);
    expect(h.get('X-Seentics-Edge-Secret')).toBe(SECRET);
    expect(h.get('X-Seentics-Edge-Client-IP')).toBe('203.0.113.9');
    expect(cache.store.size).toBe(1);
    expect([...cache.store.values()][0]!.headers.get('Cache-Control')).toBe('public, max-age=60');

    await serveCustomHost(visit('/websites/abc'), ENV, page(), { fetch, cache });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('adds the security headers, replacing Pages’ own frame header', async () => {
    const res = await serveCustomHost(visit('/websites/abc'), ENV, page(), { fetch: gateway(200) });
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Content-Security-Policy')).toBe(contentSecurityPolicy(false));
    expect(res.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('X-Robots-Tag')).toContain('noindex');
  });

  it('lets embeds be framed', async () => {
    const res = await serveCustomHost(visit('/embed/w1'), ENV, page(), { fetch: gateway(200) });
    expect(res.headers.get('X-Frame-Options')).toBeNull();
    expect(res.headers.get('Content-Security-Policy')).toContain('frame-ancestors *');
  });

  it('answers 404 for everything on a host no agency has active (cached 30 s)', async () => {
    const cache = memoryCache();
    for (const p of ['/', '/websites', '/signin', '/robots.txt', '/api/v1/client/me']) {
      const next = page();
      const res = await serveCustomHost(visit(p), ENV, next, { fetch: gateway(404), cache });
      expect([p, res.status]).toEqual([p, 404]);
      expect(next).not.toHaveBeenCalled();
    }
    expect([...cache.store.values()][0]!.headers.get('Cache-Control')).toBe('public, max-age=30');
  });

  it('answers 404 for a page not served there without asking the gateway', async () => {
    const fetch = gateway(200);
    const res = await serveCustomHost(visit('/pricing'), ENV, page(), { fetch });
    expect(res.status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('redirects / to the dashboard and serves a robots file that disallows all', async () => {
    const home = await serveCustomHost(visit('/'), ENV, page(), { fetch: gateway(200) });
    expect(home.status).toBe(302);
    expect(home.headers.get('Location')).toBe('/websites');
    const robots = await serveCustomHost(visit('/robots.txt'), ENV, page(), { fetch: gateway(200) });
    expect(await robots.text()).toBe('User-agent: *\nDisallow: /\n');
  });

  it('does not cache a gateway failure', async () => {
    const cache = memoryCache();
    expect(await lookupCustomHost('reports.agency.com', visit('/'), ENV, { fetch: gateway(502), cache })).toEqual({ state: 'error' });
    expect(cache.store.size).toBe(0);
    const res = await serveCustomHost(visit('/websites'), ENV, page(), { fetch: vi.fn(async () => { throw new Error('down'); }) });
    expect(res.status).toBe(503);
  });
});

describe('proxyApiRequest', () => {
  const upstream = (headers: [string, string][] = []) =>
    vi.fn(async (_req: Request) => {
      const h = new Headers({ 'Content-Type': 'application/json' });
      for (const [k, v] of headers) h.append(k, v);
      return new Response('{"ok":true}', { status: 201, headers: h });
    });

  it('tells the gateway which agency domain the request came in on', async () => {
    const fetch = upstream();
    const req = new Request('https://seentics-web.pages.dev/api/v1/client/me?x=1', {
      method: 'POST',
      body: '{"a":1}',
      headers: {
        'X-Seentics-Original-Host': 'reports.agency.com', 'X-Seentics-Edge-Secret': SECRET, 'CF-Connecting-IP': '203.0.113.9',
        Authorization: 'Bearer t', Cookie: 'a=b', 'Content-Type': 'application/json',
      },
    });
    const res = await proxyApiRequest(req, ENV, ['client', 'me'], fetch);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true });
    const sent = fetch.mock.calls[0]![0];
    expect(sent.url).toBe('https://gw.test/api/v1/client/me?x=1');
    expect(sent.method).toBe('POST');
    expect(await sent.text()).toBe('{"a":1}');
    expect(sent.headers.get('X-Seentics-Edge-Host')).toBe('reports.agency.com');
    expect(sent.headers.get('X-Seentics-Edge-Secret')).toBe(SECRET);
    expect(sent.headers.get('X-Seentics-Edge-Client-IP')).toBe('203.0.113.9');
    expect(sent.headers.get('X-Seentics-Original-Host')).toBeNull();
    expect(sent.headers.get('Authorization')).toBe('Bearer t');
    expect(sent.headers.get('Cookie')).toBeNull();
  });

  it('works when Cloudflare routes the custom domain straight to Pages', async () => {
    const fetch = upstream();
    await proxyApiRequest(new Request('https://reports.agency.com/api/v1/client/me'), ENV, ['client', 'me'], fetch);
    expect(fetch.mock.calls[0]![0].headers.get('X-Seentics-Edge-Host')).toBe('reports.agency.com');
  });

  it('never forwards edge headers the browser made up', async () => {
    const fetch = upstream();
    const req = new Request('https://seentics.com/api/v1/user/auth/me', {
      headers: { 'X-Seentics-Edge-Host': 'victim.agency.com', 'X-Seentics-Edge-Secret': 'guess', 'X-Seentics-Edge-Client-IP': '1.1.1.1', 'CF-Connecting-IP': '203.0.113.9' },
    });
    await proxyApiRequest(req, ENV, ['user', 'auth', 'me'], fetch);
    const sent = fetch.mock.calls[0]![0];
    expect(sent.headers.get('X-Seentics-Edge-Host')).toBeNull();
    expect(sent.headers.get('X-Seentics-Edge-Secret')).toBe(SECRET);
    expect(sent.headers.get('X-Seentics-Edge-Client-IP')).toBe('203.0.113.9');
  });

  it('strips .seentics.com cookies on an agency domain, keeping the rest of the response', async () => {
    const fetch = upstream([
      ['Set-Cookie', 'access_token=x; Domain=.seentics.com; Path=/; HttpOnly'],
      ['Set-Cookie', 'refresh_token=y; Path=/; domain=seentics.com'],
      ['Set-Cookie', 'pref=1; Path=/'],
      ['X-Request-Id', 'r1'],
    ]);
    const req = new Request('https://reports.agency.com/api/v1/client-auth/verify', { method: 'POST', body: '{}' });
    const res = await proxyApiRequest(req, ENV, ['client-auth', 'verify'], fetch);
    expect(res.headers.getSetCookie()).toEqual(['pref=1; Path=/']);
    expect(res.headers.get('X-Request-Id')).toBe('r1');
    expect(res.status).toBe(201);
  });

  it('leaves seentics.com responses as they are', async () => {
    const fetch = upstream([['Set-Cookie', 'access_token=x; Domain=.seentics.com']]);
    const res = await proxyApiRequest(new Request('https://seentics.com/api/v1/auth/refresh', { method: 'POST' }), ENV, ['auth', 'refresh'], fetch);
    expect(res.headers.getSetCookie()).toHaveLength(1);
    expect(fetch.mock.calls[0]![0].headers.get('X-Seentics-Edge-Host')).toBeNull();
  });

  it('knows a seentics.com cookie', () => {
    expect(isSeenticsCookie('a=b; Domain=.seentics.com')).toBe(true);
    expect(isSeenticsCookie('a=b; domain=api.seentics.com; Path=/')).toBe(true);
    expect(isSeenticsCookie('a=b; Path=/')).toBe(false);
    expect(isSeenticsCookie('a=b; Domain=seentics.com.evil.test')).toBe(false);
  });
});

/** A stand-in for HTMLRewriter over a parsed list of elements: enough to check what each tag becomes. */
type FakeEl = { tag: string; attrs: Record<string, string>; inner?: string; removed?: boolean };
function fakeRewriter(els: FakeEl[]): () => RewriterLike {
  const matches = (el: FakeEl, selector: string) =>
    selector.split(',').some(sel => {
      const m = /^\s*(\w+)(?:\[(\w+(?::\w+)?)(\^|~)?="([^"]+)"\])?\s*$/.exec(sel);
      if (!m) throw new Error(`selector ${sel}`);
      const [, tag, attr, op, value] = m;
      if (el.tag !== tag) return false;
      if (!attr) return true;
      const v = el.attrs[attr!];
      if (v === undefined) return false;
      if (op === '^') return v.startsWith(value!);
      if (op === '~') return v.split(/\s+/).includes(value!);
      return v === value;
    });
  return () => {
    const rules: Array<[string, (el: RewriterElement) => void]> = [];
    const r: RewriterLike = {
      on(selector, h) { rules.push([selector, h.element]); return r; },
      transform(res) {
        for (const el of els) {
          for (const [sel, fn] of rules) {
            if (el.removed || !matches(el, sel)) continue;
            fn({
              getAttribute: n => el.attrs[n] ?? null,
              setAttribute: (n, v) => { el.attrs[n] = v; },
              removeAttribute: n => { delete el.attrs[n]; },
              setInnerContent: c => { el.inner = c; },
              remove: () => { el.removed = true; },
            });
          }
        }
        return res;
      },
    };
    return r;
  };
}

describe('the brand in the static HTML', () => {
  const head = (): FakeEl[] => [
    { tag: 'title', attrs: {}, inner: 'Seentics | See why visitors leave' },
    { tag: 'meta', attrs: { name: 'description', content: 'Analytics… Open source' } },
    { tag: 'meta', attrs: { property: 'og:title', content: 'Seentics | …' } },
    { tag: 'meta', attrs: { property: 'og:description', content: '…' } },
    { tag: 'meta', attrs: { property: 'og:site_name', content: 'Seentics' } },
    { tag: 'meta', attrs: { property: 'og:url', content: 'https://seentics.com' } },
    { tag: 'meta', attrs: { property: 'og:image', content: 'https://seentics.com/images/app/photo-1.png' } },
    { tag: 'meta', attrs: { property: 'og:image:alt', content: 'Seentics Analytics Dashboard' } },
    { tag: 'meta', attrs: { property: 'og:type', content: 'website' } },
    { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
    { tag: 'meta', attrs: { name: 'twitter:title', content: 'Seentics | …' } },
    { tag: 'meta', attrs: { name: 'twitter:image', content: 'https://seentics.com/images/app/photo-1.png' } },
    { tag: 'link', attrs: { rel: 'canonical', href: 'https://seentics.com/websites' } },
    { tag: 'link', attrs: { rel: 'alternate', href: 'https://seentics.com/feed' } },
    { tag: 'link', attrs: { rel: 'icon', href: '/favicon.ico', sizes: '48x48', type: 'image/x-icon' } },
    { tag: 'link', attrs: { rel: 'icon', href: '/icon.svg', sizes: 'any', type: 'image/svg+xml' } },
    { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/apple-icon.png' } },
  ];
  const html = () => new Response('<html></html>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  const leftover = (els: FakeEl[]) => els.filter(e => !e.removed);

  it('puts the brand name in the title and every title, description and site-name meta, and drops Seentics links and images', () => {
    const els = head();
    applyBrandToHtml(html(), { brand_name: 'Meridian', logo_url: '' }, fakeRewriter(els));
    const kept = leftover(els);
    expect(kept.find(e => e.tag === 'title')!.inner).toBe('Meridian');
    for (const e of kept.filter(e => e.tag === 'meta' && e.attrs.property !== 'og:type')) expect(e.attrs.content).toBe('Meridian');
    expect(JSON.stringify(kept.filter(e => e.tag === 'meta'))).not.toMatch(/seentics/i);
    expect(kept.some(e => e.attrs.rel === 'canonical' || e.attrs.rel === 'alternate')).toBe(false);
    // No logo: the icons are left alone.
    expect(kept.filter(e => e.tag === 'link').map(e => e.attrs.href)).toEqual(['/favicon.ico', '/icon.svg', '/apple-icon.png']);
  });

  it('makes the brand logo the only icon', () => {
    const els = head();
    applyBrandToHtml(html(), { brand_name: 'Meridian', logo_url: 'https://cdn.meridian.test/logo.png' }, fakeRewriter(els));
    expect(leftover(els).filter(e => e.tag === 'link')).toEqual([{ tag: 'link', attrs: { rel: 'icon', href: 'https://cdn.meridian.test/logo.png' } }]);
  });

  it('leaves anything that is not HTML alone', () => {
    const factory = vi.fn(fakeRewriter([]));
    const json = new Response('{}', { headers: { 'Content-Type': 'application/json' } });
    expect(applyBrandToHtml(json, { brand_name: 'Meridian' }, factory)).toBe(json);
    expect(factory).not.toHaveBeenCalled();
  });

  it('rewrites pages served on an active agency domain, with the cached brand', async () => {
    const els = head();
    const cache = memoryCache();
    const fetch = vi.fn(async () => new Response(JSON.stringify({ data: { brand_name: 'Meridian', logo_url: '' } }), { status: 200 }));
    const page = async () => new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } });
    const visit = () => new Request('https://reports.agency.com/websites');
    await serveCustomHost(visit(), ENV, page, { fetch, cache });
    await serveCustomHost(visit(), ENV, page, { fetch, cache, rewriter: fakeRewriter(els) });
    expect(fetch).toHaveBeenCalledOnce();
    expect(els[0]!.inner).toBe('Meridian');
  });
});
