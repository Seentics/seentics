import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { MAX_BODY_BYTES, submitLead, type LeadSubmitDeps } from "./controllers/lead-submit.controller";

/** The anonymous side of the module: one endpoint, mounted at `/api/v1/tracker/leads`. */
export function createLeadTrackerRoutes(deps: LeadSubmitDeps) {
  const routes = new Hono();
  // Before the body is read: the handler's own size check came after `c.req.text()` had
  // buffered whatever an anonymous caller sent, up to the server's 128 MB.
  routes.post("/", bodyLimit({ maxSize: MAX_BODY_BYTES, onError: (c) => c.json({ error: "payload too large" }, 413) }), submitLead(deps));
  return routes;
}
