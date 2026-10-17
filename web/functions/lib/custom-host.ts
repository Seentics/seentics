// Agencies' own domains (reports.agency.com, CNAMEd to us through Cloudflare for SaaS) serve the
// white-label client portal and nothing else: never Seentics' marketing site, dashboard or API.
// The gateway owns those domains (/api/v1/agency/portal/host says whether one is live); this is
// the request-side half, kept free of the Pages runtime so it can be unit-tested.

/** Where a host that is not ours lands for anything but a portal link: a neutral "invalid link" page. */
export const PORTAL_INVALID_PATH = '/client-portal/invalid';

/** How long a host's answer is reused (as the gateway's own Cache-Control says), so a portal page's dozens of asset requests ask once. */
export const HOST_CACHE_SECONDS = { active: 60, inactive: 30 } as const;

/** Our own hosts, which this logic leaves alone. */
export function isSeenticsHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  return (
    h === 'seentics.com' ||
    h.endsWith('.seentics.com') ||
    h.endsWith('.pages.dev') ||
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '[::1]'
  );
}

/**
 * What the portal page needs, beside itself: the build's own files, and the few images the
 * dashboard draws (source logos, flags, browser/device/OS icons) and the favicon.
 */
const PORTAL_PATH_PREFIXES = [
  '/client-portal/',
  '/_next/',
  '/images/sources/',
  '/images/country/',
  '/images/browser/',
  '/images/device/',
  '/images/os/',
  '/fonts/',
];
const PORTAL_FILES = new Set(['/favicon.ico', '/icon.svg', '/apple-icon.png']);

export type CustomHostDecision = 'allow' | 'redirect-invalid' | 'not-found';

/** For a request to a host that is not ours, given whether the gateway says that host is live. */
export function decideCustomHostRequest(pathname: string, active: boolean): CustomHostDecision {
  if (!active) return 'not-found';
  if (pathname === '/' || pathname === '') return 'redirect-invalid';
  if (pathname.includes('..')) return 'not-found';
  if (PORTAL_FILES.has(pathname)) return 'allow';
  return PORTAL_PATH_PREFIXES.some((p) => pathname.startsWith(p)) ? 'allow' : 'not-found';
}

/** Reads the gateway's answer: `{ data: { hostname, active: true } }` (or `state: 'active'`) is live; its 404, or anything else, is not. */
export async function isActiveFromResponse(res: Response): Promise<boolean> {
  if (!res.ok) return false;
  const body = (await res.json().catch(() => null)) as { data?: { active?: unknown; state?: unknown } | null } | null;
  return body?.data?.active === true || body?.data?.state === 'active';
}

/**
 * On this second hop Cloudflare reports the Function as the client, so every visitor would share
 * one address at the gateway: the visitor's own goes along, with the secret that lets the gateway
 * believe it (gateway/lib/client-ip.ts), exactly as functions/api/v1/[[path]].ts sends it.
 */
export function edgeClientHeaders(request: Request, secret: string | undefined): Record<string, string> {
  const visitor = request.headers.get('CF-Connecting-IP');
  return secret && visitor ? { 'X-Seentics-Edge-Client-IP': visitor, 'X-Seentics-Edge-Secret': secret } : {};
}

interface CacheLike {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

/**
 * Whether `hostname` is an agency's live portal domain. Cached briefly through the Cache API
 * (per data centre); a gateway that cannot answer (5xx, rate-limited, unreachable) is a "no" that
 * is not cached. `headers` go with the lookup: the visitor's address for the gateway's rate limit.
 */
export async function isActivePortalHost(
  hostname: string,
  gatewayUrl: string,
  deps: { fetch: typeof fetch; cache?: CacheLike; headers?: Record<string, string> },
): Promise<boolean> {
  const url = new URL('/api/v1/agency/portal/host', gatewayUrl);
  url.searchParams.set('hostname', hostname.toLowerCase());
  const key = new Request(url.toString(), { method: 'GET' });

  const cached = await deps.cache?.match(key);
  if (cached) return (await cached.text()) === 'active';

  let active: boolean;
  try {
    const res = await deps.fetch(key.url, { headers: { Accept: 'application/json', ...deps.headers } });
    if (res.status >= 500 || res.status === 429) return false;
    active = await isActiveFromResponse(res);
  } catch {
    return false;
  }
  const ttl = active ? HOST_CACHE_SECONDS.active : HOST_CACHE_SECONDS.inactive;
  await deps.cache?.put(key, new Response(active ? 'active' : 'inactive', { headers: { 'Cache-Control': `max-age=${ttl}` } }));
  return active;
}
