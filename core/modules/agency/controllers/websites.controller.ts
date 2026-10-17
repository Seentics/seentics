import type { UpdateWebsiteInput } from "../../websites/interfaces";
import { nextCursor } from "../lib/cursor";
import { list, notFound, ok, parseBody, parseQuery } from "../lib/envelope";
import { presentInstall, presentVerification, presentWebsite } from "../lib/presenters";
import { websiteCreateSchema, websiteListQuerySchema, websitePatchSchema } from "../validators/agency.schema";
import { cursorOf, handle, idParam, type AgencyControllerDeps } from "./agency-controller.types";

/**
 * Every website the agency has, in a client or not. Another agency's site is not found.
 * Plan limits on how many sites an account may have are the gateway's; Core just creates.
 *
 *   GET    /websites?client_id=&unassigned=true&q=&limit=&cursor=
 *   POST   /websites { name, url, client_id? }           → 201
 *   GET    /websites/:id
 *   PATCH  /websites/:id { name?, url?, client_id? }     `client_id` moves it; `null` takes it out
 *   DELETE /websites/:id                                 → 204, with everything it collected
 *   GET    /websites/:id/install                         snippet, per-platform steps, verification
 *   POST   /websites/:id/verify                          re-check now → verification
 */

export function listWebsites(deps: AgencyControllerDeps) {
  return handle(async (c, ownerId) => {
    const q = parseQuery(c, websiteListQuerySchema);
    if (!q.ok) return q.res;
    const cur = cursorOf(c, q.data.cursor);
    if (!cur.ok) return cur.res;
    const page = await deps.websites.pageWebsites(
      ownerId,
      { clientId: q.data.client_id, unassigned: q.data.unassigned, q: q.data.q },
      { limit: q.data.limit, after: cur.after },
    );
    return list(c, page.items.map(presentWebsite), { nextCursor: nextCursor(page.items, page.hasMore), hasMore: page.hasMore });
  });
}

export function createWebsite(deps: AgencyControllerDeps) {
  return handle(async (c, ownerId) => {
    const body = await parseBody(c, websiteCreateSchema);
    if (!body.ok) return body.res;
    const site = await deps.websites.createWebsite(ownerId, { name: body.data.name, url: body.data.url, clientId: body.data.client_id ?? null });
    return ok(c, presentWebsite(site), 201);
  });
}

export function getWebsite(deps: AgencyControllerDeps) {
  return handle(async (c, ownerId) => {
    const id = idParam(c, "id");
    const site = id ? await deps.websites.getWebsite(ownerId, id) : null;
    return site ? ok(c, presentWebsite(site)) : notFound(c, "Website");
  });
}

export function updateWebsite(deps: AgencyControllerDeps) {
  return handle(async (c, ownerId) => {
    const id = idParam(c, "id");
    if (!id) return notFound(c, "Website");
    const body = await parseBody(c, websitePatchSchema);
    if (!body.ok) return body.res;
    const input: UpdateWebsiteInput = {};
    if (body.data.name !== undefined) input.name = body.data.name;
    if (body.data.url !== undefined) input.url = body.data.url;
    if (body.data.client_id !== undefined) input.clientId = body.data.client_id;
    const site = await deps.websites.updateWebsite(ownerId, id, input);
    return site ? ok(c, presentWebsite(site)) : notFound(c, "Website");
  });
}

export function deleteWebsite(deps: AgencyControllerDeps) {
  return handle(async (c, ownerId) => {
    const id = idParam(c, "id");
    return id && (await deps.websites.deleteWebsite(ownerId, id)) ? c.body(null, 204) : notFound(c, "Website");
  });
}

export function getInstall(deps: AgencyControllerDeps) {
  return handle(async (c, ownerId) => {
    const id = idParam(c, "id");
    const site = id ? await deps.websites.getWebsite(ownerId, id) : null;
    const verification = site ? await deps.verification.check(ownerId, site.id) : null;
    return site && verification ? ok(c, presentInstall(site, verification, deps.urls())) : notFound(c, "Website");
  });
}

export function verifyWebsite(deps: AgencyControllerDeps) {
  return handle(async (c, ownerId) => {
    const id = idParam(c, "id");
    const verification = id ? await deps.verification.check(ownerId, id, { recheck: true }) : null;
    return verification ? ok(c, presentVerification(verification)) : notFound(c, "Website");
  });
}
