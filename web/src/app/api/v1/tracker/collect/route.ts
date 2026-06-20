/**
 * Streaming proxy for the tracker collect endpoint.
 *
 * Next.js rewrites buffer the request body before forwarding (capped at
 * middlewareClientMaxBodySize, default 10 MB). Session replay FullSnapshot
 * batches routinely exceed 10 MB, causing the rewrite to truncate the body.
 * The gateway then hangs waiting for the rest and the connection is reset.
 *
 * This route handler takes over from the rewrite for this specific path and
 * streams the request body directly to the gateway without any buffering.
 * It also owns CORS explicitly — OPTIONS returns 204 immediately so the
 * preflight never needs a gateway round-trip.
 */

import { type NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.API_GATEWAY_URL ?? 'http://gateway:8080';
const TARGET  = `${GATEWAY}/api/v1/tracker/collect`;

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Content-Length, Accept-Encoding, Content-Encoding, Authorization, X-API-Key, X-Requested-With, Cache-Control',
  'Access-Control-Max-Age': '86400',
};

function corsHeaders(origin: string): Record<string, string> {
  if (origin) {
    return {
      ...CORS_HEADERS,
      'Access-Control-Allow-Origin':      origin,
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin',
    };
  }
  return {
    ...CORS_HEADERS,
    'Access-Control-Allow-Origin': '*',
  };
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') ?? '';
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

async function proxy(request: NextRequest) {
  const origin  = request.headers.get('origin') ?? '';
  const headers = new Headers(request.headers);
  headers.delete('host');

  try {
    const upstream = await fetch(TARGET, {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD'
        ? request.body
        : undefined,
      // @ts-ignore — duplex is valid but not in all type defs yet
      duplex: 'half',
    });

    const responseHeaders = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(corsHeaders(origin))) {
      responseHeaders.set(k, v);
    }

    return new NextResponse(upstream.body, {
      status:     upstream.status,
      statusText: upstream.statusText,
      headers:    responseHeaders,
    });
  } catch (err) {
    console.error('[tracker/collect proxy]', err);
    return new NextResponse('proxy error', {
      status: 502,
      headers: corsHeaders(origin),
    });
  }
}

export { proxy as GET, proxy as POST };
