// Cloudflare Pages Function — same-origin API proxy, replacing next.config's
// `/api/v1/:path*` rewrite (static export can't ship rewrites() — no
// Next.js server left at request time to run them).
//
// Cloudflare Pages Functions route more-specific files ahead of a catch-all
// at the same level, same as Next's own file-based routing — so
// api/v1/tracker/collect.ts and api/v1/tracker/[[path]].ts both take this
// request before it ever reaches here for anything under /api/v1/tracker/*.
// This only ever sees the rest: auth, entitlements, websites, funnels, etc.

interface Env {
  GATEWAY_URL?: string;
  /** Shared with the gateway: proves the visitor address below came from this Function. */
  EDGE_PROXY_SECRET?: string;
}

interface RequestContext {
  request: Request;
  env: Env;
  params: { path?: string | string[] };
}

export const onRequest = async (context: RequestContext): Promise<Response> => {
  const { request, env, params } = context;
  const segments = Array.isArray(params.path) ? params.path : params.path ? [params.path] : [];

  const upstreamUrl = new URL(`/api/v1/${segments.join('/')}`, env.GATEWAY_URL ?? 'https://api.seentics.com');
  upstreamUrl.search = new URL(request.url).search;

  // On this second hop Cloudflare reports this Function as the client, so every user would
  // share one address at the gateway. The visitor's own address goes along, with the
  // secret that lets the gateway believe it (gateway/lib/client-ip.ts).
  const forwarded = new Request(upstreamUrl, request);
  const visitor = request.headers.get('CF-Connecting-IP');
  if (env.EDGE_PROXY_SECRET && visitor) {
    forwarded.headers.set('X-Seentics-Edge-Client-IP', visitor);
    forwarded.headers.set('X-Seentics-Edge-Secret', env.EDGE_PROXY_SECRET);
  }
  return fetch(forwarded);
};
