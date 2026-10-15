/**
 * Frustration signals from one recording's event stream. Deterministic, no model.
 *
 * Input is what object storage holds: tracker envelopes (`{type: "rrweb", ts, url, data}`
 * plus the `session_error` / `network_event` / `console_event` sidecars), or bare rrweb
 * events as in a legacy bundle. One pass rebuilds just enough of the DOM to name click
 * targets (`replay-node-labels.ts`), then each signal is found from what that pass
 * collected:
 *
 * - rage_click   3+ clicks within 1 s inside a 50 px radius (the ingest flag's rule).
 * - dead_click   a click on a link or button followed by nothing at all — no DOM change,
 *                navigation, input, scroll or request — from 150 ms before it to 1 s after.
 *                Only links and buttons: clicking text or a field routinely changes nothing.
 * - error_click  a JavaScript error, or a request that really failed (see isRealRequestFailure), within
 *                1 s after a click.
 * - u_turn       a page left within 10 s for the page the visitor had just come from.
 * - form_abandon 2+ fields of one form typed into, then the page left (or the session
 *                ended) with no submit-like click after the first field, and not within
 *                3 s of the last keystroke (which is what an Enter-to-submit looks like).
 * - scroll_thrash 3+ scroll direction reversals of 200 px or more within 4 s.
 *
 * Times are playback offsets — ms after the first rrweb event — which is what the player's
 * `goto` takes, so a stored signal can seek the replay directly.
 */
import { maskPath, maskText } from "../../../ai/interfaces/privacy";
import type {
  FrustrationSignal,
  FrustrationSignalType,
  SessionTimeline,
  SignalCounts,
} from "../../interfaces";
import { FRUSTRATION_SIGNAL_TYPES } from "../../interfaces";
import { ReplayNodeMirror, type ClickTarget } from "./replay-node-labels";

export const THRESHOLDS = {
  rageWindowMs: 1000,
  rageRadiusPx: 50,
  rageMinClicks: 3,
  /** A response this soon *before* the click still counts: mousedown handlers run first. */
  deadLeadMs: 150,
  deadWindowMs: 1000,
  /** A navigation this soon after a click means the click worked, however slowly. */
  navigationGraceMs: 5000,
  errorWindowMs: 1000,
  /** Dead or error clicks on the same target this close together are one signal. */
  mergeWindowMs: 3000,
  uTurnMaxDwellMs: 10_000,
  formMinFields: 2,
  formEnterSubmitMs: 3000,
  thrashWindowMs: 4000,
  thrashMinReversals: 3,
  thrashMinTravelPx: 200,
} as const;

/** How much one signal of each type adds to the raw score, and how many of each count. */
const WEIGHTS: Record<FrustrationSignalType, { weight: number; cap: number }> = {
  rage_click: { weight: 25, cap: 4 },
  error_click: { weight: 20, cap: 4 },
  form_abandon: { weight: 15, cap: 2 },
  dead_click: { weight: 8, cap: 5 },
  u_turn: { weight: 8, cap: 4 },
  scroll_thrash: { weight: 6, cap: 3 },
};
/** JavaScript errors not tied to a click still say something went wrong. */
const ERROR_WEIGHT = 4;
const ERROR_CAP = 3;

const MAX_SIGNALS = 50;
const MAX_TIMELINE_PAGES = 40;
const MAX_TIMELINE_CLICKS = 40;
const MAX_TIMELINE_ERRORS = 10;

/** Path segments that look like the end of a successful journey. */
const GOAL_PATH = /(thank|success|confirm|complete|receipt|order-received|welcome|congrat)/i;
const SUBMIT_LABEL = /submit|send|sign ?(in|up)|log ?in|register|continue|next|pay|order|checkout|subscribe|save|apply|book|join|get started|request|create/i;

type Raw = Record<string, unknown>;
type RrEvent = { type: number; timestamp: number; data: Raw; url: string };
type Side = { kind: string; ts: number; url: string; data: Raw };

export type FrustrationAnalysis = {
  score: number;
  counts: SignalCounts;
  signals: FrustrationSignal[];
  timeline: SessionTimeline;
  /** rrweb events read; 0 means there was nothing to analyse. */
  rrwebEvents: number;
};

function num(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : NaN;
}

/** Split stored rows into rrweb events and sidecars, each sorted by time. */
export function splitReplayStream(rows: readonly unknown[]): { rr: RrEvent[]; side: Side[] } {
  const rr: RrEvent[] = [];
  const side: Side[] = [];
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const row = item as Raw;
    const url = typeof row.url === "string" ? row.url : "";
    if (row.type === "rrweb" && row.data && typeof row.data === "object") {
      const inner = row.data as Raw;
      const type = num(inner.type);
      let ts = num(inner.timestamp);
      if (!Number.isFinite(ts)) ts = num(row.ts);
      if (!Number.isFinite(type) || !Number.isFinite(ts)) continue;
      rr.push({ type, timestamp: ts, data: (inner.data && typeof inner.data === "object" ? inner.data : {}) as Raw, url });
      continue;
    }
    if (typeof row.type === "string" && Number.isNaN(Number(row.type))) {
      const data = (row.data && typeof row.data === "object" ? row.data : {}) as Raw;
      let ts = row.type === "network_event" ? num(data.startTs) : NaN;
      if (!Number.isFinite(ts)) ts = num(row.ts);
      if (!Number.isFinite(ts)) ts = num(row.timestamp);
      if (!Number.isFinite(ts)) continue;
      side.push({ kind: row.type, ts, url, data });
      continue;
    }
    // A bare rrweb event, as in a legacy bundle or the demo recording.
    const type = num(row.type);
    const ts = num(row.timestamp ?? row.ts);
    if (!Number.isFinite(type) || !Number.isFinite(ts)) continue;
    rr.push({ type, timestamp: ts, data: (row.data && typeof row.data === "object" ? row.data : {}) as Raw, url });
  }
  // Stable sorts: equal timestamps keep stored order, which is the order they happened in.
  rr.sort((a, b) => a.timestamp - b.timestamp);
  side.sort((a, b) => a.ts - b.ts);
  return { rr, side };
}

type Click = {
  atMs: number;
  x: number;
  y: number;
  page: string;
  pageIndex: number;
  target: ClickTarget | null;
  label: string;
};

type Visit = { path: string; atMs: number; endMs: number };

/** First index in sorted `arr` with value >= `x`. */
function lowerBound(arr: number[], x: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid]! < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function anyBetween(sorted: number[], from: number, to: number): boolean {
  const i = lowerBound(sorted, from);
  return i < sorted.length && sorted[i]! <= to;
}

function mutationHasChanges(d: Raw): boolean {
  for (const k of ["adds", "removes", "texts", "attributes"]) {
    const v = d[k];
    if (Array.isArray(v) && v.length) return true;
  }
  return false;
}

/** rrweb incremental sources that are themselves a visible response. */
const RESPONSE_SOURCES = new Set([3, 5, 7, 8, 9, 13]);

function maskLabel(label: string): string {
  return maskText(label, 80);
}

function pathOf(url: string): string {
  return url ? maskPath(url) : "";
}

export function scoreFrom(counts: SignalCounts, errorCount: number): number {
  let raw = 0;
  for (const type of FRUSTRATION_SIGNAL_TYPES) {
    const n = counts[type] ?? 0;
    raw += Math.min(n, WEIGHTS[type].cap) * WEIGHTS[type].weight;
  }
  raw += Math.min(errorCount, ERROR_CAP) * ERROR_WEIGHT;
  // Diminishing returns: one rage cluster is ~46, rage plus an error click ~67, never 100 by count alone.
  return Math.max(0, Math.min(100, Math.round(100 * (1 - Math.exp(-raw / 40)))));
}

export function detectFrustration(rows: readonly unknown[], opts: { truncated?: boolean } = {}): FrustrationAnalysis {
  const { rr, side } = splitReplayStream(rows);
  const t0 = rr.length ? rr[0]!.timestamp : side.length ? side[0]!.ts : 0;
  const rel = (ts: number) => Math.max(0, Math.round(ts - t0));

  const mirror = new ReplayNodeMirror();
  const visits: Visit[] = [];
  const clicks: Click[] = [];
  const responses: number[] = [];
  const scrolls = new Map<number, Array<{ atMs: number; y: number; page: string }>>();
  const inputs: Array<{ atMs: number; id: number; target: ClickTarget | null; pageIndex: number }> = [];
  let metaHref = "";

  const enterPage = (url: string, atMs: number) => {
    const path = pathOf(url);
    if (!path) return;
    const last = visits[visits.length - 1];
    if (last && last.path === path) return;
    visits.push({ path, atMs, endMs: atMs });
  };
  const currentPage = () => visits[visits.length - 1]?.path ?? "/";

  for (const ev of rr) {
    const atMs = rel(ev.timestamp);
    if (ev.type === 4) {
      const href = typeof ev.data.href === "string" ? ev.data.href : "";
      if (href) metaHref = href;
      enterPage(href || ev.url, atMs);
      responses.push(atMs);
      continue;
    }
    // The envelope's URL follows SPA navigation, which emits no Meta event.
    enterPage(ev.url || metaHref, atMs);
    if (ev.type === 2) {
      mirror.loadSnapshot(ev.data.node);
      responses.push(atMs);
      continue;
    }
    if (ev.type !== 3) continue;
    const source = num(ev.data.source);
    if (source === 0) {
      if (mutationHasChanges(ev.data)) responses.push(atMs);
      mirror.applyMutation(ev.data);
      continue;
    }
    if (RESPONSE_SOURCES.has(source)) responses.push(atMs);
    if (source === 2 && num(ev.data.type) === 2) {
      const target = mirror.describe(num(ev.data.id));
      clicks.push({
        atMs,
        x: num(ev.data.x),
        y: num(ev.data.y),
        page: currentPage(),
        pageIndex: visits.length - 1,
        target,
        label: maskLabel(target?.label ?? "element"),
      });
    } else if (source === 3) {
      const id = num(ev.data.id);
      const y = num(ev.data.y);
      if (Number.isFinite(id) && Number.isFinite(y)) {
        const list = scrolls.get(id) ?? [];
        list.push({ atMs, y, page: currentPage() });
        scrolls.set(id, list);
      }
    } else if (source === 5) {
      const id = num(ev.data.id);
      if (Number.isFinite(id)) inputs.push({ atMs, id, target: mirror.describe(id), pageIndex: visits.length - 1 });
    }
  }

  // Sidecars: errors and requests, placed on the same clock.
  const errorTimes: number[] = [];
  const failedTimes: number[] = [];
  const requestTimes: number[] = [];
  const errors: SessionTimeline["errors"] = [];
  const seenMessages = new Set<string>();
  let errorCount = 0;
  let lastSideMs = 0;
  for (const s of side) {
    const atMs = rel(s.ts);
    lastSideMs = Math.max(lastSideMs, atMs);
    if (!visits.length) enterPage(s.url, atMs);
    if (s.kind === "session_error") {
      errorCount += 1;
      errorTimes.push(atMs);
      const message = maskText(typeof s.data.message === "string" ? s.data.message : "Script error", 120) || "Script error";
      if (!seenMessages.has(message) && errors.length < MAX_TIMELINE_ERRORS) {
        seenMessages.add(message);
        errors.push({ atMs, page: pathOf(s.url) || currentPage(), message });
      }
    } else if (s.kind === "network_event") {
      requestTimes.push(atMs);
      if (isRealRequestFailure(s.data, s.url)) failedTimes.push(atMs);
    }
  }
  requestTimes.sort((a, b) => a - b);
  responses.sort((a, b) => a - b);

  const lastRrMs = rr.length ? rel(rr[rr.length - 1]!.timestamp) : 0;
  const durationMs = Math.max(lastRrMs, lastSideMs);
  for (let i = 0; i < visits.length; i++) visits[i]!.endMs = i + 1 < visits.length ? visits[i + 1]!.atMs : durationMs;

  const signals: FrustrationSignal[] = [];

  // ── rage clicks ──────────────────────────────────────────────────────────
  const inRage = new Set<number>();
  for (let i = 0; i < clicks.length; i++) {
    if (inRage.has(i)) continue;
    const a = clicks[i]!;
    const members = [i];
    for (let j = i + 1; j < clicks.length; j++) {
      const b = clicks[j]!;
      if (b.atMs - a.atMs > THRESHOLDS.rageWindowMs) break;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (dx * dx + dy * dy <= THRESHOLDS.rageRadiusPx ** 2) members.push(j);
    }
    if (members.length < THRESHOLDS.rageMinClicks) continue;
    // Absorb the rest of the burst too, so one long rage is one signal.
    let last = members[members.length - 1]!;
    for (let j = last + 1; j < clicks.length; j++) {
      const b = clicks[j]!;
      if (b.atMs - clicks[last]!.atMs > THRESHOLDS.rageWindowMs) break;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (dx * dx + dy * dy <= (THRESHOLDS.rageRadiusPx * 2) ** 2) {
        members.push(j);
        last = j;
      }
    }
    for (const m of members) inRage.add(m);
    signals.push({ type: "rage_click", atMs: a.atMs, page: a.page, label: a.label, count: members.length });
  }

  // ── error clicks and dead clicks ──────────────────────────────────────────
  const merged = (type: "dead_click" | "error_click", c: Click, detail?: string) => {
    const prev = [...signals].reverse().find((s) => s.type === type);
    if (prev && prev.label === c.label && prev.page === c.page && c.atMs - prev.atMs <= THRESHOLDS.mergeWindowMs) {
      prev.count = (prev.count ?? 1) + 1;
      return;
    }
    signals.push({ type, atMs: c.atMs, page: c.page, label: c.label, count: 1, ...(detail ? { detail } : {}) });
  };
  for (let i = 0; i < clicks.length; i++) {
    const c = clicks[i]!;
    const jsError = anyBetween(errorTimes, c.atMs, c.atMs + THRESHOLDS.errorWindowMs);
    const failed = anyBetween(failedTimes, c.atMs, c.atMs + THRESHOLDS.errorWindowMs);
    if (jsError || failed) {
      merged("error_click", c, jsError ? "JavaScript error" : "request failed");
      continue;
    }
    if (inRage.has(i)) continue;
    const kind = c.target?.kind;
    if (kind !== "link" && kind !== "button") continue;
    const from = c.atMs - THRESHOLDS.deadLeadMs;
    const to = c.atMs + THRESHOLDS.deadWindowMs;
    // The session ending inside the window is not evidence of anything; nor is a link
    // near the end, which most likely led off the site.
    if (to > durationMs) continue;
    if (kind === "link" && durationMs - c.atMs < THRESHOLDS.navigationGraceMs) continue;
    if (anyBetween(responses, from, to) || anyBetween(requestTimes, from, to)) continue;
    // A slow page load shows nothing for a while, then a new page.
    if (visits.some((v) => v.atMs > c.atMs && v.atMs <= c.atMs + THRESHOLDS.navigationGraceMs)) continue;
    merged("dead_click", c);
  }

  // ── U-turns ───────────────────────────────────────────────────────────────
  for (let i = 1; i + 1 < visits.length; i++) {
    const prev = visits[i - 1]!;
    const cur = visits[i]!;
    const next = visits[i + 1]!;
    const dwell = cur.endMs - cur.atMs;
    if (next.path === prev.path && dwell <= THRESHOLDS.uTurnMaxDwellMs) {
      signals.push({
        type: "u_turn",
        atMs: next.atMs,
        page: cur.path,
        detail: `back to ${prev.path} after ${Math.max(1, Math.round(dwell / 1000))}s`,
      });
    }
  }

  // ── form abandonment ──────────────────────────────────────────────────────
  const forms = new Map<string, { fields: Set<number>; first: number; last: number; pageIndex: number; label: string }>();
  for (const inp of inputs) {
    const t = inp.target;
    if (!t || t.kind !== "field" || t.isSearch) continue;
    if (t.inputType === "checkbox" || t.inputType === "radio") continue;
    const key = `${inp.pageIndex}:${t.formId ?? "page"}`;
    const f = forms.get(key) ?? { fields: new Set<number>(), first: inp.atMs, last: inp.atMs, pageIndex: inp.pageIndex, label: "form" };
    f.fields.add(inp.id);
    f.last = Math.max(f.last, inp.atMs);
    forms.set(key, f);
  }
  const fieldsTouched = new Set(inputs.filter((i) => i.target?.kind === "field").map((i) => i.id)).size;
  for (const f of forms.values()) {
    if (f.fields.size < THRESHOLDS.formMinFields) continue;
    const visit = visits[f.pageIndex];
    const leftAt = visit ? visit.endMs : durationMs;
    const submitted = clicks.some(
      (c) => c.pageIndex === f.pageIndex && c.atMs >= f.first &&
        ((c.target?.kind === "button" && (c.target.formId !== undefined || SUBMIT_LABEL.test(c.label))) ||
          (c.target?.kind === "link" && SUBMIT_LABEL.test(c.label))),
    );
    if (submitted) continue;
    if (leftAt - f.last < THRESHOLDS.formEnterSubmitMs && f.pageIndex + 1 < visits.length) continue;
    signals.push({
      type: "form_abandon",
      atMs: f.last,
      page: visit?.path ?? currentPage(),
      label: "form",
      count: f.fields.size,
      detail: `${f.fields.size} fields filled, not submitted`,
    });
  }

  // ── scroll thrash ─────────────────────────────────────────────────────────
  for (const list of scrolls.values()) {
    let dir = 0;
    let extreme = list[0]?.y ?? 0;
    let reversals: number[] = [];
    let lastSignalAt = -Infinity;
    for (let i = 1; i < list.length; i++) {
      const p = list[i]!;
      const delta = p.y - extreme;
      if (dir === 0) {
        if (Math.abs(delta) >= THRESHOLDS.thrashMinTravelPx) {
          dir = Math.sign(delta);
          extreme = p.y;
        }
        continue;
      }
      if (Math.sign(delta) === dir) {
        extreme = p.y;
        continue;
      }
      if (Math.abs(delta) < THRESHOLDS.thrashMinTravelPx) continue;
      dir = -dir;
      extreme = p.y;
      reversals.push(p.atMs);
      reversals = reversals.filter((t) => p.atMs - t <= THRESHOLDS.thrashWindowMs);
      if (reversals.length >= THRESHOLDS.thrashMinReversals && reversals[0]! > lastSignalAt) {
        signals.push({ type: "scroll_thrash", atMs: reversals[0]!, page: p.page, count: reversals.length });
        lastSignalAt = p.atMs;
        reversals = [];
      }
    }
  }

  signals.sort((a, b) => a.atMs - b.atMs);
  const counts: SignalCounts = {};
  for (const s of signals) counts[s.type] = (counts[s.type] ?? 0) + 1;

  // ── timeline for the summary ──────────────────────────────────────────────
  const timelineClicks: SessionTimeline["clicks"] = [];
  for (const c of clicks) {
    const prev = timelineClicks[timelineClicks.length - 1];
    if (prev && prev.label === c.label && prev.page === c.page && c.atMs - prev.atMs < 2000) continue;
    if (timelineClicks.length >= MAX_TIMELINE_CLICKS) break;
    timelineClicks.push({ atMs: c.atMs, page: c.page, label: c.label });
  }
  const goalVisit = visits.find((v) => GOAL_PATH.test(v.path));

  return {
    score: scoreFrom(counts, errorCount),
    counts,
    signals: signals.slice(0, MAX_SIGNALS),
    rrwebEvents: rr.length,
    timeline: {
      durationMs,
      pages: visits.slice(0, MAX_TIMELINE_PAGES).map((v) => ({ path: v.path, atMs: v.atMs, dwellMs: Math.max(0, v.endMs - v.atMs) })),
      clicks: timelineClicks,
      errors,
      errorCount,
      failedRequests: failedTimes.length,
      fieldsTouched,
      goal: goalVisit ? { reached: true, page: goalVisit.path, atMs: goalVisit.atMs } : { reached: false },
      ...(opts.truncated ? { truncated: true } : {}),
    },
  };
}

/** Ad, analytics and tag hosts: a privacy extension blocking them is not the visitor hitting an error. */
const BLOCKABLE_HOST = /(^|\.)(google-analytics|googletagmanager|googleadservices|googlesyndication|doubleclick|facebook|fbcdn|connect\.facebook|hotjar|segment|mixpanel|amplitude|clarity\.ms|bing|linkedin|licdn|tiktok|twitter|ads-twitter|criteo|taboola|outbrain|intercom|hubspot|hs-scripts|sentry|newrelic|nr-data|datadoghq|fullstory|posthog|plausible|matomo|seentics)\./i;
/** Paths that read as tracking even on the site's own domain. */
const TRACKING_PATH = /\/(collect|track|tracking|analytics|beacon|pixel|gtag|gtm|events?\/ingest|telemetry)(\/|\?|$)/i;

/**
 * Whether a recorded request is a failure the visitor actually ran into.
 *
 * A 5xx always is. "No response" (status 0) is ambiguous: it is also what a browser reports for
 * a request an ad blocker or privacy extension stopped, and for requests cancelled when the
 * visitor clicks through to another page. So it counts only for the site's own requests that
 * were not cancelled, and never for ad or analytics hosts or tracking paths. Exported for tests.
 */
export function isRealRequestFailure(data: Record<string, unknown>, pageUrl: string | undefined): boolean {
  const status = num(data.status);
  let target: URL | null = null;
  try { target = new URL(String(data.url ?? ""), pageUrl || undefined); } catch { /* not a URL */ }
  if (target && (BLOCKABLE_HOST.test(target.hostname) || TRACKING_PATH.test(target.pathname))) return false;
  if (status >= 500) return true;
  if (status !== 0) return false;
  const error = String(data.error ?? "");
  if (/abort|cancel/i.test(error)) return false;
  if (!target || !pageUrl) return false;
  try {
    return target.origin === new URL(pageUrl).origin;
  } catch {
    return false;
  }
}
