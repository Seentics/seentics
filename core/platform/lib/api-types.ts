/**
 * HTTP / JSON request and query shapes (routes + services).
 * Domain ingest types (TrackerEvent, etc.) stay in `./types`.
 */

import type { HeatmapIngestEvent, TrackerEvent } from "./types";

/** Service layer — validated register/login inputs. */
export type RegisterUserInput = {
  email: string;
  password: string;
  name: string;
};

export type LoginUserInput = {
  email: string;
  password: string;
};

/** Analytics GET query helpers. */
export type AnalyticsQueryParams = {
  days: string | undefined;
  timezone: string | undefined;
  limit: string | undefined;
};

/** Internal POST /internal/collect/analytics */
export type InternalCollectAnalyticsBody = {
  website_id?: string;
  events?: unknown[];
};

/** Internal POST /internal/collect/replay-events */
export type InternalCollectReplayEventsBody = {
  events?: TrackerEvent[];
};

/** Internal POST /internal/collect/heatmap-events */
export type InternalCollectHeatmapEventsBody = {
  events?: HeatmapIngestEvent[];
};

/** Tracker POST /tracker/collect */
export type TrackerCollectBody = {
  website_id?: string;
  domain?: string;
  ua?: string;
  events?: unknown[];
  session?: unknown[];
  heatmaps?: unknown[];
  heatmap_screenshot?: unknown[];
  heatmap_dom_snapshot?: unknown[];
  funnels?: unknown[];
  automations?: unknown[];
};

export type CreateGoalBody = {
  name: string;
  type: string;
  identifier: string;
  selector?: string;
};

export type UpdateGoalPatch = Partial<{
  name: string;
  type: string;
  identifier: string;
  selector: string | null;
}>;

export type AddWebsiteMemberBody = {
  email: string;
  role?: string;
};

