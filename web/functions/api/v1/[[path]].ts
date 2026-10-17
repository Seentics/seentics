// Cloudflare Pages Function — same-origin API proxy, replacing next.config's
// `/api/v1/:path*` rewrite (static export can't ship rewrites() — no
// Next.js server left at request time to run them).
//
// Cloudflare Pages Functions route more-specific files ahead of a catch-all
// at the same level, same as Next's own file-based routing — so
// api/v1/tracker/collect.ts and api/v1/tracker/[[path]].ts both take this
// request before it ever reaches here for anything under /api/v1/tracker/*.
// This only ever sees the rest: auth, entitlements, websites, funnels, etc.
//
// On an agency's own domain this is how the client dashboard reaches the gateway (getApiUrl
// returns `/api/v1` there): see functions/lib/api-proxy.ts.

import { proxyApiRequest } from '../../lib/api-proxy';

interface Env {
  GATEWAY_URL?: string;
  /** Shared with the gateway and the custom-domain Worker (see functions/lib/custom-host.ts). */
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
  return proxyApiRequest(request, env, segments);
};
