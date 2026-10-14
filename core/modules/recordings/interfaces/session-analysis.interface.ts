/**
 * Session analysis: frustration signals found in a recording, and a short summary of what
 * the visitor did.
 *
 * The signals are deterministic — code reads the rrweb stream once, after the session has
 * gone idle, and stores what it found (`session_analyses`, db/sql/055). The summary is
 * worded by a model from that stored result, never from the raw recording, and is
 * optional: this module declares the `SessionSummarizer` port and the AI module
 * implements it. Without a configured model the port is absent and only the signals are
 * served.
 *
 * Nothing here holds typed input values or page text beyond short, masked element labels
 * ("button \"Apply coupon\""), so the stored analysis and everything built from it are
 * safe to show in the dashboard and to hand to a model.
 */

/** Every signal the detector knows, most severe first. */
export const FRUSTRATION_SIGNAL_TYPES = [
  "rage_click",
  "error_click",
  "form_abandon",
  "dead_click",
  "u_turn",
  "scroll_thrash",
] as const;

export type FrustrationSignalType = (typeof FRUSTRATION_SIGNAL_TYPES)[number];

export function isFrustrationSignalType(v: unknown): v is FrustrationSignalType {
  return typeof v === "string" && (FRUSTRATION_SIGNAL_TYPES as readonly string[]).includes(v);
}

/** One frustrating moment. `atMs` is the playback offset: ms after the recording's first rrweb event. */
export type FrustrationSignal = {
  type: FrustrationSignalType;
  atMs: number;
  /** Masked route of the page it happened on (`/orders/:id`). */
  page: string;
  /** Short, masked description of the element involved, when there is one. */
  label?: string;
  /** Clicks in a rage cluster, clicks merged into one dead/error signal, reversals in a thrash. */
  count?: number;
  /** One short, code-written line of context ("back to /pricing after 4s"). */
  detail?: string;
};

export type SignalCounts = Partial<Record<FrustrationSignalType, number>>;

/**
 * The compact story of a session, kept so a summary can be written later without
 * downloading the recording again.
 */
export type SessionTimeline = {
  /** Playback length: last event minus first rrweb event. */
  durationMs: number;
  /** Pages in the order visited, consecutive repeats folded, with the time spent on each. */
  pages: Array<{ path: string; atMs: number; dwellMs: number }>;
  /** Clicks with masked target labels, consecutive repeats folded. Capped. */
  clicks: Array<{ atMs: number; page: string; label: string }>;
  /** JavaScript errors, distinct by message, masked. Capped. */
  errors: Array<{ atMs: number; page: string; message: string }>;
  /** Every JS error in the stream, not just the distinct ones listed. */
  errorCount: number;
  /** Requests that failed (status 0 or >= 500). */
  failedRequests: number;
  /** Distinct form fields the visitor typed into. Never their values. */
  fieldsTouched: number;
  /** Whether a page that looks like a goal (thank-you, confirmation, success) was reached. */
  goal: { reached: boolean; page?: string; atMs?: number };
  /** True when the recording was too long to read in full; the analysis covers the start. */
  truncated?: boolean;
};

/** The model's (or the rules') account of the session. */
export type SessionSummary = {
  /** Two to four sentences: what happened. */
  text: string;
  /** What the visitor was most likely trying to do, as a short phrase. */
  intent: string;
  outcome: "succeeded" | "struggled" | "abandoned";
  /** Up to three moments worth jumping to, each at a timestamp the brief contained. */
  moments: Array<{ atMs: number; label: string }>;
};

/** Everything a summarizer is given. Already masked. */
export type SessionSummaryInput = {
  websiteId: string;
  sessionId: string;
  device: string;
  browser: string;
  os: string;
  country: string;
  score: number;
  counts: SignalCounts;
  signals: FrustrationSignal[];
  timeline: SessionTimeline;
};

export type SessionSummaryResult = {
  summary: SessionSummary;
  /** `ai`: worded by the model. `rules`: from templates, because no model answered usefully. */
  source: "ai" | "rules";
  /** The model that answered; `null` when none did (unreachable, or not configured). */
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

/**
 * Writes a summary. Implemented by the AI module; injected into this one at composition.
 *
 * Never throws for a model failure: it falls back to a rule-based summary and says so
 * through `source` and `model`. A throw means something else went wrong.
 */
export interface SessionSummarizer {
  summarize(input: SessionSummaryInput): Promise<SessionSummaryResult>;
}

/**
 * Why there is, or is not, a summary in a response.
 *
 * - `ready`: `summary` is current.
 * - `unavailable`: no model is configured on this deployment.
 * - `no_data`: the recording had nothing to summarise (no rrweb events, or not uploaded yet).
 * - `cooldown`: one was attempted recently; `retryAfterSec` says when to ask again.
 * - `limit`: the site's daily summary allowance is used up.
 * - `failed`: generation threw.
 * - `not_requested`: the caller asked for the signals only.
 */
export type SessionSummaryStatus =
  | "ready"
  | "unavailable"
  | "no_data"
  | "cooldown"
  | "limit"
  | "failed"
  | "not_requested";

export type SessionAnalysisView = {
  sessionId: string;
  /** `ready`: analysed. `pending`: no recording bytes yet. `not_found`: no such session. */
  status: "ready" | "pending" | "not_found";
  score: number;
  counts: SignalCounts;
  signals: FrustrationSignal[];
  timeline: SessionTimeline | null;
  computedAt: string | null;
  startedAt: string | null;
  meta: {
    device: string;
    browser: string;
    os: string;
    country: string;
    entryPage: string;
    pagesViewed: number;
    durationSeconds: number;
  } | null;
  summary: SessionSummary | null;
  summarySource: "ai" | "rules" | null;
  summaryStatus: SessionSummaryStatus;
  retryAfterSec?: number;
};

/** One row of "the sessions worth watching", for the assistant. */
export type FrustratedSessionRow = {
  sessionId: string;
  startedAt: string;
  score: number;
  counts: SignalCounts;
  device: string;
  browser: string;
  country: string;
  entryPage: string;
  durationSeconds: number;
  pagesViewed: number;
  /** The stored summary, when one was already written. Never generated by this read. */
  summary: string | null;
  outcome: SessionSummary["outcome"] | null;
};

/** Reads over stored analyses. Website ids come from the authenticated request, never a model. */
export interface SessionAnalysisReads {
  /**
   * One session's analysis. Computes it if it was never stored (one download of the
   * recording), and with `summarize` writes the summary if there is none — at most once
   * per session per cooldown, and within the site's daily allowance.
   */
  getAnalysis(websiteRef: string, sessionId: string, opts?: { summarize?: boolean }): Promise<SessionAnalysisView>;

  /** The most frustrated analysed sessions that started in the last `days`, worst first. */
  listFrustrated(
    websiteRef: string,
    opts: { days: number; signal?: FrustrationSignalType; limit: number; minScore?: number },
  ): Promise<FrustratedSessionRow[]>;
}

export type AnalyzeRunStats = { analyzed: number; empty: number; failed: number };
export type SummaryRunStats = { generated: number; skipped: number; failed: number; tokens: number; costUsd: number };

/** The scheduled work: analyse idle sessions, and pre-write summaries for the worst ones. */
export interface SessionAnalysisJobs {
  /** Analyse a batch of recently ended sessions that have no current analysis. Never throws per session. */
  analyzePending(): Promise<AnalyzeRunStats>;
  /** Summaries for the most frustrated sessions per site. A no-op without a summarizer. */
  summarizeTop(): Promise<SummaryRunStats>;
  /** Whether a summarizer is wired, read at call time. */
  summariesEnabled(): boolean;
}
