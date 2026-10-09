import { Hono } from "hono";
import { authMiddleware, type AuthVars } from "../../platform/middleware/auth";
import type { WebsiteControllerDeps } from "./controllers/website-controller.types";
import {
  createWebsite,
  deleteWebsite,
  getWebsite,
  listWebsites,
  updateWebsite,
} from "./controllers/website-crud.controller";
import {
  createWebsiteGoal,
  deleteWebsiteGoal,
  listWebsiteGoals,
  updateWebsiteGoal,
} from "./controllers/website-goals.controller";
import {
  createWebsiteInvitation,
  listWebsiteInvitations,
  revokeWebsiteInvitation,
} from "./controllers/website-invitations.controller";
import {
  addWebsiteMember,
  getWebsiteRole,
  listWebsiteMembers,
  removeWebsiteMember,
  updateWebsiteMemberRole,
} from "./controllers/website-members.controller";
import {
  getWebsitePrivacy,
  updateWebsitePrivacy,
} from "./controllers/website-privacy.controller";
import { updateWebsiteSharing } from "./controllers/website-sharing.controller";
import {
  assignClientWebsite,
  createClient,
  createOwnedWebsite,
  deleteClient,
  deleteOwnedWebsite,
  getClient,
  getClientAnalytics,
  getOwnedWebsite,
  getOwnedWebsiteSnippet,
  listClients,
  listClientWebsites,
  listOwnedWebsites,
  unassignClientWebsite,
  updateClient,
  updateOwnedWebsite,
  type ClientControllerDeps,
  type OwnedWebsiteControllerDeps,
} from "./controllers/client.controller";

/**
 * Clients, with no auth of their own — see `client.controller.ts`. The agency dashboard
 * mounts this behind `createAgencyRoutes`; the management API behind account-key auth.
 */
export function createClientRoutes(deps: ClientControllerDeps) {
  const routes = new Hono<{ Variables: AuthVars }>();
  routes.get("/", listClients(deps));
  routes.post("/", createClient(deps));
  routes.get("/:clientId", getClient(deps));
  routes.patch("/:clientId", updateClient(deps));
  routes.delete("/:clientId", deleteClient(deps));
  routes.get("/:clientId/websites", listClientWebsites(deps));
  routes.post("/:clientId/websites", assignClientWebsite(deps));
  routes.delete("/:clientId/websites/:websiteId", unassignClientWebsite(deps));
  routes.get("/:clientId/analytics", getClientAnalytics(deps));
  return routes;
}

/** An owner's websites for the management API — owner-only, no auth of its own. */
export function createOwnedWebsiteRoutes(deps: OwnedWebsiteControllerDeps) {
  const routes = new Hono<{ Variables: AuthVars }>();
  routes.get("/", listOwnedWebsites(deps));
  routes.post("/", createOwnedWebsite(deps));
  routes.get("/:websiteId", getOwnedWebsite(deps));
  routes.get("/:websiteId/snippet", getOwnedWebsiteSnippet(deps));
  routes.patch("/:websiteId", updateOwnedWebsite(deps));
  routes.delete("/:websiteId", deleteOwnedWebsite(deps));
  return routes;
}

/** `/user/agency/clients`, for the signed-in dashboard. */
export function createAgencyRoutes(clientRoutes: Hono<{ Variables: AuthVars }>) {
  const routes = new Hono<{ Variables: AuthVars }>();
  routes.use("/clients/*", authMiddleware);
  routes.use("/clients", authMiddleware);
  routes.route("/clients", clientRoutes);
  return routes;
}

export function createWebsiteRoutes(deps: WebsiteControllerDeps) {
  const routes = new Hono<{ Variables: AuthVars }>();
  routes.use("*", authMiddleware);
  routes.get("/", listWebsites(deps));
  routes.post("/", createWebsite(deps));
  routes.get("/:id", getWebsite(deps));
  routes.put("/:id", updateWebsite(deps));
  routes.delete("/:id", deleteWebsite(deps));
  routes.post("/:id/share", updateWebsiteSharing(deps));
  routes.get("/:id/goals", listWebsiteGoals(deps));
  routes.post("/:id/goals", createWebsiteGoal(deps));
  routes.patch("/:id/goals/:goal_id", updateWebsiteGoal(deps));
  routes.delete("/:id/goals/:goal_id", deleteWebsiteGoal(deps));
  routes.get("/:id/my-role", getWebsiteRole(deps));
  routes.get("/:id/members", listWebsiteMembers(deps));
  routes.post("/:id/members", addWebsiteMember(deps));
  routes.delete("/:id/members/:user_id", removeWebsiteMember(deps));
  routes.put("/:id/members/:user_id/role", updateWebsiteMemberRole(deps));
  routes.get("/:id/invitations", listWebsiteInvitations(deps));
  routes.post("/:id/invitations", createWebsiteInvitation(deps));
  routes.delete("/:id/invitations/:invitation_id", revokeWebsiteInvitation(deps));
  routes.get("/:websiteId/privacy", getWebsitePrivacy(deps));
  routes.put("/:websiteId/privacy", updateWebsitePrivacy(deps));
  return routes;
}
