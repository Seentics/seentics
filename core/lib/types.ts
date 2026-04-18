import type { AnalyticsIngestMeta } from "./analytics-ingest-meta";

export type SessionMetaRow = {
  sessionId: string;
  websiteId: string;
  browser: string;
  device: string;
  os: string;
  country: string;
  entryPage: string;
  /** From SQL: driver may return `Date` or ISO string. */
  startedAt: Date | string;
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
  /** Set on `/tracker/collect` recordings from the same request UA/geo as analytics. */
  ingestMeta?: AnalyticsIngestMeta;
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
  /** ISO 8601; driver may return timestamps as strings instead of `Date`. */
  last_seen: string;
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
  /** Server-derived from IP / User-Agent for this collect request. */
  ingestMeta?: AnalyticsIngestMeta;
};

/** Batched `automation_trigger` rows → `automation_events` ingest queue. */
export type AutomationTriggerQueued = {
  websiteUuid: string;
  automationId: string;
  occurredAt: Date;
  detail: Record<string, unknown>;
};
