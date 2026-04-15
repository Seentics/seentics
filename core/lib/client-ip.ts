import type { Context } from "hono";

/**
 * Set by the Bun `fetch` wrapper from `server.requestIP` (not client-spoofable — we strip any incoming value first).
 * When behind Next.js / a gateway, this is usually the proxy (e.g. 127.0.0.1), not the visitor — use TRUST_PROXY
 * and forwarded headers, or (in development) `clientIpForIngest` falls back to XFF when the peer is private.
 */
export const SEENTICS_PEER_IP_HEADER = "x-seentics-peer-ip";

function isNonPublicClientIp(ip: string): boolean {
  const t = ip.trim().toLowerCase();
  if (!t) return true;
  if (t === "::1") return true;
  if (t.startsWith("127.") || t.includes("127.0.0.1")) return true;
  if (t.startsWith("10.")) return true;
  if (t.startsWith("192.168.")) return true;
  if (t.startsWith("169.254.")) return true;
  const m = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(t);
  if (m) return isNonPublicClientIp(m[1]);
  if (t.startsWith("172.")) {
    const p = t.split(/[.:]/);
    const second = Number(p[1] ?? "");
    if (second >= 16 && second <= 31) return true;
  }
  if (t.startsWith("fc") || t.startsWith("fd")) return true;
  return false;
}

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
 * Client IP for rate limits / logs.
 * When TRUST_PROXY=true, forwarded headers win over the TCP peer (peer is the proxy).
 * When TRUST_PROXY=false, the peer is used only if it looks like a direct public client; otherwise empty * unless you rely on ingest-specific fallbacks.
 */
export function getClientIp(c: Context, trustProxy: boolean): string {
  const fromHeaders = clientIpFromRequestHeaders(c.req.raw.headers);
  const peer = c.req.header(SEENTICS_PEER_IP_HEADER)?.trim() ?? "";

  if (trustProxy) {
    if (fromHeaders) return fromHeaders;
    if (peer) return peer;
    return "";
  }

  if (peer && !isNonPublicClientIp(peer)) return peer;
  return peer;
}

/**
 * GeoIP source IP: honors proxy headers when TRUST_PROXY=true.
 * When TRUST_PROXY=false and the TCP peer is private (typical Next → gateway → core), development uses
 * XFF / CF headers if present so MaxMind still sees the visitor without extra env.
 */
export function clientIpForIngest(c: Context, trustProxy: boolean, isProduction: boolean): string {
  const fromHeaders = clientIpFromRequestHeaders(c.req.raw.headers);
  const peer = c.req.header(SEENTICS_PEER_IP_HEADER)?.trim() ?? "";

  if (trustProxy) {
    if (fromHeaders) return fromHeaders;
    if (peer) return peer;
    return "";
  }

  if (peer && !isNonPublicClientIp(peer)) return peer;
  if (!isProduction && fromHeaders) return fromHeaders;
  if (peer) return peer;
  return "";
}
