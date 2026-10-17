/**
 * The management API: provisioning websites with an account API key.
 * Base path `/api/v1/manage` (mounted from `app/http-app.ts`).
 *
 *   GET/POST /websites, GET/PATCH/DELETE /websites/:id — the site and its snippet
 *
 * Auth: an account key (`snt_acct_…`) as `X-API-Key`. `GET` needs `websites:read`, every
 * other method `websites:write`. A key acts for the account that minted it and only on
 * that account's own sites.
 *
 * Clients and embed links are the agency workspace's (`/api/v1/agency`, through the gateway).
 */

import { Hono, type MiddlewareHandler } from "hono";
import { env } from "../../../config";
import { takeRateToken } from "../../../platform/cache/token-bucket";
import type { AuthVars } from "../../../platform/middleware/auth";
import type { AccountKeyVerifier, AccountScope, VerifiedAccountKey } from "../../../modules/api-keys/interfaces";
import type { AuthedRouter } from "../../../platform/http/router";

type Vars = AuthVars & { accountKey: VerifiedAccountKey };

/** Resolve the account key to its owner, as `userId` — what the mounted routers read. */
export function createAccountKeyAuthMiddleware(verifier: AccountKeyVerifier): MiddlewareHandler<{ Variables: Vars }> {
  return async (c, next) => {
    const cfg = env();
    // Behind the gateway, X-API-Key is the gateway's own credential and the caller's key
    // arrives as X-Client-Api-Key — the same arrangement as the raw data API.
    const raw = cfg.gatewayOnly ? c.req.header("X-Client-Api-Key") : c.req.header("X-API-Key");
    if (!raw?.trim()) return c.json({ error: "X-API-Key header is required", code: "missing_api_key" }, 401);

    const key = await verifier.verify(raw.trim());
    if (!key) return c.json({ error: "Invalid or revoked API key", code: "invalid_api_key" }, 401);

    if (cfg.rateLimit.enabled && cfg.rateLimit.rawPerKeyMax > 0) {
      const r = takeRateToken(`manage:key:${key.apiKeyId}`, cfg.rateLimit.rawPerKeyMax, cfg.rateLimit.windowMs);
      if (!r.allowed) {
        c.header("Retry-After", String(Math.ceil(r.resetInMs / 1000)));
        return c.json({ error: "rate_limit_exceeded", code: "api_key_quota" }, 429);
      }
    }

    c.set("accountKey", key);
    c.set("userId", key.userId);
    return next();
  };
}

/** Reads need `websites:read`, everything else `websites:write`. */
export const requireMethodScope: MiddlewareHandler<{ Variables: Vars }> = async (c, next) => {
  const method = c.req.method.toUpperCase();
  const scope: AccountScope = method === "GET" || method === "HEAD" ? "websites:read" : "websites:write";
  if (!c.get("accountKey").scopes.includes(scope)) {
    return c.json({ error: `This API key does not have the "${scope}" scope.`, code: "insufficient_scope", required_scope: scope }, 403);
  }
  return next();
};

export function createManagementRoutes(deps: {
  accountKeys: AccountKeyVerifier;
  /** The websites module's owner-only website routes, no auth of their own. */
  websites: AuthedRouter;
}) {
  const r = new Hono<{ Variables: Vars }>();
  r.use("*", createAccountKeyAuthMiddleware(deps.accountKeys));
  r.use("*", requireMethodScope);
  r.route("/websites", deps.websites);
  return r;
}
