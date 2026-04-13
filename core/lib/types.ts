export type SessionMetaRow = {
  sessionId: string;
  websiteId: string;
  browser: string;
  device: string;
  os: string;
  country: string;
  entryPage: string;
  startedAt: Date;
  hasRageClicks: boolean;
  hasErrors: boolean;
  durationSeconds: number;
  pagesViewed: number;
};

export type TrackerEvent = {
  type: string;
  data?: Record<string, unknown>;
  ts: number;
  url?: string;
  sid: string;
  vid?: string;
  websiteId: string;
  doc_w?: number;
  doc_h?: number;
};

export type ReplayChunk = {
  sequence: number;
  data: unknown[];
  timestamp: Date;
};

/** Heatmap pipeline ingest row (tracker → heatmap engine). */
export type HeatmapIngestEvent = {
  type: string;
  data?: Record<string, unknown>;
  ts: number;
  url?: string;
  sid?: string;
  vid?: string;
  websiteId: string;
  siteId?: string;
  clientUa?: string;
  docW?: number;
  docH?: number;
};

export type HeatmapPointRow = {
  websiteId: string;
  pagePath: string;
  eventType: string;
  deviceType: string;
  xPercent: number;
  yPercent: number;
  targetSelector: string;
  capVw: number | null;
  capVh: number | null;
};

export type HeatmapPointOut = {
  page_path: string;
  event_type: string;
  device_type: string;
  x_percent: number;
  y_percent: number;
  intensity: number;
  target_selector: string;
  cap_vw?: number | null;
  cap_vh?: number | null;
};

export type PageSummaryRow = {
  page_path: string;
  click_count: number;
  scroll_count: number;
  avg_scroll: number;
  last_seen: Date;
};

export type ScreenshotJob = {
  siteId: string;
  url: string;
  jpeg: Uint8Array;
  docW: number;
  docH: number;
};

/** Normalized page/funnel row for `ingestAnalyticsBatch` / analytics_events. */
export type AnalyticsIngestEvent = {
  type: string;
  data?: Record<string, unknown>;
  ts: number;
  url?: string;
  sid?: string;
  vid?: string;
};
