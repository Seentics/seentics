/**
 * Client users: an agency's client contacts, each with read-only portal access to one
 * client.
 *
 * Not Seentics accounts — there is no password, and Core sends no email. Inviting returns
 * the user's portal link once, for the agency to pass on; "resend" makes a fresh one and
 * kills the old. Revoking (or deleting) stops every link of the user on the next request.
 */

import type { ClientDirectory } from "../../websites/interfaces";
import { log } from "../../../platform/observability/logger";
import {
  AgencyOperationError,
  CLIENT_USER_LINK_TTL_DAYS,
  type ClientUser,
  type ClientUserRepository,
  type ClientUsers,
  type IssuedPortalLink,
} from "../interfaces";

/** The part of the portal service that issues and kills a user's links. */
export type ClientUserLinks = {
  issue(ownerId: string, clientId: string, clientUserId: string | null, ttlDays: number): Promise<IssuedPortalLink>;
  revokeForClientUser(ownerId: string, clientUserId: string): Promise<number>;
};

export class ClientUserService implements ClientUsers {
  constructor(
    private readonly repo: ClientUserRepository,
    private readonly clients: Pick<ClientDirectory, "getClient">,
    private readonly links: ClientUserLinks,
  ) {}

  list(ownerId: string, filter: { clientId?: string }): Promise<ClientUser[]> {
    return this.repo.list(ownerId, filter);
  }

  get(ownerId: string, id: string): Promise<ClientUser | null> {
    return this.repo.findById(ownerId, id);
  }

  private async require(ownerId: string, id: string): Promise<ClientUser> {
    const user = await this.repo.findById(ownerId, id);
    if (!user) throw new AgencyOperationError("client_user_not_found");
    return user;
  }

  async invite(ownerId: string, input: { clientId: string; email: string; name: string }) {
    // Another owner's client reads exactly like a missing one.
    if (!(await this.clients.getClient(ownerId, input.clientId))) throw new AgencyOperationError("client_not_found");
    const created = await this.repo.insert(ownerId, { ...input, email: input.email.trim().toLowerCase() });
    if (!created) throw new AgencyOperationError("client_user_exists");
    const link = await this.links.issue(ownerId, created.clientId, created.id, CLIENT_USER_LINK_TTL_DAYS);
    log.info({ category: "agency", msg: "client_user_invited", user_id: ownerId, client_id: created.clientId, client_user_id: created.id });
    return { clientUser: { ...created, linkExpiresAt: link.record.expiresAt }, link };
  }

  async resend(ownerId: string, id: string) {
    const user = await this.require(ownerId, id);
    if (user.status === "revoked") throw new AgencyOperationError("client_user_revoked");
    await this.links.revokeForClientUser(ownerId, id);
    const link = await this.links.issue(ownerId, user.clientId, user.id, CLIENT_USER_LINK_TTL_DAYS);
    return { clientUser: { ...user, linkExpiresAt: link.record.expiresAt }, link };
  }

  async revoke(ownerId: string, id: string): Promise<ClientUser> {
    await this.require(ownerId, id);
    // Status first: the token lookup refuses a revoked user's tokens even before they are marked.
    await this.repo.setStatus(ownerId, id, "revoked");
    await this.links.revokeForClientUser(ownerId, id);
    log.info({ category: "agency", msg: "client_user_revoked", user_id: ownerId, client_user_id: id });
    return this.require(ownerId, id);
  }

  async remove(ownerId: string, id: string): Promise<boolean> {
    // The tokens reference the user ON DELETE CASCADE, so they go in the same statement.
    const removed = await this.repo.delete(ownerId, id);
    if (removed) log.info({ category: "agency", msg: "client_user_deleted", user_id: ownerId, client_user_id: id });
    return removed;
  }
}
