import { Hono } from "hono";
import { authMiddleware, type AuthVars } from "../../platform/middleware/auth";
import { getWhiteLabel, updateWhiteLabel, type WhiteLabelControllerDeps } from "./controllers/white-label.controller";
import {
  createClientUser,
  createPortalToken,
  deleteClientUser,
  getClientUser,
  listClientUsers,
  resendClientUserLink,
  revokeClientUser,
  revokePortalToken,
  type ClientUserControllerDeps,
} from "./controllers/client-user.controller";
import { validatePortalToken, type PortalControllerDeps } from "./controllers/portal.controller";

/**
 * The agency dashboard's white label, client users and portal links. Mounted at
 * `/user/agency` next to the websites module's `/clients` routes, so it claims only its
 * own paths — `/clients/:clientId/portal-token` and nothing else under `/clients`.
 */
export function createAgencyDashboardRoutes(deps: WhiteLabelControllerDeps & ClientUserControllerDeps) {
  const routes = new Hono<{ Variables: AuthVars }>();
  routes.use("/white-label", authMiddleware);
  routes.use("/client-users", authMiddleware);
  routes.use("/client-users/*", authMiddleware);
  routes.use("/clients/:clientId/portal-token", authMiddleware);

  routes.get("/white-label", getWhiteLabel(deps));
  routes.patch("/white-label", updateWhiteLabel(deps));

  routes.get("/client-users", listClientUsers(deps));
  routes.post("/client-users", createClientUser(deps));
  routes.get("/client-users/:id", getClientUser(deps));
  routes.delete("/client-users/:id", deleteClientUser(deps));
  routes.post("/client-users/:id/revoke", revokeClientUser(deps));
  routes.post("/client-users/:id/resend", resendClientUserLink(deps));

  routes.post("/clients/:clientId/portal-token", createPortalToken(deps));
  routes.delete("/clients/:clientId/portal-token", revokePortalToken(deps));
  return routes;
}

/** The client portal's public entry. Mounted at `/agency/portal`. */
export function createPortalRoutes(deps: PortalControllerDeps) {
  const routes = new Hono();
  routes.post("/validate", validatePortalToken(deps));
  return routes;
}
