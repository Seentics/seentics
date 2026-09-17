// Cloudflare Pages Function — replaces src/app/api/v1/tracker/collect/route.ts.
//
// Streaming proxy for the tracker collect endpoint. Session replay
// FullSnapshot batches routinely exceed 10 MB; this streams the request
// body straight through to the gateway rather than buffering it, same as
// the Next.js route handler it replaces did (and for the same reason next's
// own rewrites() couldn't be used there either). Static export can't ship
// that route handler at all — GET-only is the limit there — so the logic
// moved here unchanged.
//
// Owns CORS explicitly — OPTIONS returns 204 immediately, no upstream
// round-trip for preflights.

interface Env {
  GATEWAY_URL?: string;
}

interface RequestContext {
  request: Request;
  env: Env;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Content-Length, Accept-Encoding, Content-Encoding, Authorization, X-API-Key, X-Requested-With, Cache-Control',
  'Access-Control-Max-Age': '86400',
};

function corsHeaders(origin: string): Record<string, string> {
  if (origin) {
    return {
      ...CORS_HEADERS,
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      Vary: 'Origin',
    };
  }
  return { ...CORS_HEADERS, 'Access-Control-Allow-Origin': '*' };
}

export const onRequestOptions = async (context: RequestContext): Promise<Response> => {
  const origin = context.request.headers.get('origin') ?? '';
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
};

const proxy = async (context: RequestContext): Promise<Response> => {
  const { request, env } = context;
  const origin = request.headers.get('origin') ?? '';
  const target = new URL('/api/v1/tracker/collect', env.GATEWAY_URL ?? 'https://api.seentics.com');

  const headers = new Headers(request.headers);
  headers.delete('host');

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      // @ts-ignore — duplex is valid but not in all type defs yet
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
    console.error('[tracker/collect proxy]', err);
    return new Response('proxy error', { status: 502, headers: corsHeaders(origin) });
  }
};

export const onRequestGet = proxy;
export const onRequestPost = proxy;
