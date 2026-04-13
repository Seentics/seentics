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

/** Cloudflare / CDN country hint (ISO3166-1 alpha-2). */
function countryFromCdn(headers: Headers): string | null {
  const raw = headers.get("cf-ipcountry")?.trim().toUpperCase();
  if (!raw || raw.length !== 2) return null;
  if (raw === "XX" || raw === "T1") return null;
  return raw;
}

export function buildAnalyticsIngestMeta(input: {
  userAgent: string;
  clientIp: string;
  acceptLanguage?: string;
  headers: Headers;
}): AnalyticsIngestMeta {
  const { userAgent, clientIp, acceptLanguage, headers } = input;
  const { browser, device, os } = parseUserAgent(userAgent);

  let country = countryFromCdn(headers);
  let region: string | null = null;
  let city: string | null = null;

  if (clientIp) {
    const g = lookupGeo(clientIp);
    if (g) {
      if (!country && g.country) country = g.country;
      if (g.region) region = g.region;
      if (g.city) city = g.city;
    }
  }

  const langHeader = acceptLanguage?.trim() ? acceptLanguage : (headers.get("accept-language") ?? undefined);

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
