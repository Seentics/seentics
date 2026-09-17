// Cloudflare Pages Function — replaces src/app/api/v1/tracker/[...path]/route.ts.
//
// Catch-all proxy for all tracker endpoints:
//   /api/v1/tracker/init/:websiteId
//   /api/v1/tracker/request-screenshot
//   /api/v1/tracker/automations/evaluate
//   /api/v1/tracker/config/:websiteId
//   (all other /api/v1/tracker/* paths not handled by collect.ts)
//
// Tracker scripts run on any customer website (cross-origin by design), so
// this owns CORS explicitly rather than relying on the browser only ever
// hitting it same-origin. Static export can't ship this as a Next.js route
// handler (GET-only), so the logic moved here unchanged.
//
// The core API already validates the website domain per-request, so
// allowing any origin here is safe.

interface Env {
  GATEWAY_URL?: string;
}

interface RequestContext {
  request: Request;
  env: Env;
  params: { path?: string | string[] };
}

// sendBeacon uses credentials: 'include' — must reflect specific origin + set Credentials: true.
// Never use wildcard '*' with Access-Control-Allow-Credentials: true.
function corsHeaders(origin: string): Record<string, string> {
  const shared = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Content-Length, Accept-Encoding, Content-Encoding, Authorization, X-API-Key, X-Site-ID, X-Requested-With, Cache-Control',
    'Access-Control-Max-Age': '86400',
  };
  if (origin) {
    return { ...shared, 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', Vary: 'Origin' };
  }
  return { ...shared, 'Access-Control-Allow-Origin': '*' };
}

export const onRequestOptions = async (context: RequestContext): Promise<Response> => {
  const origin = context.request.headers.get('origin') ?? '';
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
};

const proxy = async (context: RequestContext): Promise<Response> => {
  const { request, env, params } = context;
  const segments = Array.isArray(params.path) ? params.path : params.path ? [params.path] : [];
  const origin = request.headers.get('origin') ?? '';

  const target = new URL(`/api/v1/tracker/${segments.join('/')}`, env.GATEWAY_URL ?? 'https://api.seentics.com');
  target.search = new URL(request.url).search;

  const forwardHeaders = new Headers(request.headers);
  forwardHeaders.delete('host');

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers: forwardHeaders,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      // @ts-ignore — duplex needed for streaming request bodies
      duplex: 'half',
    });

    const responseHeaders = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(corsHeaders(origin))) {
      responseHeaders.set(k, v);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error('[tracker proxy]', err);
    return new Response('proxy error', { status: 502, headers: corsHeaders(origin) });
  }
};

export const onRequestGet = proxy;
export const onRequestPost = proxy;
export const onRequestPut = proxy;
export const onRequestDelete = proxy;
export const onRequestPatch = proxy;
