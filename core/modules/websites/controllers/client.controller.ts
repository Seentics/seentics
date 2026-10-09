import type { Context } from "hono";
import { z } from "zod";
import { requireUser, type AuthVars } from "../../../platform/middleware/auth";
import { parseJson, parseQuery, validationErrorResponse } from "../../../platform/validation";
import { presentWebsite } from "../lib/website-presenter";
import { presentClient, presentClientWebsite } from "../lib/client-presenter";
import { toUpdateWebsiteInput } from "../lib/patch-mapping";
import { websiteCreateSchema, websitePatchSchema } from "../validators/website.schema";
import {
  assignWebsiteSchema,
  clientCreateSchema,
  clientUpdateSchema,
  pageQuerySchema,
  toClientInput,
  toCreateClientInput,
} from "../validators/client.schema";
import {
  ClientOperationError,
  type ClientDirectory,
  type ClientFailure,
  type OwnedWebsites,
} from "../interfaces/client.interface";
import type { Website } from "../interfaces";

/**
 * Clients and an owner's websites, for whoever the mounting router authenticated as
 * `userId`.
 *
 * No auth here: the dashboard mounts these behind the session middleware and the
 * management API behind account-key authentication. Both resolve to the same owner, so
 * both surfaces get exactly the same rules.
 */

export type ClientControllerDeps = { clients: ClientDirectory; scriptUrl: () => string };
export type OwnedWebsiteControllerDeps = { websites: OwnedWebsites; scriptUrl: () => string };

type Ctx = Context<{ Variables: AuthVars }>;

const FAILURE_STATUS: Record<ClientFailure, 404 | 409> = {
  not_found: 404,
  website_not_found: 404,
  website_limit_reached: 409,
  external_id_taken: 409,
};

/** Resolve the owner, and answer a refused client operation with its status rather than a 500. */
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

// ─── Clients ────────────────────────────────────────────────────────────────

const clientListQuerySchema = pageQuerySchema.extend({ external_id: z.string().optional() });

/** `?external_id=` looks one client up by the caller's own id. */
export function listClients(deps: ClientControllerDeps) {
  return guarded(async (c, ownerId) => {
    const q = parseQuery(c, clientListQuerySchema);
    if (!q.ok) return q.res;
    if (q.data.external_id) {
      const one = await deps.clients.getClientByExternalId(ownerId, q.data.external_id);
      return c.json({ data: one ? [presentClient(one, deps.scriptUrl())] : [], has_more: false });
    }
    const page = await deps.clients.listClients(ownerId, q.data);
    return c.json({ data: page.items.map((cl) => presentClient(cl, deps.scriptUrl())), has_more: page.hasMore });
  });
}

/** 201 when created; 200 with `created: false` when `external_id` already named a client. */
export function createClient(deps: ClientControllerDeps) {
  return guarded(async (c, ownerId) => {
    const parsed = await parseJson(c, clientCreateSchema);
    if (!parsed.ok) return parsed.res;
    const { website } = parsed.data;
    const result = await deps.clients.createClient(ownerId, toCreateClientInput(parsed.data), website);
    return c.json(
      { data: presentClient(result.client, deps.scriptUrl()), created: result.created },
      result.created ? 201 : 200,
    );
  });
}

export function getClient(deps: ClientControllerDeps) {
  return guarded(async (c, ownerId) => {
    const client = await deps.clients.getClient(ownerId, c.req.param("clientId")!);
    return client ? c.json({ data: presentClient(client, deps.scriptUrl()) }) : notFound(c);
  });
}

/** Feature switches and limits merge into what is stored, so one key changes one thing. */
export function updateClient(deps: ClientControllerDeps) {
  return guarded(async (c, ownerId) => {
    const parsed = await parseJson(c, clientUpdateSchema);
    if (!parsed.ok) return parsed.res;
    const client = await deps.clients.updateClient(ownerId, c.req.param("clientId")!, toClientInput(parsed.data));
    return client ? c.json({ data: presentClient(client, deps.scriptUrl()) }) : notFound(c);
  });
}

/** `?delete_websites=true` also deletes the client's sites and their data; by default they are kept, ungrouped. */
export function deleteClient(deps: ClientControllerDeps) {
  return guarded(async (c, ownerId) => {
    const deleteWebsites = c.req.query("delete_websites") === "true";
    const ok = await deps.clients.deleteClient(ownerId, c.req.param("clientId")!, { deleteWebsites });
    return ok ? c.body(null, 204) : notFound(c);
  });
}

export function listClientWebsites(deps: ClientControllerDeps) {
  return guarded(async (c, ownerId) => {
    const client = await deps.clients.getClient(ownerId, c.req.param("clientId")!);
    if (!client) return notFound(c);
    return c.json({ data: client.websites.map((s) => presentClientWebsite(s, deps.scriptUrl())) });
  });
}

export function assignClientWebsite(deps: ClientControllerDeps) {
  return guarded(async (c, ownerId) => {
    const parsed = await parseJson(c, assignWebsiteSchema);
    if (!parsed.ok) return parsed.res;
    const websiteId = (parsed.data.website_id ?? parsed.data.websiteId)!;
    const site = await deps.clients.assignWebsite(ownerId, c.req.param("clientId")!, websiteId);
    return c.json({ data: presentClientWebsite(site, deps.scriptUrl()) }, 201);
  });
}

export function unassignClientWebsite(deps: ClientControllerDeps) {
  return guarded(async (c, ownerId) => {
    const ok = await deps.clients.unassignWebsite(ownerId, c.req.param("clientId")!, c.req.param("websiteId")!);
    return ok ? c.body(null, 204) : notFound(c);
  });
}

/** What the agency dashboard opens a client's analytics with. */
export function getClientAnalytics(deps: ClientControllerDeps) {
  return guarded(async (c, ownerId) => {
    const client = await deps.clients.getClient(ownerId, c.req.param("clientId")!);
    if (!client) return notFound(c);
    return c.json({
      data: { client: presentClient(client, deps.scriptUrl()), websiteIds: client.websites.map((s) => s.id) },
    });
  });
}

// ─── Owned websites ─────────────────────────────────────────────────────────

const websiteListQuerySchema = pageQuerySchema.extend({ client_id: z.string().uuid().optional() });

/** A bare host is accepted here, unlike the dashboard's form: a signup handler has a hostname, not a URL. */
const ownedWebsiteCreateSchema = websiteCreateSchema.extend({
  url: z.string().trim().min(1).max(2048),
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

export function getOwnedWebsiteSnippet(deps: OwnedWebsiteControllerDeps) {
  return guarded(async (c, ownerId) => {
    const site = await deps.websites.getWebsite(ownerId, c.req.param("websiteId")!);
    if (!site) return notFound(c);
    const { script_url, snippet } = presentClientWebsite(site, deps.scriptUrl());
    return c.json({ data: { website_id: site.id, script_url, snippet } });
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
