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
  heatmapLayoutEnabled?: boolean;
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

/**
 * One aggregated heatmap cell, as the dashboard and the raw API receive it.
 *
 * **`x_percent` and `y_percent` are not percentages, and their scale depends on
 * `event_type`.** Both are integers in the same two columns, written by
 * `eventsToPoints`:
 *
 * | `event_type` | `x_percent`        | `y_percent`            | divide by |
 * |--------------|--------------------|------------------------|-----------|
 * | `click`      | `nx × 10000`, 0–10000 | `ny × 10000`, 0–10000 | 10000     |
 * | `scroll`     | always `0`         | `depth × 100`, 0–100   | 100       |
 *
 * A click at the centre of the page is `5000`, not `50`. The names predate the
 * resolution increase — clicks were stored as whole percents once, and rendering a
 * heatmap at 1% granularity visibly banded, so the multiplier went to 10000 while the
 * column names stayed. Scroll depth never needed the extra resolution and was left
 * alone, which is where the split comes from.
 *
 * The dashboard divides correctly (`heatmaps/[slug]/page.tsx`). Anyone else consuming
 * this — including the raw public API, which returns these values unchanged — has to
 * apply the table above. Renaming the fields would say what they mean, but they are a
 * published wire contract, so that is a versioned change rather than a fix.
 */
export type HeatmapPointOut = {
  page_path: string;
  event_type: string;
  /** Scaled — see the note above. `0` for every scroll row. */
  x_percent: number;
  /** Scaled — see the note above. Divide by 10000 for clicks, 100 for scroll. */
  y_percent: number;
  device_type: string;
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
  websiteId: string;
  heatmapLayoutEnabled: boolean;
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
  websiteId: string;
  automationId: string;
  occurredAt: Date;
  detail: Record<string, unknown>;
};
