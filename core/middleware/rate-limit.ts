import type { MiddlewareHandler } from "hono";
import { getClientIp } from "../lib/client-ip";
import { takeRateToken, pruneRateBuckets } from "../lib/token-bucket";
import type { AppConfig } from "../config";

let lastPrune = 0;

function tierForPath(path: string): "skip" | "auth" | "tracker" | "internal" | "general" {
  if (path === "/health") return "skip";
  if (path.startsWith("/api/v1/internal")) return "internal";
  if (path.startsWith("/api/v1/auth") || path.startsWith("/api/v1/user/auth")) return "auth";
  if (path.startsWith("/api/v1/tracker")) return "tracker";
  return "general";
}

export function rateLimitMiddleware(cfg: AppConfig): MiddlewareHandler {
  return async (c, next) => {
    if (!cfg.rateLimit.enabled) return next();
    if (c.req.method === "OPTIONS") return next();

    const now = Date.now();
    if (now - lastPrune > 120_000) {
      lastPrune = now;
      pruneRateBuckets(10 * 60_000);
    }

    const path = new URL(c.req.url).pathname;
    const tier = tierForPath(path);
    if (tier === "skip") return next();

    const ip = getClientIp(c, cfg.trustProxy);
    const windowMs = cfg.rateLimit.windowMs;
    let limit = cfg.rateLimit.generalMax;
    if (tier === "auth") limit = cfg.rateLimit.authMax;
    else if (tier === "tracker") limit = cfg.rateLimit.trackerMax;
    else if (tier === "internal") limit = cfg.rateLimit.internalMax;

    const key = `rl:${tier}:${ip}`;
    const r = takeRateToken(key, limit, windowMs);
    c.header("X-RateLimit-Limit", String(r.limit));
    c.header("X-RateLimit-Remaining", String(r.remaining));

    if (!r.allowed) {
      c.header("Retry-After", String(Math.ceil(r.resetInMs / 1000)));
      return c.json(
        { error: "rate_limit_exceeded", message: "Too many requests. Try again later." },
        429,
      );
    }
    return next();
  };
}
