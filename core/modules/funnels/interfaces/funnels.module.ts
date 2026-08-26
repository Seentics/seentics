import type { AuthedRouter } from "../../../platform/http/router";
import type { UsageCounter } from "../../../platform/usage";
import type { FunnelTrackerConfig } from "./index";

/** Everything the funnels module offers. */
export interface FunnelsModule {
  /**
   * Active funnel definitions for the tracker's `/init`.
   *
   * The only funnels capability another module needs; CRUD and reporting stay behind
   * this module's own routes.
   */
  trackerConfig: FunnelTrackerConfig;

  /**
   * Two routers, mounted at different prefixes: the public one serves anonymous
   * funnel reads, the authenticated one hangs under `/websites/:id`.
   */
  /** This module's contribution to the per-user usage report. */
  usage: UsageCounter;

  routes: { publicRoutes: AuthedRouter; authRoutes: AuthedRouter };
}
