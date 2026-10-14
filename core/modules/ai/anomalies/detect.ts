import { maskText } from "../insights/privacy";
import type { Baseline, Detection, Sensitivity, Severity, Verdict, Window } from "./types";

/**
 * Anomaly detection: pure functions over counts, so every threshold is testable without a
 * database or a clock.
 *
 * The baseline is seasonal: the same window one, two, three and four weeks earlier, so Tuesday
 * 14:00 is compared with previous Tuesdays at 14:00 rather than with Tuesday 03:00 or Sunday.
 * The summary is robust — median and median absolute deviation — so one odd week (a launch,
 * an outage) in the four does not move it. Four values is a small sample, so the spread a
 * deviation is measured in is floored at Poisson noise (√median) and at a tenth of the median:
 * four near-identical weeks must not make a 12% dip look like a five-sigma event.
 *
 * Every check needs volume before it says anything (`insufficient`), and alerting and resolving
 * use different bands (hysteresis), so a metric hovering at the threshold does not flap.
 */

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
export const BASELINE_WEEKS = 4;
/** Hours in the traffic-drop window: a drop has to last to matter, so it is judged over three. */
export const DROP_HOURS = 3;
/** Hours in the outage window: both must be near zero. */
export const OUTAGE_HOURS = 2;

// ─── Thresholds ─────────────────────────────────────────────────────────────────

export type Thresholds = {
  /** Over the 3-hour window. `minExpected`: usual pageviews (or visitors) before a drop is judged. */
  drop: { minExpected: number; maxRatio: number; z: number; resolveRatio: number };
  /** Over the last hour. A spike needs `minObserved` outright and `minRatio` × the usual (floored at `minExpected`). */
  spike: { minExpected: number; minObserved: number; minRatio: number; z: number; resolveRatio: number };
  /** Per hour: usual pageviews at least `minExpectedPerHour`, and each hour at most `maxShare` of it. */
  outage: { minExpectedPerHour: number; maxShare: number; resolveShare: number };
  /** One error group, in the last hour. */
  errors: { minCount: number; minSessions: number; minRatio: number; z: number; resolveRatio: number };
  /** One goal, over the last whole UTC day. */
  conversions: { minExpected: number; maxRatio: number; z: number; resolveRatio: number };
};

/**
 * `normal` is the default. `low` wants roughly twice the volume and a bigger move; `high` half the
 * volume and a smaller one. All three keep a floor no small site's noise clears.
 */
export const THRESHOLDS: Record<Sensitivity, Thresholds> = {
  low: {
    drop: { minExpected: 120, maxRatio: 0.4, z: -4, resolveRatio: 0.7 },
    spike: { minExpected: 40, minObserved: 300, minRatio: 5, z: 5, resolveRatio: 2 },
    outage: { minExpectedPerHour: 40, maxShare: 0.03, resolveShare: 0.3 },
    errors: { minCount: 50, minSessions: 10, minRatio: 5, z: 5, resolveRatio: 2 },
    conversions: { minExpected: 20, maxRatio: 0.4, z: -4, resolveRatio: 0.7 },
  },
  normal: {
    drop: { minExpected: 60, maxRatio: 0.5, z: -3, resolveRatio: 0.75 },
    spike: { minExpected: 20, minObserved: 150, minRatio: 3, z: 4, resolveRatio: 1.75 },
    outage: { minExpectedPerHour: 20, maxShare: 0.05, resolveShare: 0.3 },
    errors: { minCount: 25, minSessions: 5, minRatio: 3, z: 4, resolveRatio: 1.5 },
    conversions: { minExpected: 10, maxRatio: 0.5, z: -3, resolveRatio: 0.75 },
  },
  high: {
    drop: { minExpected: 30, maxRatio: 0.65, z: -2.5, resolveRatio: 0.8 },
    spike: { minExpected: 10, minObserved: 75, minRatio: 2, z: 3, resolveRatio: 1.5 },
    outage: { minExpectedPerHour: 10, maxShare: 0.1, resolveShare: 0.3 },
    errors: { minCount: 10, minSessions: 3, minRatio: 2, z: 3, resolveRatio: 1.25 },
    conversions: { minExpected: 5, maxRatio: 0.65, z: -2.5, resolveRatio: 0.8 },
  },
};

// ─── Windows ────────────────────────────────────────────────────────────────────

/** The start of the UTC hour `now` falls in: the end of the last complete hour. */
export function hourFloor(now: Date): Date {
  return new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS);
}

/** The last `hours` complete UTC hours before `now`. */
export function lastHours(now: Date, hours: number): Window {
  const end = hourFloor(now);
  return { start: new Date(end.getTime() - hours * HOUR_MS), end };
}

/** Each single hour of `w`, oldest first. */
export function hoursOf(w: Window): Window[] {
  const out: Window[] = [];
  for (let t = w.start.getTime(); t < w.end.getTime(); t += HOUR_MS) out.push({ start: new Date(t), end: new Date(t + HOUR_MS) });
  return out;
}

/** The same window 1…`weeks` weeks earlier, most recent first: the seasonal baseline. */
export function seasonalWindows(w: Window, weeks = BASELINE_WEEKS): Window[] {
  return Array.from({ length: weeks }, (_, i) => {
    const shift = (i + 1) * 7 * DAY_MS;
    return { start: new Date(w.start.getTime() - shift), end: new Date(w.end.getTime() - shift) };
  });
}

/** The last whole UTC day before `now`, as a window. */
export function lastDay(now: Date): Window {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return { start: new Date(end.getTime() - DAY_MS), end };
}

export const dayKey = (d: Date) => d.toISOString().slice(0, 10);

// ─── Robust statistics ──────────────────────────────────────────────────────────

export function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function baseline(values: readonly number[]): Baseline {
  const clean = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const m = median(clean);
  const mad = median(clean.map((v) => Math.abs(v - m)));
  return { values: clean, median: m, mad, scale: Math.max(1.4826 * mad, Math.sqrt(Math.max(m, 1)), 0.1 * m) };
}

export const zScore = (observed: number, b: Baseline) => (observed - b.median) / b.scale;

const round1 = (n: number) => Math.round(n * 10) / 10;

// ─── Wording ────────────────────────────────────────────────────────────────────

const count = (n: number) => Math.round(n).toLocaleString("en-US");
const hhmm = (d: Date) => d.toISOString().slice(11, 16);
const weekday = (d: Date) => d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
const dateLabel = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
/** `between 11:00 and 14:00 UTC` / `in the hour to 14:00 UTC`. */
function span(w: Window): string {
  const hours = Math.round((w.end.getTime() - w.start.getTime()) / HOUR_MS);
  return hours === 1 ? `in the hour to ${hhmm(w.end)} UTC` : `between ${hhmm(w.start)} and ${hhmm(w.end)} UTC`;
}
const pctDown = (observed: number, expected: number) => Math.round((1 - observed / expected) * 100);
const times = (observed: number, expected: number) => `${round1(observed / Math.max(expected, 1))}×`;

// ─── Checks ─────────────────────────────────────────────────────────────────────

export type TrafficSeries = { observed: number; baseline: number[] };

type Judged = { verdict: Verdict; score: number; ratio: number; b: Baseline };

/** A fall against the baseline: too little volume, normal, elevated or anomalous. */
function judgeDrop(observed: number, values: number[], t: { minExpected: number; maxRatio: number; z: number; resolveRatio: number }): Judged {
  const b = baseline(values);
  const score = zScore(observed, b);
  const ratio = b.median > 0 ? observed / b.median : 1;
  if (b.median < t.minExpected) return { verdict: "insufficient", score, ratio, b };
  if (ratio <= t.maxRatio && score <= t.z) return { verdict: "anomalous", score, ratio, b };
  if (ratio >= t.resolveRatio || score > t.z / 2) return { verdict: "normal", score, ratio, b };
  return { verdict: "elevated", score, ratio, b };
}

/** Combines the pageview and visitor verdicts: the stronger signal names the metric. */
function strongest(a: Judged & { metric: "pageviews" | "visitors"; observed: number }, b: Judged & { metric: "pageviews" | "visitors"; observed: number }, dir: 1 | -1) {
  const verdict: Verdict =
    a.verdict === "anomalous" || b.verdict === "anomalous" ? "anomalous"
    : a.verdict === "insufficient" && b.verdict === "insufficient" ? "insufficient"
    : (a.verdict === "normal" || a.verdict === "insufficient") && (b.verdict === "normal" || b.verdict === "insufficient") ? "normal"
    : "elevated";
  const candidates = [a, b].filter((x) => x.verdict !== "insufficient");
  const pool = verdict === "anomalous" ? candidates.filter((x) => x.verdict === "anomalous") : candidates.length ? candidates : [a, b];
  // Visitors first on a tie: a visitor is a person, a pageview can be a bot reloading.
  const pick = pool.reduce((best, x) => (dir * x.score > dir * best.score ? x : best), pool.find((x) => x.metric === "visitors") ?? pool[0]!);
  return { verdict, pick };
}

/**
 * Traffic drop: the last three hours' pageviews and visitors against the same three hours of
 * the four previous weeks. Judged on whichever fell harder; visitors on a tie.
 */
export function detectTrafficDrop(input: { window: Window; pageviews: TrafficSeries; visitors: TrafficSeries; sensitivity: Sensitivity }): Detection {
  const t = THRESHOLDS[input.sensitivity].drop;
  const pv = { ...judgeDrop(input.pageviews.observed, input.pageviews.baseline, t), metric: "pageviews" as const, observed: input.pageviews.observed };
  // Visitors run at a fraction of pageviews: their volume floor is half.
  const uv = { ...judgeDrop(input.visitors.observed, input.visitors.baseline, { ...t, minExpected: t.minExpected / 2 }), metric: "visitors" as const, observed: input.visitors.observed };
  const { verdict, pick } = strongest(pv, uv, -1);
  const down = Math.max(0, pick.b.median > 0 ? pctDown(pick.observed, pick.b.median) : 0);
  const severity: Severity = down >= 80 ? "high" : down >= 65 ? "medium" : "low";
  return {
    type: "traffic_drop",
    subject: "",
    verdict,
    severity,
    metric: pick.metric,
    observed: pick.observed,
    expected: pick.b.median,
    score: round1(pick.score),
    window: input.window,
    title: `${pick.metric === "visitors" ? "Visitors" : "Pageviews"} down ${down}% from usual`,
    summary: `${count(pick.observed)} ${pick.metric} ${span(input.window)}, against about ${count(pick.b.median)} on a usual ${weekday(input.window.start)} at this time.`,
    path: "",
    facts: { baseline: pick.b.values, pageviews: input.pageviews.observed, visitors: input.visitors.observed, usualPageviews: pv.b.median, usualVisitors: uv.b.median },
  };
}

function judgeSpike(observed: number, values: number[], t: Thresholds["spike"]): Judged {
  const b = baseline(values);
  const score = zScore(observed, b);
  // Floored, so a site that usually gets 2 pageviews an hour needs a real crowd, not 7, to spike.
  const reference = Math.max(b.median, t.minExpected);
  const ratio = observed / reference;
  if (observed <= t.resolveRatio * reference) return { verdict: "normal", score, ratio, b };
  if (observed < t.minObserved) return { verdict: "insufficient", score, ratio, b };
  if (ratio >= t.minRatio && score >= t.z) return { verdict: "anomalous", score, ratio, b };
  return { verdict: "elevated", score, ratio, b };
}

/** Traffic spike: the last hour against the same hour of the four previous weeks. */
export function detectTrafficSpike(input: { window: Window; pageviews: TrafficSeries; visitors: TrafficSeries; sensitivity: Sensitivity }): Detection {
  const t = THRESHOLDS[input.sensitivity].spike;
  const pv = { ...judgeSpike(input.pageviews.observed, input.pageviews.baseline, t), metric: "pageviews" as const, observed: input.pageviews.observed };
  const uv = {
    ...judgeSpike(input.visitors.observed, input.visitors.baseline, { ...t, minExpected: t.minExpected / 2, minObserved: t.minObserved / 2 }),
    metric: "visitors" as const,
    observed: input.visitors.observed,
  };
  const { verdict, pick } = strongest(pv, uv, 1);
  const severity: Severity = pick.ratio >= 10 ? "high" : pick.ratio >= 5 ? "medium" : "low";
  return {
    type: "traffic_spike",
    subject: "",
    verdict,
    severity,
    metric: pick.metric,
    observed: pick.observed,
    expected: pick.b.median,
    score: round1(pick.score),
    window: input.window,
    title: `${pick.metric === "visitors" ? "Visitors" : "Pageviews"} up ${times(pick.observed, pick.b.median)} on usual`,
    summary: `${count(pick.observed)} ${pick.metric} ${span(input.window)}, against about ${count(pick.b.median)} on a usual ${weekday(input.window.start)} at this time.`,
    path: "",
    facts: { baseline: pick.b.values, pageviews: input.pageviews.observed, visitors: input.visitors.observed, usualPageviews: pv.b.median, usualVisitors: uv.b.median },
  };
}

/**
 * Tracking outage: pageviews near zero in each of the last two hours, when those hours usually
 * have plenty. The most urgent alert there is — every other number on the dashboard is wrong
 * while it lasts — so it is always `critical`, and it resolves as soon as the latest hour has a
 * fair share of its usual traffic again, whatever the volume.
 *
 * `hours` oldest first, each with its own baseline.
 */
export function detectOutage(input: { hours: Array<{ window: Window; observed: number; baseline: number[] }>; sensitivity: Sensitivity }): Detection {
  const t = THRESHOLDS[input.sensitivity].outage;
  const judged = input.hours.map((h) => ({ ...h, b: baseline(h.baseline) }));
  const latest = judged[judged.length - 1]!;
  const observed = judged.reduce((s, h) => s + h.observed, 0);
  const expected = judged.reduce((s, h) => s + h.b.median, 0);
  const window: Window = { start: judged[0]!.window.start, end: latest.window.end };

  let verdict: Verdict;
  if (latest.observed >= Math.max(1, t.resolveShare * latest.b.median)) verdict = "normal";
  else if (judged.some((h) => h.b.median < t.minExpectedPerHour)) verdict = "insufficient";
  else if (judged.every((h) => h.observed <= t.maxShare * h.b.median)) verdict = "anomalous";
  else verdict = "elevated";

  const hours = judged.length;
  return {
    type: "tracking_outage",
    subject: "",
    verdict,
    severity: "critical",
    metric: "pageviews",
    observed,
    expected,
    score: round1(zScore(observed, baseline(judged.map(() => expected)))),
    window,
    title: observed === 0 ? `Tracking may be down: no pageviews for ${hours} hours` : `Tracking may be down: almost no pageviews for ${hours} hours`,
    summary: `${count(observed)} pageviews ${span(window)}, when this site usually gets about ${count(expected)}. Check that the tracking script is still on your pages.`,
    path: "settings/tracking",
    facts: { perHour: judged.map((h) => h.observed), usualPerHour: judged.map((h) => h.b.median) },
  };
}

export type ErrorSeries = {
  fingerprint: string;
  message: string;
  pagePath: string;
  /** When the group was first seen, ISO. */
  firstSeen: string;
  observed: number;
  /** Sessions that hit it in the window. */
  sessions: number;
  baseline: number[];
};

/**
 * Error surge: one error group's occurrences in the last hour against the same hour of the
 * previous four weeks. A group that is new (no baseline at all) only has to clear the volume
 * floors; a growing one also has to be `minRatio` × its usual.
 */
export function detectErrorSurge(input: { window: Window; series: ErrorSeries; sensitivity: Sensitivity; now: Date }): Detection {
  const t = THRESHOLDS[input.sensitivity].errors;
  const s = input.series;
  const b = baseline(s.baseline);
  const score = zScore(s.observed, b);
  const isNew = b.values.every((v) => v === 0) && input.now.getTime() - new Date(s.firstSeen).getTime() <= 7 * DAY_MS;
  const reference = Math.max(b.median, 1);

  let verdict: Verdict;
  if (s.observed <= Math.max(t.resolveRatio * b.median, t.minCount / 2)) verdict = "normal";
  else if (s.observed < t.minCount || s.sessions < t.minSessions) verdict = "insufficient";
  else if (isNew || (s.observed >= t.minRatio * reference && score >= t.z)) verdict = "anomalous";
  else verdict = "elevated";

  const severity: Severity = s.sessions >= 100 || (isNew && s.sessions >= 20) ? "high" : s.sessions >= 20 ? "medium" : "low";
  const message = maskText(s.message, 90) || "Unknown error";
  return {
    type: "error_surge",
    subject: s.fingerprint,
    verdict,
    severity,
    metric: "errors",
    observed: s.observed,
    expected: b.median,
    score: round1(score),
    window: input.window,
    title: isNew ? `New error: ${message}` : `Error surge: ${message}`,
    summary: isNew
      ? `${count(s.observed)} occurrences across ${count(s.sessions)} sessions ${span(input.window)}; this error was not seen at this time in the previous weeks.`
      : `${count(s.observed)} occurrences across ${count(s.sessions)} sessions ${span(input.window)}, against about ${count(b.median)} on a usual ${weekday(input.window.start)} at this time.`,
    path: "errors",
    facts: { baseline: b.values, sessions: s.sessions, isNew: isNew ? 1 : 0, page: s.pagePath ? s.pagePath.slice(0, 200) : null, message },
  };
}

export type GoalSeries = { goalId: string; name: string; observed: number; baseline: number[] };

/** Conversion drop: one goal's completions over the last whole UTC day against the same weekday of the four weeks before. */
export function detectConversionDrop(input: { window: Window; series: GoalSeries; sensitivity: Sensitivity }): Detection {
  const t = THRESHOLDS[input.sensitivity].conversions;
  const s = input.series;
  const j = judgeDrop(s.observed, s.baseline, t);
  const down = Math.max(0, j.b.median > 0 ? pctDown(s.observed, j.b.median) : 0);
  const severity: Severity = down >= 75 ? "high" : down >= 60 ? "medium" : "low";
  const name = maskText(s.name, 60) || "Goal";
  return {
    type: "conversion_drop",
    subject: s.goalId,
    verdict: j.verdict,
    severity,
    metric: "conversions",
    observed: s.observed,
    expected: j.b.median,
    score: round1(j.score),
    window: input.window,
    title: `"${name}" conversions down ${down}% from usual`,
    summary: `${count(s.observed)} completions of "${name}" on ${dateLabel(input.window.start)} (UTC), against about ${count(j.b.median)} on a usual ${weekday(input.window.start)}.`,
    path: "goals",
    facts: { baseline: j.b.values, goal: name },
  };
}
