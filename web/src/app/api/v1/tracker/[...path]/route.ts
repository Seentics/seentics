/**
 * Catch-all proxy for all tracker endpoints:
 *   /api/v1/tracker/init/:websiteId
 *   /api/v1/tracker/request-screenshot
 *   /api/v1/tracker/automations/evaluate
 *   /api/v1/tracker/config/:websiteId
 *   (all other /api/v1/tracker/* paths not handled by a sibling route)
 *
 * Tracker scripts run on any customer website (cross-origin by design).
 * Next.js generic rewrites strip CORS headers from the upstream on OPTIONS
 * preflights. This route handler owns CORS explicitly:
 *   - OPTIONS: short-circuits with 204 + CORS headers (no upstream round-trip)
 *   - All other methods: proxy to gateway, inject CORS headers onto response
 *
 * The core API already validates the website domain per-request, so
 * allowing any origin here is safe.
 */

import { type NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.API_GATEWAY_URL ?? 'http://gateway:8080';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Methods':  'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Content-Length, Accept-Encoding, Content-Encoding, Authorization, X-API-Key, X-Site-ID, X-Requested-With, Cache-Control',
  'Access-Control-Max-Age': '86400',
};

function corsHeaders(origin: string): Record<string, string> {
  return {
    ...CORS_HEADERS,
    'Access-Control-Allow-Origin': origin || '*',
    ...(origin ? { Vary: 'Origin' } : {}),
  };
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') ?? '';
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

async function proxy(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const origin   = request.headers.get('origin') ?? '';
  const search   = request.nextUrl.search;
  const target   = `${GATEWAY}/api/v1/tracker/${path.join('/')}${search}`;

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
    // Inject/overwrite CORS headers — ensures they survive even if upstream omits them
    for (const [k, v] of Object.entries(corsHeaders(origin))) {
      responseHeaders.set(k, v);
    }

    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error('[tracker proxy]', err);
    return new NextResponse('proxy error', {
      status: 502,
      headers: corsHeaders(origin),
    });
  }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as DELETE, proxy as PATCH };
