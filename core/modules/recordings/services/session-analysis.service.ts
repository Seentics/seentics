import { log as baseLog } from "../../../platform/observability/logger";
import type {
  AnalyzeRunStats,
  FrustratedSessionRow,
  FrustrationSignalType,
  SessionAnalysisJobs,
  SessionAnalysisReads,
  SessionAnalysisView,
  SessionSummarizer,
  SessionSummary,
  SessionSummaryInput,
  SessionSummaryStatus,
  SummaryRunStats,
} from "../interfaces";
import type {
  AnalysisStatus,
  SessionAnalysisStore,
  SessionWithAnalysis,
  StoredAnalysis,
} from "../repositories/session-analysis.repository";
import { detectFrustration } from "./frustration/frustration-detection";
import type { LoadedRecording } from "./frustration/recording-event-loader";

const log = baseLog.child({ category: "recordings" });

/**
 * When and how sessions are analysed and summarised.
 *
 * Analysis is deterministic and cheap to store but needs the recording, which lives in
 * object storage — so it runs once per session, after the session has gone idle, from a
 * scheduled batch (`analyzePending`). A session viewed before the job reached it is
 * analysed on that first view instead, and the result stored either way.
 *
 * Summaries cost a model call, so they are written lazily — on the first request for one —
 * and kept. A nightly pass pre-writes them for each site's most frustrated sessions, which
 * are the ones someone is likely to open. Every write is bounded three ways: once per
 * session (a stored summary is served until the analysis under it changes), a per-session
 * cooldown on attempts, and a per-site daily allowance.
 */
export type SessionAnalysisConfig = {
  /** How far back the job looks for sessions to analyse. */
  lookbackMs: number;
  /** A session is finished once nothing has arrived for this long. The tracker's session timeout. */
  idleMs: number;
  /** Sessions per job run. */
  batch: number;
  /** Recordings downloaded at once by the job. */
  concurrency: number;
  /** An unfinished session viewed again is re-read at most this often. */
  recomputeMs: number;
  /** A recording that could not be read is retried on view after this long. */
  failedRetryMs: number;
  /** Least time between two summary attempts for one session. */
  summaryCooldownMs: number;
  /** Most model-written summaries per site per 24 h, on demand and nightly together. */
  dailySummaryCap: number;
  /** Nightly: summaries per site, worst sessions first. */
  nightlyPerSite: number;
  /** Nightly: summaries per run, across all sites. */
  nightlyMaxTotal: number;
  /** Nightly: sessions scoring below this are not worth a pre-written summary. */
  nightlyMinScore: number;
  /** Nightly: sessions that started within this window. */
  nightlyLookbackMs: number;
};

function envInt(env: NodeJS.ProcessEnv, key: string, fallback: number, min = 0): number {
  const n = Number(env[key]);
  return Number.isFinite(n) && n >= min ? Math.trunc(n) : fallback;
}

export function readSessionAnalysisConfig(env: NodeJS.ProcessEnv = process.env): SessionAnalysisConfig {
  const minute = 60_000;
  return {
    lookbackMs: envInt(env, "RECORDING_ANALYSIS_LOOKBACK_HOURS", 48, 1) * 60 * minute,
    idleMs: envInt(env, "RECORDING_ANALYSIS_IDLE_MINUTES", 30, 1) * minute,
    batch: envInt(env, "RECORDING_ANALYSIS_BATCH", 200, 1),
    concurrency: Math.min(16, envInt(env, "RECORDING_ANALYSIS_CONCURRENCY", 4, 1)),
    recomputeMs: 2 * minute,
    failedRetryMs: 30 * minute,
    summaryCooldownMs: envInt(env, "AI_SESSION_SUMMARY_COOLDOWN_MINUTES", 10, 0) * minute,
    dailySummaryCap: envInt(env, "AI_SESSION_SUMMARY_DAILY_CAP", 200, 0),
    nightlyPerSite: envInt(env, "AI_SESSION_SUMMARY_PER_SITE", 20, 0),
    nightlyMaxTotal: envInt(env, "AI_SESSION_SUMMARY_MAX_PER_RUN", 500, 0),
    nightlyMinScore: envInt(env, "AI_SESSION_SUMMARY_MIN_SCORE", 20, 1),
    nightlyLookbackMs: envInt(env, "AI_SESSION_SUMMARY_LOOKBACK_HOURS", 26, 1) * 60 * minute,
  };
}

/** After this many model failures in a row, a nightly run stops calling the model. */
export const SUMMARY_BREAKER_THRESHOLD = 5;

export type SessionAnalysisDeps = {
  store: SessionAnalysisStore;
  load: (websiteId: string, sessionId: string) => Promise<LoadedRecording | null>;
  /** Read at call time: the AI module is composed after this one. `null` when no model is configured. */
  summarizer: () => SessionSummarizer | null;
  config: SessionAnalysisConfig;
  now?: () => Date;
};

type EnsuredSummary = {
  summary: SessionSummary | null;
  source: "ai" | "rules" | null;
  status: SessionSummaryStatus;
  retryAfterSec?: number;
  generated: boolean;
  /** The model was called and did not answer. */
  modelFailed?: boolean;
  tokens?: number;
  costUsd?: number;
};

const clampInt = (v: number, min: number, max: number, fallback: number) =>
  Number.isFinite(v) ? Math.min(max, Math.max(min, Math.trunc(v))) : fallback;

export class SessionAnalysisService implements SessionAnalysisReads, SessionAnalysisJobs {
  private readonly now: () => Date;

  constructor(private readonly deps: SessionAnalysisDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  /** Whether summaries can be worded by a model (the template needs none). */
  summariesEnabled(): boolean {
    return this.deps.summarizer()?.modelConfigured === true;
  }

  /**
   * Read the recording, find the signals, store them. Returns `null` without storing when
   * the session has no recording bytes yet and may still get some.
   */
  private async analyze(s: SessionWithAnalysis, storeEmpty: boolean): Promise<StoredAnalysis | null> {
    let status: AnalysisStatus = "ready";
    let found: ReturnType<typeof detectFrustration> | null = null;
    try {
      const loaded = await this.deps.load(s.websiteId, s.sessionId);
      if (!loaded) {
        if (!storeEmpty) return null;
        status = "empty";
      } else {
        found = detectFrustration(loaded.rows, { truncated: loaded.truncated });
        if (found.rrwebEvents === 0) status = "empty";
      }
    } catch (err) {
      status = "failed";
      log.warn({ msg: "session_analysis_load_failed", website_id: s.websiteId, session_id: s.sessionId, err: String(err) });
    }
    const write = {
      websiteId: s.websiteId,
      sessionId: s.sessionId,
      startedAt: s.startedAt,
      status,
      score: status === "ready" && found ? found.score : 0,
      counts: status === "ready" && found ? found.counts : {},
      signals: status === "ready" && found ? found.signals : [],
      timeline: found?.timeline ?? null,
      analyzedThroughMs: s.endMs,
    };
    const computedAt = await this.deps.store.saveAnalysis(write);
    return {
      ...write,
      computedAt,
      summary: s.analysis?.summary ?? null,
      summarySource: s.analysis?.summarySource ?? null,
      summaryModel: s.analysis?.summaryModel ?? null,
      summaryGeneratedAt: s.analysis?.summaryGeneratedAt ?? null,
      summaryAnalysisAt: s.analysis?.summaryAnalysisAt ?? null,
      summaryAttemptedAt: s.analysis?.summaryAttemptedAt ?? null,
    };
  }

  /** Whether a stored analysis should be redone before it is served. */
  private stale(s: SessionWithAnalysis, nowMs: number): boolean {
    const a = s.analysis;
    if (!a) return true;
    const age = nowMs - a.computedAt.getTime();
    if (a.status === "failed") return age > this.deps.config.failedRetryMs;
    // More activity since: worth one more read, but not on every page load of a live session.
    return a.analyzedThroughMs < s.endMs && age > this.deps.config.recomputeMs;
  }

  async getAnalysis(websiteRef: string, sessionId: string, opts: { summarize?: boolean } = {}): Promise<SessionAnalysisView> {
    const sid = sessionId.trim();
    const session = await this.deps.store.getSession(websiteRef, sid);
    if (!session) return emptyView(sid, "not_found");

    const nowMs = this.now().getTime();
    let analysis = session.analysis;
    if (this.stale(session, nowMs)) {
      const idle = session.endMs < nowMs - this.deps.config.idleMs;
      analysis = (await this.analyze(session, idle)) ?? analysis;
    }
    if (!analysis) return { ...emptyView(sid, "pending"), ...metaOf(session) };

    const ensured = opts.summarize === false
      ? { summary: analysis.summary, source: analysis.summarySource, status: analysis.summary ? "ready" as const : "not_requested" as const, generated: false }
      : await this.ensureSummary(session, analysis);

    return {
      sessionId: sid,
      status: "ready",
      score: analysis.score,
      counts: analysis.counts,
      signals: analysis.signals,
      timeline: analysis.timeline,
      computedAt: analysis.computedAt.toISOString(),
      ...metaOf(session),
      summary: ensured.summary,
      summarySource: ensured.summary ? ensured.source : null,
      summaryStatus: ensured.status,
      ...(ensured.retryAfterSec ? { retryAfterSec: ensured.retryAfterSec } : {}),
    };
  }

  /**
   * The summary for an analysis, written now if it has none that is current.
   *
   * A template summary written because the model could not be reached is not current: it is
   * served, but the next request after the cooldown tries the model again. One written
   * because the model's answer failed the checks is kept — asking again would most likely
   * pay for the same answer.
   */
  private async ensureSummary(s: SessionWithAnalysis, a: StoredAnalysis): Promise<EnsuredSummary> {
    const summarizer = this.deps.summarizer();
    const existing = { summary: a.summary, source: a.summarySource };
    const current = !!a.summary && !!a.summaryAnalysisAt && a.summaryAnalysisAt.getTime() >= a.computedAt.getTime();
    const retryable = a.summarySource === "rules" && a.summaryModel === null && summarizer?.modelConfigured === true;
    if (current && !retryable) return { ...existing, status: "ready", generated: false };
    if (!summarizer) return a.summary ? { ...existing, status: "ready", generated: false } : { summary: null, source: null, status: "unavailable", generated: false };
    if (a.status !== "ready" || !a.timeline) return { summary: null, source: null, status: "no_data", generated: false };

    const input: SessionSummaryInput = {
      websiteId: s.websiteId,
      sessionId: s.sessionId,
      device: s.device,
      browser: s.browser,
      os: s.os,
      country: s.country,
      score: a.score,
      counts: a.counts,
      signals: a.signals,
      timeline: a.timeline,
    };
    // The template, unsaved: free and instant. Served when a model would add nothing (a calm visit,
    // a bounce), when there is none, and in place of "try later" when the model cannot be asked now.
    const template = (): EnsuredSummary => ({ summary: summarizer.template(input), source: "rules", status: "ready", generated: false });
    if (!summarizer.modelConfigured || !summarizer.worthModel(input)) return a.summary ? { ...existing, status: "ready", generated: false } : template();

    const { config, store } = this.deps;
    const now = this.now();
    const used = await store.countSummariesSince(s.websiteId, new Date(now.getTime() - 86_400_000));
    if (used >= config.dailySummaryCap) {
      return a.summary ? { ...existing, status: "ready", generated: false } : template();
    }
    const claimed = await store.claimSummary(s.websiteId, s.sessionId, new Date(now.getTime() - config.summaryCooldownMs));
    if (!claimed) {
      return a.summary ? { ...existing, status: "ready", generated: false } : template();
    }

    try {
      const result = await summarizer.summarize(input);
      await store.saveSummary(s.websiteId, s.sessionId, {
        summary: result.summary,
        source: result.source,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: result.costUsd,
        analysisAt: a.computedAt,
      });
      return {
        summary: result.summary,
        source: result.source,
        status: "ready",
        generated: true,
        modelFailed: result.source === "rules" && result.model === null,
        tokens: result.inputTokens + result.outputTokens,
        costUsd: result.costUsd,
      };
    } catch (err) {
      log.warn({ msg: "session_summary_failed", website_id: s.websiteId, session_id: s.sessionId, err: String(err) });
      return a.summary ? { ...existing, status: "ready", generated: false } : template();
    }
  }

  async listFrustrated(
    websiteRef: string,
    opts: { days: number; signal?: FrustrationSignalType; limit: number; minScore?: number },
  ): Promise<FrustratedSessionRow[]> {
    const days = clampInt(opts.days, 1, 365, 7);
    return this.deps.store.listFrustrated(websiteRef, {
      since: new Date(this.now().getTime() - days * 86_400_000),
      signal: opts.signal,
      minScore: clampInt(opts.minScore ?? 1, 1, 100, 1),
      limit: clampInt(opts.limit, 1, 50, 10),
    });
  }

  async analyzePending(): Promise<AnalyzeRunStats> {
    const { config, store } = this.deps;
    const nowMs = this.now().getTime();
    const pending = await store.listPending({
      since: new Date(nowMs - config.lookbackMs),
      idleBeforeMs: nowMs - config.idleMs,
      limit: config.batch,
    });
    const stats: AnalyzeRunStats = { analyzed: 0, empty: 0, failed: 0 };
    let next = 0;
    const worker = async () => {
      while (next < pending.length) {
        const { websiteId, sessionId } = pending[next++]!;
        try {
          const session = await store.getSession(websiteId, sessionId);
          if (!session) continue;
          const stored = await this.analyze(session, true);
          if (stored?.status === "ready") stats.analyzed += 1;
          else if (stored?.status === "empty") stats.empty += 1;
          else stats.failed += 1;
        } catch (err) {
          stats.failed += 1;
          log.warn({ msg: "session_analysis_failed", website_id: websiteId, session_id: sessionId, err: String(err) });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(config.concurrency, pending.length)) }, worker));
    return stats;
  }

  async summarizeTop(): Promise<SummaryRunStats> {
    const stats: SummaryRunStats = { generated: 0, skipped: 0, failed: 0, tokens: 0, costUsd: 0 };
    const { config, store } = this.deps;
    if (!this.summariesEnabled() || config.nightlyPerSite <= 0 || config.nightlyMaxTotal <= 0) return stats;
    const candidates = await store.listSummaryCandidates({
      since: new Date(this.now().getTime() - config.nightlyLookbackMs),
      minScore: config.nightlyMinScore,
      perSite: config.nightlyPerSite,
      limit: config.nightlyMaxTotal,
    });
    let consecutiveFailures = 0;
    for (const { websiteId, sessionId } of candidates) {
      // Breaker: a provider that is down would otherwise be called for every candidate.
      if (consecutiveFailures >= SUMMARY_BREAKER_THRESHOLD) {
        stats.skipped += 1;
        continue;
      }
      try {
        const session = await store.getSession(websiteId, sessionId);
        if (!session?.analysis) { stats.skipped += 1; continue; }
        const ensured = await this.ensureSummary(session, session.analysis);
        if (!ensured.generated) {
          if (ensured.status === "failed") stats.failed += 1;
          else stats.skipped += 1;
          continue;
        }
        stats.generated += 1;
        stats.tokens += ensured.tokens ?? 0;
        stats.costUsd += ensured.costUsd ?? 0;
        consecutiveFailures = ensured.modelFailed ? consecutiveFailures + 1 : 0;
        if (consecutiveFailures === SUMMARY_BREAKER_THRESHOLD) {
          log.error({ msg: "session_summary_model_breaker_open", remaining: candidates.length - stats.generated - stats.skipped - stats.failed });
        }
      } catch (err) {
        stats.failed += 1;
        log.warn({ msg: "session_summary_failed", website_id: websiteId, session_id: sessionId, err: String(err) });
      }
    }
    return stats;
  }
}

function metaOf(s: SessionWithAnalysis): Pick<SessionAnalysisView, "meta" | "startedAt"> {
  return {
    startedAt: s.startedAt.toISOString(),
    meta: {
      device: s.device,
      browser: s.browser,
      os: s.os,
      country: s.country,
      entryPage: s.entryPage,
      pagesViewed: s.pagesViewed,
      durationSeconds: s.durationSeconds,
    },
  };
}

function emptyView(sessionId: string, status: "pending" | "not_found"): SessionAnalysisView {
  return {
    sessionId,
    status,
    score: 0,
    counts: {},
    signals: [],
    timeline: null,
    computedAt: null,
    startedAt: null,
    meta: null,
    summary: null,
    summarySource: null,
    summaryStatus: "no_data",
  };
}
