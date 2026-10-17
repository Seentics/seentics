// Agencies' own domains (reports.agency.com, CNAMEd to us through Cloudflare for SaaS) serve the
// client dashboard (phase 3, docs/agency-workspace.md "White-label domain serving the full
// dashboard"): a branded sign-in, the client's websites, embeds and a same-origin API — nothing of
// Seentics' own (marketing, docs, sign-up, the Agency workspace, account settings).
//
// Kept free of the Pages runtime (fetch and the cache come in as arguments) so it can be
// unit-tested; functions/_middleware.ts and functions/api/v1/[[path]].ts call into it.
//
// How the visitor's host reaches us:
// - Through the Worker in front of Pages (deploy/cloudflare): the request's own Host is the Pages
//   host, and the Worker names the custom hostname in `X-Seentics-Original-Host`, with
//   `X-Seentics-Edge-Secret: <EDGE_PROXY_SECRET>` proving the header came from it.
// - Routed straight to Pages: the request's Host is the custom hostname itself.

/** Our own hosts, which serve Seentics as usual. Mirrored by src/lib/seentics-host.ts. */
export function isSeenticsHost(hostname: string): boolean {
  const h = normalizeHost(hostname);
  return (
    h === 'seentics.com' ||
    h.endsWith('.seentics.com') ||
    h.endsWith('.pages.dev') ||
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '[::1]'
  );
}

/** Set by the Worker in front of Pages: the hostname the visitor asked for. */
export const ORIGINAL_HOST_HEADER = 'X-Seentics-Original-Host';
/** Shared secret between the Worker, these Functions and the gateway. */
export const EDGE_SECRET_HEADER = 'X-Seentics-Edge-Secret';
/** Sent to the gateway: the custom hostname the request came in on. */
export const EDGE_HOST_HEADER = 'X-Seentics-Edge-Host';
/** Sent to the gateway: the visitor's own address (this Function is the client on that hop). */
export const EDGE_CLIENT_IP_HEADER = 'X-Seentics-Edge-Client-IP';

export interface EdgeEnv {
  EDGE_PROXY_SECRET?: string;
  GATEWAY_URL?: string;
}

export const gatewayBase = (env: EdgeEnv): string => (env.GATEWAY_URL ?? 'https://api.seentics.com').replace(/\/+$/, '');

/** Lower case, no port, no trailing dot. */
export function normalizeHost(host: string): string {
  let h = host.trim().toLowerCase();
  if (h.startsWith('[')) {
    const end = h.indexOf(']');
    h = end === -1 ? h : h.slice(0, end + 1);
  } else {
    h = h.replace(/:\d+$/, '');
  }
  return h.replace(/\.$/, '');
}

const HOSTNAME = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** Compares without stopping at the first difference (only the length leaks). */
export function constantTimeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0;
}

/** Whether the request carries our edge secret (and we have one to compare with). */
export function hasEdgeSecret(request: Request, env: EdgeEnv): boolean {
  const secret = env.EDGE_PROXY_SECRET;
  const sent = request.headers.get(EDGE_SECRET_HEADER);
  return Boolean(secret && sent && constantTimeEqual(sent, secret));
}

/**
 * The host the visitor used: the Worker's `X-Seentics-Original-Host` when it carries our secret
 * (and is a plain hostname), else the request URL's own host. Without the secret the header is
 * anyone's to send, so it is ignored.
 */
export function effectiveHost(request: Request, env: EdgeEnv): string {
  const original = request.headers.get(ORIGINAL_HOST_HEADER);
  if (original && hasEdgeSecret(request, env)) {
    const h = normalizeHost(original);
    if (HOSTNAME.test(h)) return h;
  }
  return normalizeHost(new URL(request.url).host);
}

// ─── What a custom host serves ────────────────────────────────────────────────

/** Account-only settings tabs: never on an agency's domain. */
const BLOCKED_SETTINGS = new Set(['billing', 'team', 'profile', 'support', 'websites', 'tracking', 'features', 'integrations', 'alerts']);
/** Account-only pages of a website. */
const BLOCKED_WEBSITE_PAGES = new Set(['developers', 'docs', 'ui-blocks']);
/** Not a client's website: the account's site manager, and Seentics' public demo. */
const BLOCKED_WEBSITE_IDS = new Set(['manage', 'demo']);
/** Static files the dashboard itself uses (flags, browser and source icons, the favicon). */
const STATIC_FILES = new Set(['/favicon.ico', '/icon.svg', '/apple-icon.png']);

/**
 * The page a path belongs to: static export serves `/x` from `x.html`, and its RSC payloads as
 * `/x.txt` and `/x/__next.<segments>.txt`; all of them are judged as `/x`.
 */
export function routeOf(pathname: string): string {
  let p = pathname.replace(/\/+$/, '') || '/';
  p = p.replace(/\/__next\.[^/]*\.txt$/, '') || '/';
  p = p.replace(/\.(txt|html)$/, '');
  return p || '/';
}

function websitesAllowed(route: string): boolean {
  if (route === '/websites') return true;
  if (!route.startsWith('/websites/')) return false;
  const [id, page, tab] = route.slice('/websites/'.length).split('/');
  if (!id || BLOCKED_WEBSITE_IDS.has(id)) return false;
  if (page && BLOCKED_WEBSITE_PAGES.has(page)) return false;
  if (page === 'settings' && tab && BLOCKED_SETTINGS.has(tab)) return false;
  return true;
}

export type CustomHostDecision =
  | { kind: 'allow' }
  | { kind: 'redirect'; location: string }
  | { kind: 'robots' }
  | { kind: 'not-found' };

/**
 * What an agency's (active) domain answers for a path:
 *
 * - allowed: `/signin`, `/signin/verify`, `/websites` and `/websites/<id>/…` (but not
 *   `/websites/manage`, `/websites/demo`, `/websites/<id>/{developers,docs,ui-blocks}` or
 *   `/websites/<id>/settings/{billing,team,profile,support,websites,tracking,features,
 *   integrations,alerts}`), `/embed/*`, `/api/v1/*`, `/_next/*`, `/images/*`, `/favicon.ico`,
 *   `/icon.svg`, `/apple-icon.png`;
 * - `/` → 302 `/websites`; `/robots.txt` → `Disallow: /`;
 * - everything else (marketing, `/pricing`, `/docs`, `/blog`, `/agency*`, `/signup`, `/setup`,
 *   `/agencies`, `/tools`, other `/api/*`…) → 404.
 */
export function decideCustomHostRequest(pathname: string): CustomHostDecision {
  if (pathname === '/') return { kind: 'redirect', location: '/websites' };
  if (pathname === '/robots.txt') return { kind: 'robots' };
  if (pathname.startsWith('/api/v1/')) return { kind: 'allow' };
  if (pathname.startsWith('/_next/') || pathname.startsWith('/images/') || STATIC_FILES.has(pathname)) return { kind: 'allow' };
  const route = routeOf(pathname);
  if (route === '/signin' || route === '/signin/verify') return { kind: 'allow' };
  if (route.startsWith('/embed/') && route.length > '/embed/'.length) return { kind: 'allow' };
  if (websitesAllowed(route)) return { kind: 'allow' };
  return { kind: 'not-found' };
}

// ─── Security headers ─────────────────────────────────────────────────────────

/**
 * The Content-Security-Policy on an agency's domain.
 *
 * - Scripts: this origin only. `'unsafe-inline'` because a static export has no per-request nonce
 *   and Next inlines its RSC bootstrap; no third-party script (no chat, no tracker) can load.
 * - API: same origin (`/api/v1`). `connect-src https:` as well, for recordings' and heatmap
 *   snapshots' presigned object-store URLs, whose host depends on the deployment.
 * - Images, styles, fonts and media from any https origin (plus data:/blob:): a replay rebuilds the
 *   tracked site's page (its stylesheets, images and fonts) in an iframe that inherits this policy,
 *   and a heatmap shows the archived snapshot of it. Source favicons come from www.google.com.
 * - Frames: this origin, https (heatmap snapshots served from the object store), blob:/data:.
 * - Nothing may frame the dashboard (`frame-ancestors 'none'`), except `/embed/*`, which exists
 *   to be iframed by the agency's own product (`frame-ancestors *`; its token guards it).
 * - No plugins, `<base>` or forms to other origins.
 */
export function contentSecurityPolicy(embed: boolean): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "connect-src 'self' https:",
    "img-src 'self' data: blob: https:",
    "style-src 'self' 'unsafe-inline' https:",
    "font-src 'self' data: https:",
    "media-src 'self' data: blob: https:",
    "frame-src 'self' blob: data: https:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${embed ? '*' : "'none'"}`,
  ].join('; ');
}

/** Headers every response on an agency's domain carries. */
export function customHostSecurityHeaders(pathname: string): Record<string, string> {
  const embed = routeOf(pathname).startsWith('/embed/');
  return {
    'Content-Security-Policy': contentSecurityPolicy(embed),
    ...(embed ? {} : { 'X-Frame-Options': 'DENY' }),
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Content-Type-Options': 'nosniff',
  };
}

function withHeaders(res: Response, extra: Record<string, string>, drop: string[] = []): Response {
  const headers = new Headers(res.headers);
  for (const name of drop) headers.delete(name);
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

// ─── Which agency owns the host ───────────────────────────────────────────────

export interface CacheLike {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

export interface CustomHostDeps {
  fetch: typeof fetch;
  /** `caches.default` on Cloudflare; absent in tests or local dev. */
  cache?: CacheLike;
  /** `() => new HTMLRewriter()` on Cloudflare; without it HTML is served unbranded. */
  rewriter?: RewriterFactory;
}

/** The part of the agency's brand the edge uses (the gateway's `GET /client-auth/brand` `data`). */
export interface HostBrand {
  brand_name?: string;
  logo_url?: string;
}

const cacheKey = (host: string) => new Request(`https://custom-host.seentics.internal/brand?host=${encodeURIComponent(host)}`);

export type HostLookup = { state: 'active'; brand: HostBrand } | { state: 'unknown' } | { state: 'error' };

/**
 * Whether an agency has `host` as its active domain, and its brand: `GET /client-auth/brand?host=`
 * at the gateway (200 → active, 404 → unknown or not active yet). Answers are cached at the edge,
 * 60 s for a hit and 30 s for a miss; a gateway failure is not cached.
 */
export async function lookupCustomHost(host: string, request: Request, env: EdgeEnv, deps: CustomHostDeps): Promise<HostLookup> {
  const key = cacheKey(host);
  const cached = await deps.cache?.match(key).catch(() => undefined);
  if (cached) {
    if (cached.status !== 200) return { state: 'unknown' };
    return { state: 'active', brand: ((await cached.json().catch(() => ({}))) as HostBrand) ?? {} };
  }

  const url = `${gatewayBase(env)}/api/v1/client-auth/brand?host=${encodeURIComponent(host)}`;
  const headers = new Headers({ Accept: 'application/json' });
  if (env.EDGE_PROXY_SECRET) {
    headers.set(EDGE_SECRET_HEADER, env.EDGE_PROXY_SECRET);
    const visitor = request.headers.get('CF-Connecting-IP');
    if (visitor) headers.set(EDGE_CLIENT_IP_HEADER, visitor);
  }
  let res: Response;
  try {
    res = await deps.fetch(url, { method: 'GET', headers });
  } catch {
    return { state: 'error' };
  }
  if (res.status === 404) {
    await deps.cache?.put(key, new Response(null, { status: 404, headers: { 'Cache-Control': 'public, max-age=30' } })).catch(() => undefined);
    return { state: 'unknown' };
  }
  if (!res.ok) return { state: 'error' };
  const body = (await res.json().catch(() => ({}))) as { data?: HostBrand };
  const brand: HostBrand = { brand_name: body.data?.brand_name ?? '', logo_url: body.data?.logo_url ?? '' };
  await deps.cache
    ?.put(key, new Response(JSON.stringify(brand), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } }))
    .catch(() => undefined);
  return { state: 'active', brand };
}

// ─── The brand in the static HTML ─────────────────────────────────────────────

/** The parts of Cloudflare's HTMLRewriter used here, so tests can pass a stand-in. */
export interface RewriterElement {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): unknown;
  removeAttribute(name: string): unknown;
  setInnerContent(content: string): unknown;
  remove(): unknown;
}
export interface RewriterLike {
  on(selector: string, handlers: { element(el: RewriterElement): void }): RewriterLike;
  transform(response: Response): Response;
}
export type RewriterFactory = () => RewriterLike;

/**
 * What the static export's `<head>` says about Seentics, put in the agency's words before the
 * page leaves the edge (tab titles and link previews are read before any script runs):
 * the title and every title/description/site-name meta become the brand name; preview images,
 * `og:url`, canonical and alternate links are dropped; with an https logo, it is the only icon.
 */
export function brandHeadHandlers(brand: HostBrand): Array<[string, (el: RewriterElement) => void]> {
  const name = (brand.brand_name ?? '').trim() || 'Dashboard';
  const logo = brand.logo_url && brand.logo_url.startsWith('https://') ? brand.logo_url : null;
  const handlers: Array<[string, (el: RewriterElement) => void]> = [
    ['title', el => el.setInnerContent(name)],
    [
      'meta[name="description"], meta[property="og:title"], meta[property="og:description"], meta[property="og:site_name"], meta[name="twitter:title"], meta[name="twitter:description"]',
      el => el.setAttribute('content', name),
    ],
    [
      'meta[property="og:url"], meta[property^="og:image"], meta[name^="twitter:image"], meta[name="twitter:card"], meta[name="twitter:site"], meta[name="twitter:creator"], link[rel="canonical"], link[rel="alternate"]',
      el => el.remove(),
    ],
  ];
  if (logo) {
    let first = true;
    handlers.push([
      'link[rel~="icon"], link[rel="apple-touch-icon"]',
      el => {
        if (!first) {
          el.remove();
          return;
        }
        first = false;
        el.setAttribute('rel', 'icon');
        el.setAttribute('href', logo);
        el.removeAttribute('type');
        el.removeAttribute('sizes');
      },
    ]);
  }
  return handlers;
}

/** An HTML page, with its head in the agency's brand; anything else as it is. */
export function applyBrandToHtml(res: Response, brand: HostBrand, rewriter: RewriterFactory | undefined): Response {
  if (!rewriter || !(res.headers.get('Content-Type') ?? '').toLowerCase().includes('text/html')) return res;
  let r = rewriter();
  for (const [selector, element] of brandHeadHandlers(brand)) r = r.on(selector, { element });
  return r.transform(res);
}

const plain = (status: number, body: string, pathname: string, extra: Record<string, string> = {}) =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...customHostSecurityHeaders(pathname), ...extra },
  });

/**
 * A request on an agency's domain, end to end: 404 for anything not served there or on a host no
 * agency has active; the robots file; `/` to the dashboard; else the page (or API proxy) with the
 * security headers, and an HTML page's head in the agency's brand.
 */
export async function serveCustomHost(
  request: Request,
  env: EdgeEnv,
  next: () => Promise<Response>,
  deps: CustomHostDeps,
  host: string = effectiveHost(request, env),
): Promise<Response> {
  const { pathname } = new URL(request.url);
  const decision = decideCustomHostRequest(pathname);
  if (decision.kind === 'not-found') return plain(404, 'Not found', pathname);

  const lookup = await lookupCustomHost(host, request, env, deps);
  if (lookup.state === 'unknown') return plain(404, 'Not found', pathname);
  if (lookup.state === 'error') return plain(503, 'Temporarily unavailable', pathname, { 'Retry-After': '30' });

  if (decision.kind === 'robots') return plain(200, 'User-agent: *\nDisallow: /\n', pathname);
  if (decision.kind === 'redirect') {
    return new Response(null, { status: 302, headers: { Location: decision.location, 'Cache-Control': 'no-store', ...customHostSecurityHeaders(pathname) } });
  }
  const res = await next();
  // Pages' _headers (X-Frame-Options and the embed CSP) are replaced by this host's own.
  const secured = withHeaders(res, customHostSecurityHeaders(pathname), ['X-Frame-Options', 'Content-Security-Policy']);
  return applyBrandToHtml(secured, lookup.brand, deps.rewriter);
}
