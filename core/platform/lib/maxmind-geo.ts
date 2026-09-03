import { existsSync, readdirSync } from "node:fs";
import { isIP } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AddressNotFoundError, Reader, type City } from "@maxmind/geoip2-node";
import { log as baseLog } from "./logger";

const log = baseLog.child({ category: "geo" });

/** `seentics/core/lib` → `seentics/core/db/maxmind` (no env required). */
const BUNDLED_MAXMIND_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "db", "maxmind");

/** Prefer `MAXMIND_DB_PATH` when it exists; otherwise any `*.mmdb` under `core/db/maxmind/`. */
function resolveCityMmdbPath(optionalEnvPath: string): string {
  const env = (optionalEnvPath ?? "").trim();
  if (env && existsSync(env)) return env;
  for (const name of ["GeoLite2-City.mmdb", "GeoIP2-City.mmdb"]) {
    const p = join(BUNDLED_MAXMIND_DIR, name);
    if (existsSync(p)) {
      if (env && !existsSync(env)) {
        log.warn({ msg: "maxmind_env_path_missing_fallback", env_path: env, using: p });
      }
      return p;
    }
  }
  try {
    const files = readdirSync(BUNDLED_MAXMIND_DIR);
    const any = files.find((f) => f.endsWith(".mmdb"));
    if (any) {
      const p = join(BUNDLED_MAXMIND_DIR, any);
      if (env && !existsSync(env)) {
        log.warn({ msg: "maxmind_env_path_missing_fallback", env_path: env, using: p });
      }
      return p;
    }
  } catch {
    /* missing dir */
  }
  return env;
}

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
  const noZone = ip.split("%")[0]?.trim() ?? "";
  const t = noZone.trim();
  if (!t) return null;
  if (isIP(t) === 0) return null;
  return t.includes(":") ? t.toLowerCase() : t;
}

function cityToGeo(city: City): GeoLookup {
  const country = city.country?.isoCode ?? null;
  const sub = city.subdivisions?.[0];
  const region = sub?.names?.en ?? sub?.isoCode ?? null;
  const cityName = city.city?.names?.en ?? null;
  return {
    country,
    region,
    city: cityName,
  };
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

  const dbPath = resolveCityMmdbPath(options.dbPath);
  if (!dbPath) {
    log.warn({ msg: "maxmind_no_db", hint: `place GeoLite2-City.mmdb in ${BUNDLED_MAXMIND_DIR} or set MAXMIND_DB_PATH` });
    return;
  }
  if (!existsSync(dbPath)) {
    log.warn({ msg: "maxmind_db_not_found", path: dbPath });
    return;
  }
  try {
    reader = await Reader.open(dbPath);
    log.info({ msg: "maxmind_loaded", path: dbPath, cache_max: cacheMax });
  } catch (e) {
    log.error({ msg: "maxmind_open_failed", path: dbPath, err: String(e) });
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
