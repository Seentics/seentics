import type { AlertSettings, Detection, Resolution, StoredAnomaly } from "./types";

/** What the explanation cost, when a model wrote it. */
export type ExplanationRecord = {
  text: string | null;
  source: "ai" | "rules" | null;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

/** Storage for anomalies and per-site alert settings. The Postgres one is the only file here that touches `db`. */
export interface AnomalyRepository {
  /** Every site's settings among `websiteIds`; a site without a row gets the defaults. */
  getSettings(websiteIds: readonly string[]): Promise<Map<string, AlertSettings>>;
  saveSettings(websiteId: string, settings: AlertSettings, userId: string): Promise<AlertSettings>;

  /** The site's open anomalies. */
  listOpen(websiteId: string): Promise<StoredAnomaly[]>;
  /** Newest first: open ones, and resolved ones detected since `since`. */
  list(websiteId: string, opts: { status: "open" | "all"; since: Date; limit: number }): Promise<StoredAnomaly[]>;

  /** Opens an anomaly; `null` when one is already open for the same site, type and subject. */
  open(websiteId: string, d: Detection, now: Date): Promise<StoredAnomaly | null>;
  /** Still going: the latest figures and wording, `last_seen_at`, and the higher of the two severities. */
  touch(id: string, d: Detection, now: Date): Promise<void>;
  resolve(id: string, resolution: Resolution, now: Date): Promise<void>;
  setExplanation(id: string, e: ExplanationRecord): Promise<void>;
  /** The email outcome: `sent` with the time, or why it was not sent. */
  markNotified(id: string, status: string, at: Date | null): Promise<void>;
  markResolvedNotified(id: string, at: Date): Promise<void>;

  /** How many of the site's anomalies were mailed since `since`: the per-site daily cap. */
  countNotifiedSince(websiteId: string, since: Date): Promise<number>;
  /** Whether the same incident closed (recovered) since `since`: a reopen that soon is flapping, not news. */
  recentlyRecovered(websiteId: string, type: string, subject: string, since: Date): Promise<boolean>;
  /** Closes every open anomaly not seen since `before`, as `expired`. */
  expireStale(before: Date, now: Date): Promise<number>;
  /** Closes every open anomaly of one site, e.g. when its alerts are turned off. */
  resolveAllOpen(websiteId: string, resolution: Resolution, now: Date): Promise<number>;
}
