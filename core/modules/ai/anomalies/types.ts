/**
 * Anomaly alerts: what the hourly check found, as it is stored and shown.
 *
 * Detection is deterministic (detect.ts): numbers against a seasonal baseline, with
 * minimum volumes so a small site's noise never pages anyone. A model, when configured,
 * only adds one sentence of likely cause (explain.ts).
 */

export const ANOMALY_TYPES = ["traffic_drop", "traffic_spike", "tracking_outage", "error_surge", "conversion_drop"] as const;
export type AnomalyType = (typeof ANOMALY_TYPES)[number];

export const SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SENSITIVITIES = ["low", "normal", "high"] as const;
export type Sensitivity = (typeof SENSITIVITIES)[number];

export type AnomalyMetric = "pageviews" | "visitors" | "errors" | "conversions";

export const severityRank = (s: Severity): number => SEVERITIES.indexOf(s);

/** A half-open time window, `[start, end)`. */
export type Window = { start: Date; end: Date };

/** The robust summary of the baseline windows. */
export type Baseline = {
  /** Each baseline window's value, oldest last. */
  values: number[];
  median: number;
  /** Median absolute deviation. */
  mad: number;
  /** The spread a deviation is measured in: never below Poisson noise or a tenth of the median. */
  scale: number;
};

/**
 * One check's verdict for one subject.
 *
 *  - `anomalous`    — open an anomaly (or keep one open)
 *  - `normal`       — back inside the band: an open one resolves ("back to normal")
 *  - `elevated`     — past the resolve band but short of alerting: an open one stays open, nothing new opens
 *  - `insufficient` — too little volume to judge either way: nothing changes
 */
export type Verdict = "anomalous" | "normal" | "elevated" | "insufficient";

/** A finding from detect.ts, before it is stored. */
export type Detection = {
  type: AnomalyType;
  /** What within the site: `''` for site-wide, the error fingerprint, the goal id. Part of the dedupe key. */
  subject: string;
  verdict: Verdict;
  severity: Severity;
  metric: AnomalyMetric;
  observed: number;
  expected: number;
  /** Robust z-score: (observed − median) / scale. */
  score: number;
  window: Window;
  /** Deterministic one-liners: the title and the sentence under it. */
  title: string;
  summary: string;
  /** A dashboard path suffix under `/websites/:id/`. */
  path: string;
  /** Facts kept with the anomaly: the baseline, the subject's label. Counts and labels only. */
  facts: Record<string, string | number | number[] | null>;
};

export type AnomalyStatus = "open" | "resolved";
/** Why it closed: the numbers recovered, it went stale, or alerts were turned off. */
export type Resolution = "recovered" | "expired" | "disabled";

export type StoredAnomaly = {
  id: string;
  websiteId: string;
  type: AnomalyType;
  subject: string;
  status: AnomalyStatus;
  severity: Severity;
  metric: AnomalyMetric;
  observed: number;
  expected: number;
  score: number;
  windowStart: string;
  windowEnd: string;
  title: string;
  summary: string;
  explanation: string | null;
  explanationSource: "ai" | "rules" | null;
  path: string;
  facts: Record<string, unknown>;
  detectedAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  resolution: Resolution | null;
  notifiedAt: string | null;
  notifyStatus: string | null;
  resolvedNotifiedAt: string | null;
};

export type AlertSettings = { enabled: boolean; sensitivity: Sensitivity };
export const DEFAULT_ALERT_SETTINGS: AlertSettings = { enabled: true, sensitivity: "normal" };
