import type { MiddlewareHandler } from "hono";
import type {
  ApiKeyVerifier,
  ApiScope,
  VerifiedApiKeyContext,
} from "../../../modules/api-keys/interfaces";
import { env } from "../../../config";
import { takeRateToken } from "../../../platform/cache/token-bucket";

declare module "hono" {
  interface ContextVariableMap {
    rawApi: VerifiedApiKeyContext;
  }
}

/**
 * Require a scope on an already-authenticated raw API request.
 *
 * A separate middleware from the one below because the scope depends on the route, and
 * an account key that may read analytics has no business reading session replays. An empty
 * scope list grants nothing: an account key with only `websites:*` scopes is a management
 * credential and must not read data.
 */
export function requireScope(scope: ApiScope): MiddlewareHandler {
  return async (c, next) => {
    const ctx = c.get("rawApi");
    if (!ctx) return c.json({ error: "unauthorized", code: "missing_api_key" }, 401);

    if (!ctx.scopes.includes(scope)) {
      return c.json(
        {
          error: `This API key does not have the "${scope}" scope.`,
          code: "insufficient_scope",
          required_scope: scope,
        },
        403,
      );
    }
    return next();
  };
}

/** `:website_id` of a `/v1/websites/:website_id/…` path. */
export function websiteIdFromPath(path: string): string | undefined {
  const segment = /\/v1\/websites\/([^/]+)/.exec(path)?.[1];
  if (!segment) return undefined;
  try {
    return decodeURIComponent(segment);
  } catch {
    return undefined;
  }
}

/**
 * Requires an account API key (`X-API-Key`, or `X-Client-Api-Key` behind the gateway) whose owner owns path `:website_id`.
 * After verification, applies per-key token bucket when `RATE_LIMIT_RAW_PER_KEY_MAX` > 0 and rate limiting is enabled.
 */
export function createRawApiAuthMiddleware(verifier: ApiKeyVerifier): MiddlewareHandler {
return async (c, next) => {
  const cfg = env();
  // Behind the gateway, X-API-Key is the gateway's own credential (checked in
  // index.ts) and the customer's key arrives as X-Client-Api-Key. Standalone, the
  // customer's key is X-API-Key itself.
  const key = cfg.gatewayOnly ? c.req.header("X-Client-Api-Key") : c.req.header("X-API-Key");
  if (!key?.trim()) {
    return c.json({ error: "X-API-Key header is required", code: "missing_api_key" }, 401);
  }
  // Registered with `r.use("*", …)`, where Hono does not give the middleware the
  // route's params — `c.req.param("website_id")` is always undefined there, so every
  // request with a key answered "website_id is required" and the public API served
  // nothing. The id is the segment after /websites/, which is the same segment every
  // handler reads as its `:website_id`: the key is checked against exactly the site
  // the handler then serves.
  const websiteId = c.req.param("website_id") ?? websiteIdFromPath(c.req.path);
  if (!websiteId) {
    return c.json({ error: "website_id is required", code: "bad_request" }, 400);
  }
  const ctx = await verifier.verify(key, websiteId);
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
}
