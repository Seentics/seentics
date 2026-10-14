import type { AuthedRouter } from "../../../platform/http/router";
import type { UsageCounter } from "../../../platform/usage";
import type { FunnelDraftPort, FunnelPerformance, FunnelTrackerConfig } from "./index";

/** Everything the funnels module offers. */
export interface FunnelsModule {
  /**
   * Active funnel definitions for the tracker's `/init`.
   *
   * CRUD stays behind this module's own routes.
   */
  trackerConfig: FunnelTrackerConfig;

  /** Conversion reports, for the AI assistant's funnel tools. Read-only. */
  performance: FunnelPerformance;

  /** Validates and creates funnels approved in the AI assistant. See `FunnelDraftPort`. */
  drafts: FunnelDraftPort;

  /**
   * Two routers, mounted at different prefixes: the public one serves anonymous
   * funnel reads, the authenticated one hangs under `/websites/:id`.
   */
  /** This module's contribution to the per-user usage report. */
  usage: UsageCounter;

  routes: { publicRoutes: AuthedRouter; authRoutes: AuthedRouter };
}
