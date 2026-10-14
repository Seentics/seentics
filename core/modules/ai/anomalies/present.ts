import type { DigestSite } from "../digest/builder";
import { MAX_DIGEST_RECIPIENTS } from "../digest/builder";
import type { StoredAnomaly } from "./types";

/**
 * How an anomaly leaves core: as the dashboard's alert (`GET /ai/alerts/:website_id`) and as the
 * gateway notice that mails it.
 *
 * The notice is a contract with the gateway's `POST /internal/notify` (`anomaly_alert`, zod in
 * gateway/controllers/notify.ts): preformatted strings the gateway renders as given. Change it
 * there first.
 */

export type AlertView = {
  id: string;
  type: StoredAnomaly["type"];
  severity: StoredAnomaly["severity"];
  status: StoredAnomaly["status"];
  title: string;
  summary: string;
  explanation: string | null;
  explanationSource: "ai" | "rules" | null;
  metric: StoredAnomaly["metric"];
  observed: number;
  expected: number;
  changePct: number | null;
  windowStart: string;
  windowEnd: string;
  detectedAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  path: string;
  askPrompt: string;
};

export type AnomalyAlertNotice = {
  kind: "anomaly_alert";
  websiteId: string;
  websiteName: string;
  websiteDomain: string;
  userIds: string[];
  anomalyId: string;
  state: "open" | "resolved";
  type: StoredAnomaly["type"];
  severity: StoredAnomaly["severity"];
  title: string;
  summary: string;
  /** `null`, never `''`: the gateway refuses an empty one. */
  explanation: string | null;
  metrics: Array<{ label: string; value: string; change: string | null }>;
  windowStart: string;
  windowEnd: string;
  /** Lowercase segments of `[a-z0-9-]`, or `''`: the gateway checks it. */
  path: string;
};

const count = (n: number) => Math.round(n).toLocaleString("en-US");
const clip = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`);
const hhmm = (iso: string) => iso.slice(11, 16);
const SAFE_PATH = /^(?:[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*)?$/;

export function changePct(observed: number, expected: number): number | null {
  if (!(expected > 0)) return null;
  return Math.round(((observed - expected) / expected) * 100);
}

const signed = (pct: number | null) => (pct === null ? null : pct > 0 ? `+${pct}%` : `${pct}%`);

/** `between 11:00 and 14:00 UTC on Oct 14` — the window as a question reads it. */
function windowPhrase(a: Pick<StoredAnomaly, "windowStart" | "windowEnd">): string {
  const day = new Date(a.windowStart).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const hours = Math.round((Date.parse(a.windowEnd) - Date.parse(a.windowStart)) / 3_600_000);
  if (hours >= 24) return `on ${day} (UTC)`;
  return `between ${hhmm(a.windowStart)} and ${hhmm(a.windowEnd)} UTC on ${day}`;
}

/** The question "Ask AI why" types into the assistant: answerable with its tools, not "explain this". */
export function askPromptFor(a: StoredAnomaly): string {
  const when = windowPhrase(a);
  const metric = a.metric;
  switch (a.type) {
    case "traffic_drop":
      return `Why did ${metric} drop ${when} compared with the same time in previous weeks? Compare sources, pages and devices.`;
    case "traffic_spike":
      return `What caused the jump in ${metric} ${when}? Which sources and pages did the extra traffic come from, and is it real visitors?`;
    case "tracking_outage":
      return `My site recorded almost no pageviews ${when}. Is tracking broken? Which pages stopped sending data, and when did the last events arrive?`;
    case "error_surge": {
      const message = typeof a.facts.message === "string" ? a.facts.message : "this error";
      return clip(`Why is the error "${message}" happening so often ${when}? Which pages, browsers and sessions does it affect?`, 480);
    }
    case "conversion_drop": {
      const goal = typeof a.facts.goal === "string" ? a.facts.goal : "my";
      return clip(`Why did completions of the "${goal}" goal drop ${when} compared with previous weeks? Compare traffic, sources and pages.`, 480);
    }
  }
}

export function presentAlert(a: StoredAnomaly): AlertView {
  return {
    id: a.id,
    type: a.type,
    severity: a.severity,
    status: a.status,
    title: a.title,
    summary: a.summary,
    explanation: a.explanation,
    explanationSource: a.explanationSource,
    metric: a.metric,
    observed: a.observed,
    expected: a.expected,
    changePct: changePct(a.observed, a.expected),
    windowStart: a.windowStart,
    windowEnd: a.windowEnd,
    detectedAt: a.detectedAt,
    lastSeenAt: a.lastSeenAt,
    resolvedAt: a.resolvedAt,
    path: SAFE_PATH.test(a.path) ? a.path : "",
    askPrompt: askPromptFor(a),
  };
}

const METRIC_LABEL: Record<StoredAnomaly["metric"], string> = {
  pageviews: "Pageviews",
  visitors: "Visitors",
  errors: "Occurrences",
  conversions: "Completions",
};

/** The email for one anomaly opening or recovering, or `null` when there is nobody to send it to. */
export function buildAlertNotice(a: StoredAnomaly, site: DigestSite, state: "open" | "resolved"): AnomalyAlertNotice | null {
  const userIds = [...new Set(site.userIds.filter(Boolean))].slice(0, MAX_DIGEST_RECIPIENTS);
  if (!userIds.length) return null;
  const metrics: AnomalyAlertNotice["metrics"] = [
    { label: METRIC_LABEL[a.metric], value: count(a.observed), change: signed(changePct(a.observed, a.expected)) },
    { label: "Usual for this time", value: count(a.expected), change: null },
  ];
  if (a.type === "error_surge" && typeof a.facts.sessions === "number") {
    metrics.push({ label: "Sessions affected", value: count(a.facts.sessions), change: null });
  }
  const explanation = a.explanation?.trim() ? clip(a.explanation.trim(), 400) : null;
  return {
    kind: "anomaly_alert",
    websiteId: site.id,
    websiteName: clip(site.name || site.domain || "Your website", 200),
    websiteDomain: clip(site.domain || site.name || "website", 253),
    userIds,
    anomalyId: a.id,
    state,
    type: a.type,
    severity: a.severity,
    title: clip(a.title, 200),
    summary: clip(a.summary, 600),
    explanation,
    metrics,
    windowStart: a.windowStart,
    windowEnd: a.windowEnd,
    path: SAFE_PATH.test(a.path) ? a.path : "",
  };
}
