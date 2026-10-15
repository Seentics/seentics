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
 * The one header the proxy in front of Core is configured to set (`CLIENT_IP_HEADER`,
 * X-Forwarded-For by default), honoured only with TRUST_PROXY=true.
 *
 * Never the first of several candidates. This read CF-Connecting-IP, True-Client-IP and
 * X-Real-IP ahead of X-Forwarded-For, but a proxy that sets only X-Forwarded-For (Caddy,
 * Next.js, Traefik, the gateway) passes the others through as the caller sent them: a new
 * address in CF-Connecting-IP on every request escaped every per-IP limit — sign-in brute
 * force included — and chose the visitor's country. Set CLIENT_IP_HEADER=CF-Connecting-IP
 * only when the origin accepts connections from Cloudflare alone. The gateway resolves the
 * address the same way (gateway/lib/client-ip.ts).
 */
export function clientIpFromRequestHeaders(headers: Headers, header = configuredClientIpHeader()): string {
  return headers.get(header)?.split(",")[0]?.trim() ?? "";
}

function configuredClientIpHeader(): string {
  return (process.env.CLIENT_IP_HEADER ?? "").trim().toLowerCase() || "x-forwarded-for";
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
 * GeoIP source IP: honors the proxy's header when TRUST_PROXY=true.
 * When TRUST_PROXY=false, the TCP peer; forwarded headers are trusted only outside
 * production, so MaxMind resolves locally. CF-Connecting-IP used to be trusted here
 * unconditionally, but it is only Cloudflare's when the origin is reachable through
 * Cloudflare alone — otherwise any caller sets it. Behind Cloudflare, set TRUST_PROXY=true
 * and CLIENT_IP_HEADER=CF-Connecting-IP.
 */
export function clientIpForIngest(c: Context, trustProxy: boolean, isProduction: boolean): string {
  const headers = c.req.raw.headers;
  const peer = c.req.header(SEENTICS_PEER_IP_HEADER)?.trim() ?? "";

  if (trustProxy) {
    const fromHeaders = clientIpFromRequestHeaders(headers);
    if (fromHeaders) return fromHeaders;
    if (peer) return peer;
    return "";
  }

  // Direct public connection — peer is the actual visitor.
  if (peer && !isNonPublicClientIp(peer)) return peer;

  // Development fallback: trust any forwarded header so MaxMind resolves locally.
  if (!isProduction) {
    const fromHeaders = clientIpFromRequestHeaders(headers);
    if (fromHeaders) return fromHeaders;
  }

  if (peer) return peer;
  return "";
}
