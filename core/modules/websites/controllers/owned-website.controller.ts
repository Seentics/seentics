import type { Context } from "hono";
import { z } from "zod";
import { requireUser, type AuthVars } from "../../../platform/middleware/auth";
import { parseJson, parseQuery, validationErrorResponse } from "../../../platform/validation";
import { presentWebsite } from "../lib/website-presenter";
import { presentClientWebsite } from "../lib/client-presenter";
import { toUpdateWebsiteInput } from "../lib/patch-mapping";
import { pageQuerySchema, websiteCreateSchema, websitePatchSchema, zSiteAddress } from "../validators/website.schema";
import { ClientOperationError, type ClientFailure, type OwnedWebsites } from "../interfaces/client.interface";
import type { Website } from "../interfaces";

/**
 * An owner's websites, for whoever the mounting router authenticated as `userId` — the
 * management API, behind account-key authentication. No auth here.
 *
 * Clients themselves are managed only through the agency workspace (`/api/v1/agency`).
 */

export type OwnedWebsiteControllerDeps = { websites: OwnedWebsites; scriptUrl: () => string };

type Ctx = Context<{ Variables: AuthVars }>;

const FAILURE_STATUS: Record<ClientFailure, 404> = {
  not_found: 404,
  website_not_found: 404,
};

/** Resolve the owner, and answer a refused operation with its status rather than a 500. */
function guarded(run: (c: Ctx, ownerId: string) => Promise<Response>) {
  return async (c: Ctx) => {
    const ownerId = requireUser(c);
    if (!ownerId) return c.json({ error: "unauthorized" }, 401);
    try {
      return await run(c, ownerId);
    } catch (e) {
      if (e instanceof ClientOperationError) return c.json({ error: e.reason }, FAILURE_STATUS[e.reason]);
      throw e;
    }
  };
}

const notFound = (c: Ctx) => c.json({ error: "not found" }, 404);

// ─── Owned websites ─────────────────────────────────────────────────────────

const websiteListQuerySchema = pageQuerySchema.extend({ client_id: z.string().uuid().optional() });

/** A bare host is accepted here, unlike the dashboard's form: a signup handler has a hostname, not a URL. */
const ownedWebsiteCreateSchema = websiteCreateSchema.extend({
  url: zSiteAddress,
  client_id: z.string().uuid().nullable().optional(),
});

function presentOwned(site: Website, scriptUrl: string) {
  const { script_url, snippet } = presentClientWebsite(site, scriptUrl);
  return { ...presentWebsite(site), script_url, snippet };
}

export function listOwnedWebsites(deps: OwnedWebsiteControllerDeps) {
  return guarded(async (c, ownerId) => {
    const q = parseQuery(c, websiteListQuerySchema);
    if (!q.ok) return q.res;
    const page = await deps.websites.listWebsites(ownerId, {
      clientId: q.data.client_id,
      limit: q.data.limit,
      offset: q.data.offset,
    });
    return c.json({ data: page.items.map((s) => presentOwned(s, deps.scriptUrl())), has_more: page.hasMore });
  });
}

export function createOwnedWebsite(deps: OwnedWebsiteControllerDeps) {
  return guarded(async (c, ownerId) => {
    const parsed = await parseJson(c, ownedWebsiteCreateSchema);
    if (!parsed.ok) return parsed.res;
    const site = await deps.websites.createWebsite(ownerId, {
      name: parsed.data.name,
      url: parsed.data.url,
      clientId: parsed.data.client_id ?? null,
    });
    return c.json({ data: presentOwned(site, deps.scriptUrl()) }, 201);
  });
}

export function getOwnedWebsite(deps: OwnedWebsiteControllerDeps) {
  return guarded(async (c, ownerId) => {
    const site = await deps.websites.getWebsite(ownerId, c.req.param("websiteId")!);
    return site ? c.json({ data: presentOwned(site, deps.scriptUrl()) }) : notFound(c);
  });
}

/** The dashboard's patch vocabulary, plus `client_id` (`null` ungroups the site). */
export function updateOwnedWebsite(deps: OwnedWebsiteControllerDeps) {
  return guarded(async (c, ownerId) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = websitePatchSchema.safeParse(raw);
    if (!parsed.success) return validationErrorResponse(c, parsed.error);
    const input = toUpdateWebsiteInput(parsed.data);
    if ("client_id" in parsed.data) {
      const id = parsed.data.client_id;
      if (id !== null && !z.string().uuid().safeParse(id).success) {
        return validationErrorResponse(c, "client_id must be a UUID or null");
      }
      input.clientId = id as string | null;
    }
    const site = await deps.websites.updateWebsite(ownerId, c.req.param("websiteId")!, input);
    return site ? c.json({ data: presentOwned(site, deps.scriptUrl()) }) : notFound(c);
  });
}

export function deleteOwnedWebsite(deps: OwnedWebsiteControllerDeps) {
  return guarded(async (c, ownerId) => {
    const ok = await deps.websites.deleteWebsite(ownerId, c.req.param("websiteId")!);
    return ok ? c.body(null, 204) : notFound(c);
  });
}
