/**
 * Built once per `POST /tracker/collect`, then copied onto each analytics row in `handleEvents` / `handleFunnels`
 * (`trackerRowsToAnalytics`). Flow: resolve client IP from the request → local MaxMind City DB → country/region/city.
 * Non-production + private/docker IP: defaults to BD for localhost; override with GEO_FALLBACK_COUNTRY (e.g. US).
 */
import Bowser from "bowser";
import { lookupGeo } from "./maxmind-geo";

export type AnalyticsIngestMeta = {
  country: string | null;
  region: string | null;
  city: string | null;
  browser: string | null;
  device: string | null;
  os: string | null;
  /** First language tag from Accept-Language (e.g. en-US) */
  languageHint: string | null;
};

function isProductionEnv(): boolean {
  return (process.env.ENVIRONMENT ?? process.env.NODE_ENV ?? "development").toLowerCase() === "production";
}

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

function primaryAcceptLanguage(header: string | undefined): string | null {
  if (!header?.trim()) return null;
  const tag = header.split(",")[0]?.trim()?.split(";")[0]?.trim();
  return tag || null;
}

function parseUserAgent(ua: string): Pick<AnalyticsIngestMeta, "browser" | "device" | "os"> {
  const empty = { browser: null as string | null, device: null as string | null, os: null as string | null };
  if (!ua.trim()) return empty;
  try {
    const p = Bowser.getParser(ua);
    const brName = p.getBrowserName();
    const brVer = p.getBrowserVersion();
    const browser = brName ? (brVer ? `${brName} ${brVer}` : brName) : null;
    const osName = p.getOSName();
    const osVer = p.getOSVersion();
    const os = osName ? (osVer ? `${osName} ${osVer}` : osName) : null;
    const plat = p.getPlatformType(true);
    let device: string | null = "Desktop";
    if (plat === "mobile") device = "Mobile";
    else if (plat === "tablet") device = "Tablet";
    return { browser, device, os };
  } catch {
    return empty;
  }
}

/** ISO2 from common edge / proxy headers when MaxMind has no country (Cloudflare, Vercel, CloudFront). */
function countryFromEdgeHeaders(headers: Headers): string | null {
  const candidates = [
    headers.get("cf-ipcountry"),
    headers.get("x-vercel-ip-country"),
    headers.get("cloudfront-viewer-country"),
  ];
  for (const raw0 of candidates) {
    const raw = raw0?.trim().toUpperCase();
    if (!raw || raw.length !== 2 || !/^[A-Z]{2}$/.test(raw)) continue;
    if (raw === "XX" || raw === "T1") continue;
    return raw;
  }
  return null;
}

export function buildAnalyticsIngestMeta(input: {
  userAgent: string;
  clientIp: string;
  acceptLanguage?: string;
  headers: Headers;
}): AnalyticsIngestMeta {
  const { userAgent, clientIp, acceptLanguage, headers } = input;
  const { browser, device, os } = parseUserAgent(userAgent);

  let country: string | null = null;
  let region: string | null = null;
  let city: string | null = null;

  if (clientIp) {
    const g = lookupGeo(clientIp);
    if (g) {
      country = g.country;
      region = g.region;
      city = g.city;
    }
  }

  if (!country) {
    const edge = countryFromEdgeHeaders(headers);
    if (edge) country = edge;
  }

  const langHeader = acceptLanguage?.trim() ? acceptLanguage : (headers.get("accept-language") ?? undefined);

  // Loopback / RFC1918 / Docker peer: optional explicit ISO2 (wins over dev default below).
  const fb = process.env.GEO_FALLBACK_COUNTRY?.trim().toUpperCase();
  if (!country && fb && /^[A-Z]{2}$/.test(fb) && isNonPublicClientIp(clientIp)) {
    country = fb;
  }

  // Localhost / Docker: no public IP → MaxMind empty; default BD in non-production unless GEO_FALLBACK_* set above.
  if (!country && !isProductionEnv() && isNonPublicClientIp(clientIp)) {
    country = "BD";
  }

  return {
    country,
    region,
    city,
    browser,
    device,
    os,
    languageHint: primaryAcceptLanguage(langHeader),
  };
}
