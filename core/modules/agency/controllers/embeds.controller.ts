import type { EmbedLinkRecord } from "../../api-keys/interfaces";
import { encodeCursor } from "../lib/cursor";
import { list, notFound, ok, parseBody, parseQuery } from "../lib/envelope";
import { embedCreateSchema, embedListQuerySchema, embedPatchSchema } from "../validators/agency.schema";
import { cursorOf, handle, idParam, type AgencyControllerDeps } from "./agency-controller.types";

/**
 * Embed links — a permanent, revocable URL showing one website's (or all of one client's)
 * dashboard in an iframe. The api-keys module owns them; this is their management surface.
 *
 *   GET    /embeds?scope=&target_id=&limit=&cursor=   the agency's live links, newest first
 *   POST   /embeds { scope, target_id, sections? }    the target's link: 201 made, 200 existing
 *   PATCH  /embeds/:id { sections }                   effective at once, same URL
 *   DELETE /embeds/:id                                → 204; making it again gives a new URL
 *
 * A link whose target is no longer the agency's (deleted, or a site moved out) is not
 * listed and reads as not found.
 */

/** The target's name while it is the owner's, else `null`. */
async function targetName(deps: AgencyControllerDeps, ownerId: string, scope: EmbedLinkRecord["scope"], targetId: string) {
  return scope === "website"
    ? ((await deps.websites.getWebsite(ownerId, targetId))?.name ?? null)
    : ((await deps.clients.getClient(ownerId, targetId))?.name ?? null);
}

/** The owner's live link with this id, and its target's name. */
async function ownedLink(deps: AgencyControllerDeps, ownerId: string, id: string | null) {
  const link = id ? await deps.embedLinks.findById(id) : null;
  if (!link || link.ownerId !== ownerId) return null;
  const name = await targetName(deps, ownerId, link.scope, link.targetId);
  return name === null ? null : { link, name };
}

const newestFirst = (a: EmbedLinkRecord, b: EmbedLinkRecord) =>
  b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

export function listEmbeds(deps: AgencyControllerDeps) {
  return handle(async (c, ownerId) => {
    const q = parseQuery(c, embedListQuerySchema);
    if (!q.ok) return q.res;
    const cur = cursorOf(c, q.data.cursor);
    if (!cur.ok) return cur.res;
    // An agency has a link or two per client, not thousands: paged here over the one read.
    const after = cur.after;
    const links = (await deps.embedLinks.listLive(ownerId))
      .filter((l) => (!q.data.scope || l.scope === q.data.scope) && (!q.data.target_id || l.targetId === q.data.target_id))
      .sort(newestFirst)
      .filter((l) => !after || l.createdAt.getTime() < after.createdAt.getTime() || (l.createdAt.getTime() === after.createdAt.getTime() && l.id < after.id));
    const views = [];
    let hasMore = false;
    for (const link of links) {
      const name = await targetName(deps, ownerId, link.scope, link.targetId);
      if (name === null) continue;
      if (views.length === q.data.limit) {
        hasMore = true;
        break;
      }
      views.push({ link, view: await deps.embedLinks.present(link, name) });
    }
    const last = views[views.length - 1]?.link;
    return list(c, views.map((v) => v.view), { nextCursor: hasMore && last ? encodeCursor(last) : null, hasMore });
  });
}

export function createEmbed(deps: AgencyControllerDeps) {
  return handle(async (c, ownerId) => {
    const body = await parseBody(c, embedCreateSchema);
    if (!body.ok) return body.res;
    const { scope, target_id: targetId, sections } = body.data;
    const name = await targetName(deps, ownerId, scope, targetId);
    if (name === null) return notFound(c, scope === "website" ? "Website" : "Client");
    const { link, created } = await deps.embedLinks.getOrCreate(
      ownerId,
      scope === "website" ? { websiteId: targetId } : { clientId: targetId },
      sections,
    );
    return ok(c, await deps.embedLinks.present(link, name), created ? 201 : 200);
  });
}

export function updateEmbed(deps: AgencyControllerDeps) {
  return handle(async (c, ownerId) => {
    const found = await ownedLink(deps, ownerId, idParam(c, "id"));
    if (!found) return notFound(c, "Embed");
    const body = await parseBody(c, embedPatchSchema);
    if (!body.ok) return body.res;
    const updated = await deps.embedLinks.setSections(found.link.id, body.data.sections);
    return updated ? ok(c, await deps.embedLinks.present(updated, found.name)) : notFound(c, "Embed");
  });
}

export function deleteEmbed(deps: AgencyControllerDeps) {
  return handle(async (c, ownerId) => {
    const found = await ownedLink(deps, ownerId, idParam(c, "id"));
    if (!found) return notFound(c, "Embed");
    await deps.embedLinks.revoke(found.link.id);
    return c.body(null, 204);
  });
}
