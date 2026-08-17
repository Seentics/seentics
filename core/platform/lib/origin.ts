import type { AppConfig } from "../../config";
import { MemoryCache } from "./memory-cache";

let originValidationCache: MemoryCache<boolean> | null = null;
let originCacheTtlMs = 180_000;

/** Call once at process start (see `index.ts`) so origin checks reuse TTL-cached results. */
export function configureTrackerOriginCache(cfg: AppConfig): void {
  if (!cfg.trackerCache.enabled) {
    originValidationCache = null;
    return;
  }
  originValidationCache = new MemoryCache<boolean>(cfg.trackerCache.maxEntries);
  originCacheTtlMs = cfg.trackerCache.originTtlMs;
}

function originValidationCacheKey(origin: string, registeredURL: string, environment: string): string {
  return `${environment}\0${registeredURL.trim()}\0${origin.trim()}`;
}

/** Match Go `websites.ValidateOriginDomain` / gateway edge validation. */
function validateOriginDomainUncached(
  origin: string,
  registeredURL: string,
  environment: string,
): boolean {
  if (!origin.trim()) return true;

  let originDomain: string;
  if (origin.includes("://")) {
    try {
      originDomain = new URL(origin).hostname;
    } catch {
      return false;
    }
  } else {
    originDomain = origin;
  }

  originDomain = originDomain.toLowerCase().replace(/^www\./, "");

  if (environment !== "production" && isLoopbackHost(originDomain)) {
    return true;
  }

  const siteHost = siteHostForOriginMatch(registeredURL);
  return originDomain === siteHost;
}

/**
 * Same as uncached logic, with an in-memory TTL cache when `configureTrackerOriginCache` ran with cache enabled.
 */
export function validateOriginDomain(
  origin: string,
  registeredURL: string,
  environment: string,
): boolean {
  if (!originValidationCache) {
    return validateOriginDomainUncached(origin, registeredURL, environment);
  }
  if (Math.random() < 0.05) originValidationCache.sweepExpired();
  const key = originValidationCacheKey(origin, registeredURL, environment);
  const hit = originValidationCache.get(key);
  if (hit !== undefined) return hit;
  const ok = validateOriginDomainUncached(origin, registeredURL, environment);
  originValidationCache.set(key, ok, originCacheTtlMs);
  return ok;
}

/** Dev bypass: treat all loopback forms like localhost (incl. IPv6 ::1 from http://[::1]:3000). */
function isLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1") return true;
  if (h === "::1") return true;
  if (h === "0:0:0:0:0:0:0:1") return true;
  if (h === "::ffff:127.0.0.1") return true;
  return false;
}

function siteHostForOriginMatch(registered: string): string {
  let s = registered.trim();
  if (s.includes("://")) {
    try {
      const u = new URL(s);
      if (u.hostname) return u.hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      /* keep s */
    }
  }
  const hostPort = s.split("/")[0] ?? s;
  if (hostPort.includes(":") && !hostPort.startsWith("[")) {
    const i = hostPort.lastIndexOf(":");
    const host = hostPort.slice(0, i);
    return host.toLowerCase().replace(/^www\./, "");
  }
  return hostPort.toLowerCase().replace(/^www\./, "");
}

export function originFromRequest(h: Headers): string {
  return h.get("Origin")?.trim() || h.get("Referer")?.trim() || "";
}

const BLOCKED_WEBHOOK_HOSTNAMES = new Set([
  'metadata.google.internal',
  'metadata.internal',
  'instance-data',
]);

/**
 * SSRF guard for automation webhook targets. URL must be https://, not an IP literal,
 * not localhost/internal, and not a known cloud metadata service hostname.
 */
export function validateWebhookUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  if (!host) return false;
  if (isForbiddenScreenshotHost(host)) return false;
  if (BLOCKED_WEBHOOK_HOSTNAMES.has(host)) return false;
  if (host.endsWith('.internal')) return false;
  return true;
}

/** Hostnames that must never be Playwright screenshot targets (SSRF guard). */
function isForbiddenScreenshotHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (!h) return true;
  if (isLoopbackHost(h)) return true;
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "host.docker.internal") return true;
  // IPv6 literal (URL.hostname keeps the brackets) or anything colon-y.
  if (h.startsWith("[") || h.includes(":")) return true;
  // Any IPv4 literal — public or private — is rejected; captures must target a domain.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true;
  return false;
}

/**
 * SSRF guard for Playwright screenshot targets: the URL must be http/https, must not
 * point at an IP literal / localhost / internal host, and its hostname must be the
 * website's registered host (same derivation as origin matching) or a subdomain of it.
 */
export function validateScreenshotTargetUrl(pageUrl: string, registeredURL: string): boolean {
  let u: URL;
  try {
    u = new URL(pageUrl);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (isForbiddenScreenshotHost(host)) return false;
  const siteHost = siteHostForOriginMatch(registeredURL);
  if (!siteHost || isForbiddenScreenshotHost(siteHost)) return false;
  return host === siteHost || host.endsWith(`.${siteHost}`);
}
