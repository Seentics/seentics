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

import { Hono, type Context, type MiddlewareHandler } from "hono";
import { z } from "zod";
import { normalizeSections, sectionsSchema, type EmbedSection } from "../../../modules/api-keys/interfaces";
import { env } from "../../../config";
import { takeRateToken } from "../../../platform/cache/token-bucket";
import type { AuthVars } from "../../../platform/middleware/auth";
import {
  type AccountKeyVerifier,
  type AccountScope,
  type EmbedLinks,
  type VerifiedAccountKey,
} from "../../../modules/api-keys/interfaces";
import type { ClientDirectory, OwnedWebsites } from "../../../modules/websites/interfaces";
import type { AuthedRouter } from "../../../platform/http/router";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/** The optional (POST) or required (PATCH) `sections` of an embed-link body. */
async function readSections(c: Context, required: boolean): Promise<{ ok: true; sections?: EmbedSection[] } | { ok: false; res: Response }> {
  const raw = await c.req.text();
  if (!raw.trim() && !required) return { ok: true };
  let json: unknown;
  try {
    json = JSON.parse(raw || "{}");
  } catch {
    return { ok: false, res: c.json({ error: "Invalid JSON body" }, 400) };
  }
  const schema = z.object({ sections: required ? sectionsSchema : sectionsSchema.optional() });
  const parsed = schema.safeParse(json);
  if (!parsed.success) return { ok: false, res: c.json({ error: parsed.error.issues[0]?.message ?? "Invalid body", code: "invalid_sections" }, 400) };
  return { ok: true, sections: parsed.data.sections && normalizeSections(parsed.data.sections) };
}

export function createManagementRoutes(deps: {
  accountKeys: AccountKeyVerifier;
  embedLinks: EmbedLinks;
  clients: ClientDirectory;
  ownedWebsites: OwnedWebsites;
  routers: { clients: AuthedRouter; websites: AuthedRouter };
}) {
  const r = new Hono<{ Variables: Vars }>();
  r.use("*", createAccountKeyAuthMiddleware(deps.accountKeys));
  r.use("*", requireMethodScope);

  /**
   * Embed links: a permanent URL that shows one website's (or all of one client's)
   * analytics in an iframe. POST returns the existing link when there is one; DELETE
   * revokes it, and the next POST makes a new URL.
   */
  const embed = (scope: "website" | "client") => {
    const lookup = async (ownerId: string, id: string): Promise<string | null> =>
      !UUID_RE.test(id) ? null : scope === "website"
        ? (await deps.ownedWebsites.getWebsite(ownerId, id))?.name ?? null
        : (await deps.clients.getClient(ownerId, id))?.name ?? null;
    const target = (id: string) => (scope === "website" ? { websiteId: id } : { clientId: id });

    r.post(`/${scope}s/:id/embed-link`, async (c) => {
      const ownerId = c.get("userId");
      const id = c.req.param("id");
      const name = await lookup(ownerId, id);
      if (name === null) return c.json({ error: "not found" }, 404);
      const body = await readSections(c, false);
      if (!body.ok) return body.res;
      const { link, created } = await deps.embedLinks.getOrCreate(ownerId, target(id), body.sections);
      return c.json({ data: await deps.embedLinks.present(link, name) }, created ? 201 : 200);
    });

    // Change which sections the link exposes; the URL stays the same and applies at once.
    r.patch(`/${scope}s/:id/embed-link`, async (c) => {
      const ownerId = c.get("userId");
      const id = c.req.param("id");
      const name = await lookup(ownerId, id);
      if (name === null) return c.json({ error: "not found" }, 404);
      const body = await readSections(c, true);
      if (!body.ok) return body.res;
      const link = await deps.embedLinks.findLive(target(id));
      const updated = link && (await deps.embedLinks.setSections(link.id, body.sections!));
      if (!updated) return c.json({ error: "not found" }, 404);
      return c.json({ data: await deps.embedLinks.present(updated, name) });
    });

    r.delete(`/${scope}s/:id/embed-link`, async (c) => {
      const ownerId = c.get("userId");
      const id = c.req.param("id");
      if ((await lookup(ownerId, id)) === null) return c.json({ error: "not found" }, 404);
      const link = await deps.embedLinks.findLive(target(id));
      if (!link) return c.json({ error: "not found" }, 404);
      await deps.embedLinks.revoke(link.id);
      return c.body(null, 204);
    });
  };
  embed("website");
  embed("client");

  r.route("/clients", deps.routers.clients);
  r.route("/websites", deps.routers.websites);
  return r;
}
