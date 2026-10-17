import type { UpdateClientInput } from "../../websites/interfaces";
import { nextCursor } from "../lib/cursor";
import { list, notFound, ok, parseBody, parseQuery } from "../lib/envelope";
import type { AgencyCtx } from "../lib/gateway-context";
import { presentClient, presentClientDetail, presentInstall, presentWebsite } from "../lib/presenters";
import {
  clientCreateSchema,
  clientListQuerySchema,
  clientPatchSchema,
  clientWebsiteCreateSchema,
  deleteConfirmSchema,
  featuresBodySchema,
  pageQuerySchema,
} from "../validators/agency.schema";
import { cursorOf, handle, idParam, type AgencyControllerDeps } from "./agency-controller.types";

/**
 * Clients, for the agency the gateway named. Another agency's client is not found.
 *
 *   GET    /clients?status=&q=&limit=&cursor=   newest first
 *   POST   /clients { name, company?, notes? }  → 201
 *   GET    /clients/:id                         with its websites
 *   PATCH  /clients/:id { name?, company?, notes?, status?, collect_features? }
 *   POST   /clients/:id/archive | /unarchive    status archived (its sites stop collecting) | active
 *   DELETE /clients/:id?confirm=true            → 204; its websites stay, in no client
 *   GET    /clients/:id/websites                by cursor
 *   POST   /clients/:id/websites { name, url }  → 201 `{ website, install }`
 *   GET    /clients/:id/features                → `{ features: { <page>: off|view|edit } }`
 *   PUT    /clients/:id/features { features }   the whole matrix; a page left out is `off`
 */

export function listClients(deps: AgencyControllerDeps) {
  return handle(async (c, ownerId) => {
    const q = parseQuery(c, clientListQuerySchema);
    if (!q.ok) return q.res;
    const cur = cursorOf(c, q.data.cursor);
    if (!cur.ok) return cur.res;
    const page = await deps.clients.listClients(ownerId, { status: q.data.status, q: q.data.q }, { limit: q.data.limit, after: cur.after });
    return list(c, page.items.map(presentClient), { nextCursor: nextCursor(page.items, page.hasMore), hasMore: page.hasMore });
  });
}

export function createClient(deps: AgencyControllerDeps) {
  return handle(async (c, ownerId) => {
    const body = await parseBody(c, clientCreateSchema);
    if (!body.ok) return body.res;
    const client = await deps.clients.createClient(ownerId, body.data);
    return ok(c, presentClientDetail(client), 201);
  });
}

export function getClient(deps: AgencyControllerDeps) {
  return handle(async (c, ownerId) => {
    const id = idParam(c, "id");
    const client = id ? await deps.clients.getClient(ownerId, id) : null;
    return client ? ok(c, presentClientDetail(client)) : notFound(c, "Client");
  });
}

const patchClient = (deps: AgencyControllerDeps, c: AgencyCtx, ownerId: string, input: UpdateClientInput) => {
  const id = idParam(c, "id");
  return id ? deps.clients.updateClient(ownerId, id, input) : Promise.resolve(null);
};

export function updateClient(deps: AgencyControllerDeps) {
  return handle(async (c, ownerId) => {
    const body = await parseBody(c, clientPatchSchema);
    if (!body.ok) return body.res;
    const { collect_features, ...rest } = body.data;
    const client = await patchClient(deps, c, ownerId, { ...rest, ...(collect_features ? { collectFeatures: collect_features } : {}) });
    return client ? ok(c, presentClientDetail(client)) : notFound(c, "Client");
  });
}

export function archiveClient(deps: AgencyControllerDeps, status: "archived" | "active") {
  return handle(async (c, ownerId) => {
    const client = await patchClient(deps, c, ownerId, { status });
    return client ? ok(c, presentClientDetail(client)) : notFound(c, "Client");
  });
}

export function deleteClient(deps: AgencyControllerDeps) {
  return handle(async (c, ownerId) => {
    const id = idParam(c, "id");
    if (!id || !(await deps.clients.getClient(ownerId, id))) return notFound(c, "Client");
    const confirm = parseQuery(c, deleteConfirmSchema);
    if (!confirm.ok) return confirm.res;
    return (await deps.clients.deleteClient(ownerId, id)) ? c.body(null, 204) : notFound(c, "Client");
  });
}

export function listClientWebsites(deps: AgencyControllerDeps) {
  return handle(async (c, ownerId) => {
    const id = idParam(c, "id");
    if (!id || !(await deps.clients.getClient(ownerId, id))) return notFound(c, "Client");
    const q = parseQuery(c, pageQuerySchema);
    if (!q.ok) return q.res;
    const cur = cursorOf(c, q.data.cursor);
    if (!cur.ok) return cur.res;
    const page = await deps.websites.pageWebsites(ownerId, { clientId: id }, { limit: q.data.limit, after: cur.after });
    return list(c, page.items.map(presentWebsite), { nextCursor: nextCursor(page.items, page.hasMore), hasMore: page.hasMore });
  });
}

/** A new site has never sent anything: its install comes back `not_seen` without asking. */
export function createClientWebsite(deps: AgencyControllerDeps) {
  return handle(async (c, ownerId) => {
    const id = idParam(c, "id");
    if (!id || !(await deps.clients.getClient(ownerId, id))) return notFound(c, "Client");
    const body = await parseBody(c, clientWebsiteCreateSchema);
    if (!body.ok) return body.res;
    const site = await deps.websites.createWebsite(ownerId, { name: body.data.name, url: body.data.url, clientId: id });
    const install = presentInstall(site, { status: "not_seen", isVerified: false, lastEventAt: null, events24h: 0 }, deps.urls());
    return ok(c, { website: presentWebsite(site), install }, 201);
  });
}

export function getClientFeatures(deps: AgencyControllerDeps) {
  return handle(async (c, ownerId) => {
    const id = idParam(c, "id");
    const client = id ? await deps.clients.getClient(ownerId, id) : null;
    return client ? ok(c, { features: client.dashboardFeatures }) : notFound(c, "Client");
  });
}

export function putClientFeatures(deps: AgencyControllerDeps) {
  return handle(async (c, ownerId) => {
    const id = idParam(c, "id");
    if (!id || !(await deps.clients.getClient(ownerId, id))) return notFound(c, "Client");
    const body = await parseBody(c, featuresBodySchema);
    if (!body.ok) return body.res;
    const client = await deps.clients.updateClient(ownerId, id, { dashboardFeatures: body.data.features });
    return client ? ok(c, { features: client.dashboardFeatures }) : notFound(c, "Client");
  });
}
