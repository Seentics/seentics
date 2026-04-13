import type { AppConfig } from "../config";
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
