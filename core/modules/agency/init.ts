import type { ClientDirectory } from "../websites/interfaces";
import type { AgencyModule } from "./interfaces";
import { PostgresClientUserRepository } from "./repositories/client-user.repository";
import { PostgresPortalTokenRepository } from "./repositories/portal-token.repository";
import { PostgresWhiteLabelRepository } from "./repositories/white-label.repository";
import { ClientUserService } from "./services/client-user.service";
import { PortalAccessService } from "./services/portal-access.service";
import { WhiteLabelService } from "./services/white-label.service";
import { createAgencyDashboardRoutes, createPortalRoutes } from "./routes";

/**
 * Build the agency module: white label, client users, portal links.
 *
 * Plan gating is not here: in managed Cloud the gateway decides who has agency features,
 * as it does for the rest of `/user/agency`.
 */
export function initAgencyModule(deps: {
  clients: ClientDirectory;
  /** A disabled owner's portal links stop with their sessions, like their account keys. */
  accountActive: (userId: string) => Promise<boolean>;
}): AgencyModule {
  const whiteLabel = new WhiteLabelService(new PostgresWhiteLabelRepository());
  const clientUserRepository = new PostgresClientUserRepository();
  const portal = new PortalAccessService({
    tokens: new PostgresPortalTokenRepository(),
    clients: deps.clients,
    branding: whiteLabel,
    clientUsers: clientUserRepository,
    accountActive: deps.accountActive,
  });
  const clientUsers = new ClientUserService(clientUserRepository, deps.clients, portal);

  return {
    whiteLabel,
    portal,
    clientUsers,
    dashboardRoutes: createAgencyDashboardRoutes({ whiteLabel, clientUsers, portal }),
    portalRoutes: createPortalRoutes({ portal }),
  };
}
