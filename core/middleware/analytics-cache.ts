import { createHash } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import type { AppConfig } from "../config";
import { MemoryCache } from "../lib/memory-cache";

type Cached = { body: Uint8Array; headers: [string, string][] };

function cacheKey(c: Pick<Context, "req">): string {
  const url = c.req.url;
  const auth = c.req.header("authorization") ?? "";
  return createHash("sha256").update(`${url}\n${auth}`).digest("base64url");
}

function shouldCachePath(path: string): boolean {
  if (!path.startsWith("/api/v1/analytics")) return false;
  if (path.includes("/export")) return false;
  return true;
}

export function analyticsCacheMiddleware(cfg: AppConfig): MiddlewareHandler {
  const inner = new MemoryCache<Cached>(cfg.analyticsCache.maxEntries);
  const ttlMs = cfg.analyticsCache.ttlMs;

  return async (c, next) => {
    if (!cfg.analyticsCache.enabled || c.req.method !== "GET") return next();
    const path = new URL(c.req.url).pathname;
    if (!shouldCachePath(path)) return next();

    if (Math.random() < 0.05) inner.sweepExpired();

    const key = cacheKey(c);
    const hit = inner.get(key);
    if (hit) {
      c.header("X-Cache", "HIT");
      return c.json(JSON.parse(new TextDecoder().decode(hit.body)));
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
