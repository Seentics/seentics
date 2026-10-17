import { Hono } from "hono";
import { evaluateTrackerAutomation } from "./controllers/tracker-automation.controller";
import { collectTracker } from "./controllers/tracker-collect.controller";
import { getTrackerConfig, initTracker } from "./controllers/tracker-config.controller";
import type { TrackerControllerDeps } from "./controllers/tracker-controller.types";
import { requestTrackerScreenshot } from "./controllers/tracker-screenshot.controller";
import { snapshotNeeded } from "./controllers/tracker-snapshot-demand.controller";
import type { ScreenshotRequestLimits } from "./lib/screenshot-request-limits";

export function createTrackerRoutes(
  deps: TrackerControllerDeps,
  /** Overrides for tests; production uses the defaults. */
  options: { screenshotLimits?: ScreenshotRequestLimits } = {},
) {
  const routes = new Hono();

  routes.get("/init/:website_id", initTracker(deps));
  routes.get("/config/:website_id", getTrackerConfig(deps));
  routes.post("/collect", collectTracker(deps));
  routes.post("/request-screenshot", requestTrackerScreenshot(deps, options.screenshotLimits));
  routes.get("/snapshot-needed/:website_id", snapshotNeeded(deps));
  routes.post("/automations/evaluate", evaluateTrackerAutomation(deps));

  return routes;
}
