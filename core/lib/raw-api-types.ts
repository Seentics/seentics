/**
 * Stable shapes for machine clients (`/api/v1/raw/*`).
 * Version in path allows future `v2` without breaking existing integrations.
 */

export type RawApiErrorBody = {
  error: string;
  code: "missing_api_key" | "invalid_api_key" | "not_found" | "bad_request" | "internal";
};

export type RawMeta = {
  website_id: string;
  /** Public site id string used in tracker */
  site_id: string;
};

export type RawAnalyticsDashboardResponse = {
  meta: RawMeta;
  data: unknown;
};

export type RawAnalyticsEventRow = {
  id: string;
  event_type: string;
  page: string | null;
  visitor_id: string | null;
  session_id: string | null;
  occurred_at: string;
  properties: Record<string, unknown> | null;
};

export type RawAnalyticsEventsResponse = {
  meta: RawMeta & {
    limit: number;
    offset: number;
    returned: number;
  };
  events: RawAnalyticsEventRow[];
};

export type RawSessionRow = {
  session_id: string;
  website_id: string;
  browser: string;
  device: string;
  os: string;
  country: string;
  entry_page: string;
  started_at: string;
  duration_seconds: number;
  pages_viewed: number;
  has_rage_clicks: boolean;
  has_errors: boolean;
};

export type RawSessionsResponse = {
  meta: RawMeta & { limit: number; offset: number };
  sessions: RawSessionRow[];
};

export type RawHeatmapPagesResponse = {
  meta: RawMeta;
  pages: {
    page_path: string;
    click_count: number;
    scroll_count: number;
    avg_scroll: number;
    last_seen: string;
  }[];
};

export type RawHeatmapPointsResponse = {
  meta: RawMeta & { page_path: string; event_type: string };
  points: {
    page_path: string;
    event_type: string;
    device_type: string;
    x_percent: number;
    y_percent: number;
    intensity: number;
    target_selector: string;
    cap_vw: number | null;
    cap_vh: number | null;
  }[];
};
