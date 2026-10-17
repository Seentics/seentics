import { env } from "../../../config";
import { parseJson, parseQuery } from "../../../platform/validation";
import type { ClientUsers, PortalLinks } from "../interfaces";
import { presentClientUser, presentIssuedLink } from "../lib/presenters";
import { clientUserCreateSchema, clientUserListQuerySchema, idParamSchema } from "../validators/agency.schema";
import { guarded, notFound, type Ctx } from "./guarded";

/**
 * Client users and portal links, for the signed-in agency owner.
 *
 *   GET    /client-users[?client_id=]       the owner's client users, newest first
 *   POST   /client-users                    `{ client_id, email, name? }` → 201, with the link
 *   GET    /client-users/:id
 *   DELETE /client-users/:id                → 204; its links die with it
 *   POST   /client-users/:id/revoke         status `revoked`, links dead at once
 *   POST   /client-users/:id/resend         a fresh link; the old ones die
 *   POST   /clients/:clientId/portal-token  the client's anonymous 7-day link, replacing any earlier one
 *   DELETE /clients/:clientId/portal-token  → 204; the anonymous link stops working
 *
 * A link's token is in the response that made it and nowhere else: only its hash is
 * stored. Core sends no email; the agency passes the link on.
 */

export type ClientUserControllerDeps = { clientUsers: ClientUsers; portal: PortalLinks };

const frontendUrl = () => env().frontendUrl;

/** A malformed id is just an id nobody has. */
const idOf = (c: Ctx, name: string) => {
  const id = idParamSchema.safeParse(c.req.param(name));
  return id.success ? id.data : null;
};

export function listClientUsers(deps: ClientUserControllerDeps) {
  return guarded(async (c, ownerId) => {
    const q = parseQuery(c, clientUserListQuerySchema);
    if (!q.ok) return q.res;
    const users = await deps.clientUsers.list(ownerId, { clientId: q.data.client_id });
    return c.json({ data: users.map(presentClientUser) });
  });
}

export function createClientUser(deps: ClientUserControllerDeps) {
  return guarded(async (c, ownerId) => {
    const parsed = await parseJson(c, clientUserCreateSchema);
    if (!parsed.ok) return parsed.res;
    const { clientUser, link } = await deps.clientUsers.invite(ownerId, {
      clientId: parsed.data.client_id,
      email: parsed.data.email,
      name: parsed.data.name,
    });
    return c.json({ data: { client_user: presentClientUser(clientUser), link: presentIssuedLink(link, frontendUrl()) } }, 201);
  });
}

export function getClientUser(deps: ClientUserControllerDeps) {
  return guarded(async (c, ownerId) => {
    const id = idOf(c, "id");
    const user = id ? await deps.clientUsers.get(ownerId, id) : null;
    return user ? c.json({ data: presentClientUser(user) }) : notFound(c);
  });
}

export function deleteClientUser(deps: ClientUserControllerDeps) {
  return guarded(async (c, ownerId) => {
    const id = idOf(c, "id");
    if (!id || !(await deps.clientUsers.remove(ownerId, id))) return notFound(c);
    return c.body(null, 204);
  });
}

export function revokeClientUser(deps: ClientUserControllerDeps) {
  return guarded(async (c, ownerId) => {
    const id = idOf(c, "id");
    if (!id) return notFound(c);
    return c.json({ data: presentClientUser(await deps.clientUsers.revoke(ownerId, id)) });
  });
}

export function resendClientUserLink(deps: ClientUserControllerDeps) {
  return guarded(async (c, ownerId) => {
    const id = idOf(c, "id");
    if (!id) return notFound(c);
    const { clientUser, link } = await deps.clientUsers.resend(ownerId, id);
    return c.json({ data: { client_user: presentClientUser(clientUser), link: presentIssuedLink(link, frontendUrl()) } });
  });
}

export function createPortalToken(deps: ClientUserControllerDeps) {
  return guarded(async (c, ownerId) => {
    const clientId = idOf(c, "clientId");
    if (!clientId) return c.json({ error: "client_not_found" }, 404);
    const link = await deps.portal.issueClientLink(ownerId, clientId);
    return c.json({ data: presentIssuedLink(link, frontendUrl()) }, 201);
  });
}

export function revokePortalToken(deps: ClientUserControllerDeps) {
  return guarded(async (c, ownerId) => {
    const clientId = idOf(c, "clientId");
    if (!clientId || !(await deps.portal.revokeClientLinks(ownerId, clientId))) return c.json({ error: "client_not_found" }, 404);
    return c.body(null, 204);
  });
}
