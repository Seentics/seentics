import {
  listSessions,
  summarizeSessions,
} from "../repositories/recording.repository";
import type { SessionListFilters, SignalCounts } from "../interfaces";
import { isFrustrationSignalType } from "../interfaces";
import { clampListParams, timestampToIso } from "./recording-query-normalization.service";

/** The joined `signal_counts` jsonb: an object of counts, or `null` when not analysed. */
/** Worst first: the signal a one-line description leads with. */
const HEADLINE_ORDER = ["error_click", "rage_click", "form_abandon", "dead_click", "u_turn", "scroll_thrash"];

/**
 * One line for the session list: the AI summary's first sentence when there is one, otherwise the
 * worst signal in plain words. Exported for tests.
 */
export function sessionHeadline(summaryText: unknown, signals: unknown): string | null {
  if (typeof summaryText === "string" && summaryText.trim()) {
    const first = summaryText.trim().match(/^.+?[.!?](?=\s|$)/)?.[0] ?? summaryText.trim();
    return first.length > 160 ? `${first.slice(0, 157).trimEnd()}…` : first;
  }
  if (!Array.isArray(signals) || signals.length === 0) return null;
  const list = signals.filter((x): x is Record<string, unknown> => !!x && typeof x === "object");
  const worst = [...list].sort((a, b) => HEADLINE_ORDER.indexOf(String(a.type)) - HEADLINE_ORDER.indexOf(String(b.type)))[0];
  if (!worst) return null;
  const label = typeof worst.label === "string" && worst.label ? worst.label : "an element";
  const page = typeof worst.page === "string" && worst.page ? ` on ${worst.page}` : "";
  const times = typeof worst.count === "number" && worst.count > 1 ? ` ${worst.count} times` : "";
  const line = (() => {
    switch (worst.type) {
      case "error_click": return `Hit an error clicking ${label}${page}`;
      case "rage_click": return `Rage-clicked ${label}${times}${page}`;
      case "form_abandon": return `Started a form${page} and gave up`;
      case "dead_click": return `Clicked ${label}${page} and nothing happened`;
      case "u_turn": return `Left${page || " a page"} within seconds and came back`;
      case "scroll_thrash": return `Scrolled back and forth${page}, searching`;
      default: return null;
    }
  })();
  if (!line) return null;
  const more = list.length - 1;
  return more > 0 ? `${line} (+${more} more)` : line;
}

function outcomeOf(v: unknown): "succeeded" | "struggled" | "abandoned" | null {
  return v === "succeeded" || v === "struggled" || v === "abandoned" ? v : null;
}

function signalCountsOf(v: unknown): SignalCounts | null {
  if (v == null) return null;
  const obj = typeof v === "string" ? (() => { try { return JSON.parse(v) as unknown; } catch { return null; } })() : v;
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  const out: SignalCounts = {};
  for (const [k, n] of Object.entries(obj as Record<string, unknown>)) {
    if (isFrustrationSignalType(k) && Number(n) > 0) out[k] = Number(n);
  }
  return out;
}

/**
 * One page of recorded sessions, newest first, plus totals over the whole filtered set.
 *
 * `summary` exists because the dashboard used to fetch a fixed 100 rows and render
 * `rows.length` as "Total Sessions" — a number that silently stopped counting at 100 and
 * made every headline figure on the page a statistic about the first page.
 *
 * Filtering is server-side for the same reason: a search that only sees the rows already
 * downloaded reports "no results" for sessions that exist.
 */
export async function listReplaySessions(
  websiteId: string,
  limit: number,
  offset: number,
  filters: SessionListFilters = {},
) {
  const { limit: lim, offset: off } = clampListParams(limit, offset);
  const [sessions, summary] = await Promise.all([
    listSessions(websiteId, lim, off, filters),
    summarizeSessions(websiteId, filters),
  ]);
  const out = sessions.map((s) => ({
    sessionId: s.sessionId,
    websiteId: s.websiteId,
    browser: s.browser,
    device: s.device,
    os: s.os,
    country: s.country,
    entryPage: s.entryPage,
    startedAt: timestampToIso(s.startedAt),
    hasRageClicks: s.hasRageClicks,
    hasErrors: s.hasErrors,
    durationSeconds: s.durationSeconds,
    pagesViewed: s.pagesViewed,
    frustrationScore: s.frustrationScore == null ? null : Number(s.frustrationScore),
    signalCounts: signalCountsOf(s.signalCounts),
    summary: sessionHeadline(s.summaryText, s.signals),
    outcome: outcomeOf(s.summaryOutcome),
  }));
  return { sessions: out, limit: lim, offset: off, total: summary.total, summary };
}

/**
 * Raw API variant: snake_case rows for that surface's response shape.
 *
 * The raw API's key middleware already resolved the website in order to authenticate the
 * request, so resolving again here was a second lookup for an answer the caller was holding.
 */
export async function listReplaySessionsRaw(
  websiteId: string,
  limit: number,
  offset: number,
) {
  const { limit: lim, offset: off } = clampListParams(limit, offset);
  const [sessions, summary] = await Promise.all([
    listSessions(websiteId, lim, off),
    summarizeSessions(websiteId),
  ]);
  return {
    limit: lim,
    offset: off,
    total: summary.total,
    sessions: sessions.map((s) => ({
      session_id: s.sessionId,
      website_id: s.websiteId,
      browser: s.browser,
      device: s.device,
      os: s.os,
      country: s.country,
      entry_page: s.entryPage,
      started_at: timestampToIso(s.startedAt),
      duration_seconds: s.durationSeconds,
      pages_viewed: s.pagesViewed,
      has_rage_clicks: s.hasRageClicks,
      has_errors: s.hasErrors,
      frustration_score: s.frustrationScore == null ? null : Number(s.frustrationScore),
      signal_counts: signalCountsOf(s.signalCounts),
      summary: sessionHeadline(s.summaryText, s.signals),
      outcome: outcomeOf(s.summaryOutcome),
    })),
  };
}
