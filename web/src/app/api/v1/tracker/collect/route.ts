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
 */

import { type NextRequest } from 'next/server';

const GATEWAY = process.env.API_GATEWAY_URL ?? 'http://gateway:8080';
const TARGET = `${GATEWAY}/api/v1/tracker/collect`;

// Allow large session-replay payloads — no artificial timeout
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

async function proxy(request: NextRequest) {
  // Forward all headers except host (causes TLS/routing issues downstream)
  const headers = new Headers(request.headers);
  headers.delete('host');

  try {
    const upstream = await fetch(TARGET, {
      method: request.method,
      headers,
      // Stream the body directly — no buffering in this process
      body: request.method !== 'GET' && request.method !== 'HEAD'
        ? request.body
        : undefined,
      // Required by fetch spec when sending a streaming body
      // @ts-ignore — duplex is a valid option but not in all type defs yet
      duplex: 'half',
    });

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: upstream.headers,
    });
  } catch (err) {
    console.error('[tracker/collect proxy]', err);
    return new Response('proxy error', { status: 502 });
  }
}

export { proxy as GET, proxy as POST, proxy as OPTIONS };
