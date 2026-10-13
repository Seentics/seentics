import { Hono } from "hono";
import { submitLead, type LeadSubmitDeps } from "./controllers/lead-submit.controller";

/** The anonymous side of the module: one endpoint, mounted at `/api/v1/tracker/leads`. */
export function createLeadTrackerRoutes(deps: LeadSubmitDeps) {
  const routes = new Hono();
  routes.post("/", submitLead(deps));
  return routes;
}
