import type { UserDirectory } from "../../auth/interfaces";
import type { WebsiteInvitations } from "../interfaces";
import { acceptInvitationByToken } from "./members";

/**
 * `WebsiteInvitations` over the existing member functions.
 *
 * A wrapper rather than a rewrite: the acceptance logic is fine where it is, and the
 * point of the port is that the `/user` branch no longer imports this module's
 * internals to reach it.
 */
export class WebsiteInvitationService implements WebsiteInvitations {
  /** The accepting user's email is checked against the invitation; `users` is auth's. */
  constructor(private readonly directory: UserDirectory) {}

  async acceptByToken(userId: string, token: string): Promise<{ data: { websiteId: string } }> {
    return acceptInvitationByToken(userId, token, this.directory);
  }
}
