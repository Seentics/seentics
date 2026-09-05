import { createHash } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import type { AppConfig } from "../../../config";
import { MemoryCache } from "../../../platform/lib/memory-cache";

type Cached = { body: Uint8Array; headers: [string, string][] };

/**
 * Response cache for the analytics read endpoints.
 *
 * **Mount it behind whatever authorises the request, never globally.** A cache hit
 * returns without calling `next()`, so every middleware after this one — including
 * `authMiddleware` — is skipped. Mounted globally in `index.ts`, that made the cache an
 * authentication bypass: the key was derived from the JWT payload decoded *without
 * verifying the signature*, so an unsigned `alg: none` token carrying a victim's user id
 * produced the victim's cache key and was served the victim's data, 200 and all. It is
 * mounted inside the analytics router now, after `authMiddleware`, and the identity comes
 * from `c.get("userId")` — set by that middleware only after `verifyAccessToken` succeeds.
 *
 * `identify` is what keeps the two scopes apart:
 *
 * - authenticated routes pass the verified `userId`, so one user's response can never be
 *   served to another;
 * - the public share-link route passes a constant, because it has no viewer identity by
 *   design and its response is the same for everyone holding the link.
 *
 * Returning `null` from `identify` disables the cache for that request entirely — no
 * read, no write. That is the fail-closed path for an authenticated route that somehow
 * reached here without a resolved user: serving a cached body would repeat the original
 * bug, and caching under a placeholder key would pool unrelated users together.
 */
export type CacheIdentity = (c: Context) => string | null;

/** For the share-link route: no viewer identity, one response for every holder. */
export const PUBLIC_IDENTITY: CacheIdentity = () => "public";

function cacheKey(c: Pick<Context, "req">, identity: string): string {
  return createHash("sha256").update(`${c.req.url}\n${identity}`).digest("base64url");
}

/** Exports are point-in-time downloads and can be large; never cached. */
function shouldCachePath(path: string): boolean {
  return !path.includes("/export");
}

export function analyticsCacheMiddleware(
  cfg: AppConfig,
  identify: CacheIdentity,
): MiddlewareHandler {
  const inner = new MemoryCache<Cached>(cfg.analyticsCache.maxEntries);
  const ttlMs = cfg.analyticsCache.ttlMs;

  return async (c, next) => {
    if (!cfg.analyticsCache.enabled || c.req.method !== "GET") return next();
    if (!shouldCachePath(new URL(c.req.url).pathname)) return next();

    // No resolved identity → no caching at all. See the note above.
    const identity = identify(c);
    if (identity === null) return next();

    if (Math.random() < 0.05) inner.sweepExpired();

    const key = cacheKey(c, identity);
    const hit = inner.get(key);
    if (hit) {
      // The stored bytes and the stored headers, verbatim. Decoding, parsing and
      // re-serialising the body did two full JSON passes over a response of up to two
      // megabytes on the path whose entire purpose is to avoid work — and `c.json` built
      // its own headers, so the `Content-Type` and cache directives the handler set were
      // present on a miss and quietly gone on a hit.
      const headers = new Headers(hit.headers);
      headers.set("X-Cache", "HIT");
      return new Response(hit.body.slice(), { status: 200, headers });
    }

    await next();

    const res = c.res;
    if (!res || res.status !== 200) return;

    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return;

    try {
      const buf = new Uint8Array(await res.clone().arrayBuffer());
      if (buf.byteLength > 2_000_000) return;

      const headers: [string, string][] = [];
      res.headers.forEach((v, k) => {
        const lk = k.toLowerCase();
        if (lk === "x-cache") return;
        if (lk === "set-cookie") return;
        headers.push([k, v]);
      });

      inner.set(key, { body: buf, headers }, ttlMs);

      const h = new Headers(headers);
      h.set("X-Cache", "MISS");
      c.res = new Response(buf.slice(), { status: 200, headers: h });
    } catch {
      /* ignore */
    }
  };
}
