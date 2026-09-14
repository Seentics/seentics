import type { WebsiteTrackerRow } from "../../websites/interfaces";
import type { AnalyticsIngestMeta } from "../../../platform/http/analytics-ingest-meta";

/** The browser tracker's mixed collect payload before lane routing. */
export type TrackerCollectBody = {
  website_id?: string;
  domain?: string;
  ua?: string;
  events?: unknown[];
  session?: unknown[];
  heatmaps?: unknown[];
  heatmap_screenshot?: unknown[];
  heatmap_dom_snapshot?: unknown[];
  errors?: unknown[];
  funnels?: unknown[];
  automations?: unknown[];
};

/** Normalized event envelope shared with the ingest lane consumers. */
export type TrackerEvent = {
  type: string;
  data?: Record<string, unknown>;
  ts: number;
  url?: string;
  sid: string;
  vid?: string;
  websiteId: string;
  /** Set on collect recordings from the same request UA/geo as analytics. */
  ingestMeta?: AnalyticsIngestMeta;
  doc_w?: number;
  doc_h?: number;
};

export type ProcessTrackerCollectInput = {
  body: TrackerCollectBody;
  website: WebsiteTrackerRow;
  websiteParam: string;
  origin: string;
  headers: Headers;
  clientIp: string;
  diagnosticLog: boolean;
};

export type ProcessTrackerCollectResult =
  | { kind: "empty" }
  | { kind: "privacy-disabled" }
  | { kind: "processed"; queued: number };

export interface TrackerCollectService {
  process(input: ProcessTrackerCollectInput): ProcessTrackerCollectResult;
}
