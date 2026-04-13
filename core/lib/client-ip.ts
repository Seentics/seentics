import type { Context } from "hono";

/**
 * Best-effort client IP for GeoIP. When you terminate TLS at a proxy, ensure it sets
 * cf-connecting-ip, true-client-ip, x-real-ip, or a trustworthy x-forwarded-for chain,
 * and set TRUST_PROXY=true so these headers are honored for rate limiting and ingest.
 */
export function clientIpFromRequestHeaders(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  const trueClient = headers.get("true-client-ip")?.trim();
  if (trueClient) return trueClient;

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  return "";
}

/**
 * Client IP for rate limits / logs. When `trustProxy` is false, forwarded headers are ignored
 * (they can be spoofed). Use TRUST_PROXY=true behind a known reverse proxy that strips client-supplied XFF.
 */
export function getClientIp(c: Context, trustProxy: boolean): string {
  if (trustProxy) {
    return clientIpFromRequestHeaders(c.req.raw.headers);
  }
  return "";
}

/** GeoIP source IP: respects `trustProxy`; in non-production falls back to forwarded headers for local/docker dev. */
export function clientIpForIngest(c: Context, trustProxy: boolean, isProduction: boolean): string {
  const strict = getClientIp(c, trustProxy);
  if (strict) return strict;
  if (!isProduction) return clientIpFromRequestHeaders(c.req.raw.headers);
  return "";
}
