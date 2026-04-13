/**
 * HTTP / JSON request and query shapes (routes + services).
 * Domain ingest types (TrackerEvent, etc.) stay in `./types`.
 */

import type { HeatmapIngestEvent, TrackerEvent } from "./types";

/** Parsed auth JSON bodies (optional fields until validated). */
export type AuthRegisterJson = {
  email?: string;
  password?: string;
  name?: string;
};

export type AuthLoginJson = {
  email?: string;
  password?: string;
};

export type AuthRefreshJson = {
  refresh_token?: string;
};

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
  events?: unknown[];
  session?: unknown[];
  heatmaps?: unknown[];
  heatmap_screenshot?: unknown[];
  funnels?: unknown[];
  automations?: unknown[];
};

/** Websites service */
export type CreateWebsiteBody = {
  name: string;
  url: string;
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

/** Automations service */
export type CreateAutomationBody = {
  name: string;
  definition: Record<string, unknown>;
  is_active?: boolean;
};

export type AutomationUpdatePatch = Partial<{
  name: string;
  definition: Record<string, unknown>;
  is_active: boolean;
}>;

/** Funnels service */
export type CreateFunnelBody = {
  name: string;
  description?: string;
  steps?: Record<string, unknown>[];
  is_active?: boolean;
};

export type FunnelUpdatePatch = Partial<{
  name: string;
  description: string;
  is_active: boolean;
  steps: Record<string, unknown>[];
}>;
