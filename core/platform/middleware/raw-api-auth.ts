import type { MiddlewareHandler } from "hono";
import { env } from "../../config";
import type { VerifiedApiKeyContext } from "../lib/api-key-verify";
import { verifyWebsiteApiKey } from "../lib/api-key-verify";
import { takeRateToken } from "../lib/token-bucket";

declare module "hono" {
  interface ContextVariableMap {
    rawApi: VerifiedApiKeyContext;
  }
}

/**
 * Requires `X-API-Key` (or `x-api-key`) matching `api_keys` for path `:website_id`.
 * After verification, applies per-key token bucket when `RATE_LIMIT_RAW_PER_KEY_MAX` > 0 and rate limiting is enabled.
 */
export const rawApiAuthMiddleware: MiddlewareHandler = async (c, next) => {
  const cfg = env();
  const key = c.req.header("X-API-Key") ?? c.req.header("x-api-key");
  if (!key?.trim()) {
    return c.json({ error: "X-API-Key header is required", code: "missing_api_key" }, 401);
  }
  const websiteId = c.req.param("website_id");
  if (!websiteId) {
    return c.json({ error: "website_id is required", code: "bad_request" }, 400);
  }
  const ctx = await verifyWebsiteApiKey(key, websiteId);
  if (!ctx) {
    return c.json({ error: "Invalid or revoked API key", code: "invalid_api_key" }, 401);
  }

  if (cfg.rateLimit.enabled && cfg.rateLimit.rawPerKeyMax > 0) {
    const r = takeRateToken(
      `raw:key:${ctx.apiKeyId}`,
      cfg.rateLimit.rawPerKeyMax,
      cfg.rateLimit.windowMs,
    );
    c.header("X-RateLimit-Key-Limit", String(r.limit));
    c.header("X-RateLimit-Key-Remaining", String(r.remaining));
    if (!r.allowed) {
      c.header("Retry-After", String(Math.ceil(r.resetInMs / 1000)));
      return c.json(
        {
          error: "rate_limit_exceeded",
          code: "raw_api_key_quota",
          message: "Too many requests for this API key.",
        },
        429,
      );
    }
  }

  c.set("rawApi", ctx);
  return next();
};
