import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";
import type { Request as PwRequest, Route } from "playwright";
import { pinnedFetch } from "../../../platform/http/pinned-fetch";

/**
 * Serve one capture-browser request from here, so Chromium never connects anywhere itself.
 *
 * The capture's network policy used to check each hostname with its own DNS lookup and then
 * `route.continue()` — which hands the request back to Chromium, and Chromium resolves the name
 * again before connecting. A name that answers the check with a public address and Chromium
 * with 127.0.0.1 or the metadata address (DNS rebinding) got through. `pinnedFetch` resolves
 * once, judges every answer, and connects to one of those same addresses; the response is then
 * handed to the page with `route.fulfill`. Redirects come back unfollowed, so Chromium sees the
 * 3xx and its next hop arrives here as a fresh request, checked the same way.
 *
 * Throws `NonPublicHostError` for a host that resolves privately; the caller aborts the request.
 */
export async function fulfillThroughPinnedFetch(
  route: Route,
  fetchImpl: typeof pinnedFetch = pinnedFetch,
): Promise<void> {
  const request = route.request();
  const res = await fetchImpl(
    request.url(),
    {
      method: request.method(),
      headers: forwardableRequestHeaders(await request.allHeaders()),
      body: requestBody(request),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
    { maxBytes: MAX_RESPONSE_BYTES },
  );
  const raw = Buffer.from(await res.arrayBuffer());
  const encoding = res.headers.get("content-encoding");
  await route.fulfill({
    status: res.status,
    headers: fulfillableResponseHeaders(res.headers),
    body: decode(raw, encoding),
  });
}

/** One subresource; a capture's whole page load is bounded separately by its navigation timeout. */
const REQUEST_TIMEOUT_MS = 20_000;
/** Largest response body served to the page — a hero video is not needed for a screenshot. */
const MAX_RESPONSE_BYTES = 20 * 1024 * 1024;

/** Request headers that describe the connection rather than the request, or that `pinnedFetch` sets. */
const DROP_REQUEST = new Set(["host", "connection", "keep-alive", "proxy-connection", "transfer-encoding", "upgrade", "content-length"]);

/**
 * The page's request headers, minus connection-level ones and HTTP/2 pseudo-headers.
 *
 * `accept-encoding` is pinned to what `decode` understands: Node's client does not decompress,
 * and `route.fulfill` takes the body as the page should see it.
 */
export function forwardableRequestHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    const key = k.toLowerCase();
    if (key.startsWith(":") || DROP_REQUEST.has(key)) continue;
    out[key] = v;
  }
  out["accept-encoding"] = "gzip, deflate, br";
  return out;
}

/** Response headers that would be false once the body is decoded and re-framed by `fulfill`. */
const DROP_RESPONSE = new Set(["content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive"]);

export function fulfillableResponseHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((v, k) => {
    if (!DROP_RESPONSE.has(k.toLowerCase())) out[k] = v;
  });
  return out;
}

function requestBody(request: PwRequest): Uint8Array<ArrayBuffer> | undefined {
  const body = request.postDataBuffer();
  return body ? new Uint8Array(body) : undefined;
}

/** Undo a content-encoding; an unknown or corrupt one is passed through as-is. */
export function decode(body: Buffer, encoding: string | null): Buffer {
  const enc = (encoding ?? "").trim().toLowerCase();
  if (!enc || enc === "identity" || body.length === 0) return body;
  try {
    if (enc === "gzip" || enc === "x-gzip") return gunzipSync(body);
    if (enc === "deflate") return inflateSync(body);
    if (enc === "br") return brotliDecompressSync(body);
  } catch {
    /* fall through */
  }
  return body;
}
