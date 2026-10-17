import { Hono } from "hono";
import type { AppConfig } from "../../config";
import { notFound } from "./lib/envelope";
import { gatewayContext, type AgencyVars } from "./lib/gateway-context";
import type { AgencyControllerDeps } from "./controllers/agency-controller.types";
import { dismissAlert, getOverview, getSetup } from "./controllers/overview.controller";
import {
  archiveClient,
  createClient,
  createClientWebsite,
  deleteClient,
  getClient,
  getClientFeatures,
  listClients,
  listClientWebsites,
  putClientFeatures,
  updateClient,
} from "./controllers/clients.controller";
import {
  createWebsite,
  deleteWebsite,
  getInstall,
  getWebsite,
  listWebsites,
  updateWebsite,
  verifyWebsite,
} from "./controllers/websites.controller";
import { getBranding, putBranding } from "./controllers/branding.controller";
import { createEmbed, deleteEmbed, listEmbeds, updateEmbed } from "./controllers/embeds.controller";

/**
 * The agency workspace's API, mounted at `/api/v1/agency`. Every route sits behind
 * `gatewayContext`: the gateway's key, and the agency it names in `X-Agency-Owner`. The
 * per-route comments live with each controller.
 */
export function createAgencyRoutes(deps: AgencyControllerDeps & { config?: () => Pick<AppConfig, "globalApiKey"> }) {
  const routes = new Hono<{ Variables: AgencyVars }>();
  routes.use("*", gatewayContext(deps.config));

  routes.get("/overview", getOverview(deps));
  routes.post("/alerts/:id/dismiss", dismissAlert(deps));
  routes.get("/setup", getSetup(deps));

  routes.get("/clients", listClients(deps));
  routes.post("/clients", createClient(deps));
  routes.get("/clients/:id", getClient(deps));
  routes.patch("/clients/:id", updateClient(deps));
  routes.delete("/clients/:id", deleteClient(deps));
  routes.post("/clients/:id/archive", archiveClient(deps, "archived"));
  routes.post("/clients/:id/unarchive", archiveClient(deps, "active"));
  routes.get("/clients/:id/websites", listClientWebsites(deps));
  routes.post("/clients/:id/websites", createClientWebsite(deps));
  routes.get("/clients/:id/features", getClientFeatures(deps));
  routes.put("/clients/:id/features", putClientFeatures(deps));

  routes.get("/websites", listWebsites(deps));
  routes.post("/websites", createWebsite(deps));
  routes.get("/websites/:id", getWebsite(deps));
  routes.patch("/websites/:id", updateWebsite(deps));
  routes.delete("/websites/:id", deleteWebsite(deps));
  routes.get("/websites/:id/install", getInstall(deps));
  routes.post("/websites/:id/verify", verifyWebsite(deps));

  routes.get("/branding", getBranding(deps));
  routes.put("/branding", putBranding(deps));

  routes.get("/embeds", listEmbeds(deps));
  routes.post("/embeds", createEmbed(deps));
  routes.patch("/embeds/:id", updateEmbed(deps));
  routes.delete("/embeds/:id", deleteEmbed(deps));

  // Unknown paths answer in the same envelope as everything else here.
  routes.notFound((c) => notFound(c, "Route"));
  return routes;
}
