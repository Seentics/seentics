// The same-origin API proxy (functions/api/v1/[[path]].ts), kept free of the Pages runtime so it
// can be unit-tested with a mocked fetch.
//
// On Seentics' own hosts it forwards as it always has (the dashboard there calls
// api.seentics.com directly; this is the fallback for `/api/v1`). On an agency's domain it is
// how the dashboard reaches the gateway at all: the gateway is told which domain the request came
// in on (`X-Seentics-Edge-Host`, believed only with the edge secret), and no cookie of
// `.seentics.com` is ever handed to the agency's domain.

import {
  EDGE_CLIENT_IP_HEADER,
  EDGE_HOST_HEADER,
  EDGE_SECRET_HEADER,
  ORIGINAL_HOST_HEADER,
  effectiveHost,
  gatewayBase,
  isSeenticsHost,
  type EdgeEnv,
} from './custom-host';

/** Headers only this Function may set: whatever the browser sent under these names is dropped. */
const EDGE_HEADERS = [EDGE_HOST_HEADER, EDGE_SECRET_HEADER, EDGE_CLIENT_IP_HEADER, ORIGINAL_HOST_HEADER];

/** Whether a Set-Cookie is scoped to seentics.com or a subdomain of it. */
export function isSeenticsCookie(setCookie: string): boolean {
  const m = /;\s*domain\s*=\s*\.?([^;\s]+)/i.exec(setCookie);
  if (!m) return false;
  const d = m[1]!.toLowerCase().replace(/\.$/, '');
  return d === 'seentics.com' || d.endsWith('.seentics.com');
}

function setCookiesOf(headers: Headers): string[] {
  const h = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof h.getSetCookie === 'function') return h.getSetCookie();
  const one = headers.get('Set-Cookie');
  return one ? [one] : [];
}

export async function proxyApiRequest(
  request: Request,
  env: EdgeEnv,
  segments: string[],
  fetchImpl: (request: Request) => Promise<Response> = fetch,
): Promise<Response> {
  const host = effectiveHost(request, env);
  const custom = !isSeenticsHost(host);

  const upstreamUrl = new URL(`/api/v1/${segments.join('/')}`, gatewayBase(env));
  upstreamUrl.search = new URL(request.url).search;

  const forwarded = new Request(upstreamUrl, request);
  for (const name of EDGE_HEADERS) forwarded.headers.delete(name);
  // On this second hop Cloudflare reports this Function as the client, so every user would
  // share one address at the gateway. The visitor's own address goes along, with the
  // secret that lets the gateway believe it (gateway/lib/client-ip.ts).
  const visitor = request.headers.get('CF-Connecting-IP');
  if (env.EDGE_PROXY_SECRET && (visitor || custom)) {
    forwarded.headers.set(EDGE_SECRET_HEADER, env.EDGE_PROXY_SECRET);
    if (visitor) forwarded.headers.set(EDGE_CLIENT_IP_HEADER, visitor);
  }
  if (custom) {
    forwarded.headers.set(EDGE_HOST_HEADER, host);
    // Sessions on an agency's domain are bearer tokens only; the browser's cookies for that
    // domain are the agency's business, not the gateway's.
    forwarded.headers.delete('Cookie');
  }

  const res = await fetchImpl(forwarded);
  if (!custom) return res;

  const cookies = setCookiesOf(res.headers);
  if (!cookies.some(isSeenticsCookie)) return res;
  const headers = new Headers(res.headers);
  headers.delete('Set-Cookie');
  for (const c of cookies) if (!isSeenticsCookie(c)) headers.append('Set-Cookie', c);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
