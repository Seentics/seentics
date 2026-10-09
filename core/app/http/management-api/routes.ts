/**
 * The management API: provisioning clients and websites with an account API key.
 * Base path `/api/v1/manage` (mounted from `index.ts`).
 *
 * What a multi-tenant platform calls from its own signup handler:
 *
 *   POST /clients { external_id, name, website: { url }, features_enabled, limits }
 *     → the client, its site and the site's snippet; idempotent on `external_id`
 *
 * Auth: an account key (`snt_acct_…`) as `X-API-Key`. `GET` needs `websites:read`, every
 * other method `websites:write`. A key acts for the account that minted it and only on
 * that account's own clients and sites.
 */

import { Hono, type MiddlewareHandler } from "hono";
import { z } from "zod";
import { env } from "../../../config";
import { takeRateToken } from "../../../platform/cache/token-bucket";
import type { AuthVars } from "../../../platform/middleware/auth";
import { parseJson } from "../../../platform/validation";
import {
  API_SCOPES,
  type AccountKeyVerifier,
  type AccountScope,
  type ApiScope,
  type EmbedTokenIssuer,
  type VerifiedAccountKey,
  type WebsiteKeyIssuer,
} from "../../../modules/api-keys/interfaces";
import type { OwnedWebsites } from "../../../modules/websites/interfaces";
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

/** 5 minutes to 30 days; an hour when omitted. */
const embedTokenBodySchema = z.object({
  expires_in_seconds: z.number().int().min(300).max(30 * 24 * 60 * 60).optional(),
});

const websiteKeySchema = z.object({
  name: z.string().trim().min(1).max(120),
  scopes: z.array(z.enum(API_SCOPES)).min(1).optional(),
});

export function createManagementRoutes(deps: {
  accountKeys: AccountKeyVerifier;
  websiteKeys: WebsiteKeyIssuer;
  embedTokens: EmbedTokenIssuer;
  ownedWebsites: OwnedWebsites;
  routers: { clients: AuthedRouter; websites: AuthedRouter };
}) {
  const r = new Hono<{ Variables: Vars }>();
  r.use("*", createAccountKeyAuthMiddleware(deps.accountKeys));
  r.use("*", requireMethodScope);

  /**
   * A read-only key for one of the account's sites — e.g. one per tenant, so the
   * platform can show each tenant its own numbers through the raw data API.
   */
  r.post("/websites/:websiteId/api-keys", async (c) => {
    const ownerId = c.get("userId");
    const site = await deps.ownedWebsites.getWebsite(ownerId, c.req.param("websiteId"));
    if (!site) return c.json({ error: "not found" }, 404);
    const parsed = await parseJson(c, websiteKeySchema);
    if (!parsed.ok) return parsed.res;
    const scopes = (parsed.data.scopes ?? [...API_SCOPES]) as ApiScope[];
    return c.json({ data: await deps.websiteKeys.create(site.id, ownerId, parsed.data.name, scopes) }, 201);
  });

  /**
   * A short-lived token for an iframed dashboard of one site. Mint one per page view of
   * the page holding the iframe, server-side, and put `embed_url` in the iframe's `src`.
   */
  r.post("/websites/:websiteId/embed-tokens", async (c) => {
    const ownerId = c.get("userId");
    const site = await deps.ownedWebsites.getWebsite(ownerId, c.req.param("websiteId"));
    if (!site) return c.json({ error: "not found" }, 404);
    const parsed = await parseJson(c, embedTokenBodySchema);
    if (!parsed.ok) return parsed.res;
    const { token, expiresAt } = await deps.embedTokens.issue(site.id, parsed.data.expires_in_seconds);
    return c.json({
      data: {
        token,
        expires_at: expiresAt.toISOString(),
        embed_url: `${env().frontendUrl}/embed/${site.id}?token=${token}`,
      },
    }, 201);
  });

  r.route("/clients", deps.routers.clients);
  r.route("/websites", deps.routers.websites);
  return r;
}
