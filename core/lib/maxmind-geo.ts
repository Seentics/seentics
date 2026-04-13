import { existsSync } from "node:fs";
import { isIP } from "node:net";
import { AddressNotFoundError, Reader, type City } from "@maxmind/geoip2-node";

export type GeoLookup = {
  country: string | null;
  region: string | null;
  city: string | null;
};

let reader: Awaited<ReturnType<typeof Reader.open>> | null = null;
let initDone = false;
let cacheMax = 50_000;

const cache = new Map<string, GeoLookup>();

function normalizeClientIp(ip: string): string | null {
  const t = ip.trim();
  if (!t) return null;
  if (isIP(t) === 0) return null;
  return t.includes(":") ? t.toLowerCase() : t;
}

function cityToGeo(city: City): GeoLookup {
  const country = city.country?.isoCode ?? null;
  const sub = city.subdivisions?.[0];
  const region = sub?.names?.en ?? sub?.isoCode ?? null;
  const cityName = city.city?.names?.en ?? null;
  return { country, region, city: cityName };
}

function touchCache(key: string, value: GeoLookup): GeoLookup {
  cache.delete(key);
  cache.set(key, value);
  return value;
}

function evictIfNeeded(): void {
  while (cache.size > cacheMax) {
    const first = cache.keys().next().value;
    if (first === undefined) break;
    cache.delete(first);
  }
}

/**
 * Open GeoLite2-City / GeoIP2-City `.mmdb` once at startup. No HTTP calls — all lookups are local.
 */
export async function initMaxMindGeo(options: { dbPath: string; geoCacheMax: number }): Promise<void> {
  if (initDone) return;
  initDone = true;
  cacheMax = Math.max(1000, options.geoCacheMax);

  const dbPath = options.dbPath.trim();
  if (!dbPath) {
    console.warn("maxmind: MAXMIND_DB_PATH not set; geolocation uses CDN headers only (cf-ipcountry)");
    return;
  }
  if (!existsSync(dbPath)) {
    console.warn(`maxmind: database file not found (${dbPath}); geolocation uses CDN headers only`);
    return;
  }
  try {
    reader = await Reader.open(dbPath);
    console.log(`maxmind: loaded GeoIP2 City database (${dbPath}), geo cache max ${cacheMax} IPs`);
  } catch (e) {
    console.error("maxmind: failed to open database", e);
    reader = null;
  }
}

/** In-memory LRU-ish cache of IP → { country, region, city } to avoid repeated MMDB walks under load. */
export function lookupGeo(ip: string): GeoLookup | null {
  const n = normalizeClientIp(ip);
  if (!n || !reader) return null;

  const hit = cache.get(n);
  if (hit) return touchCache(n, hit);

  let out: GeoLookup;
  try {
    out = cityToGeo(reader.city(n));
  } catch (e) {
    if (e instanceof AddressNotFoundError) {
      out = { country: null, region: null, city: null };
    } else {
      return null;
    }
  }

  cache.set(n, out);
  evictIfNeeded();
  return out;
}
