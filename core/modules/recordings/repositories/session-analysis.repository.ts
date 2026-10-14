import { sql as pgSql } from "../../../db";
import type {
  FrustratedSessionRow,
  FrustrationSignal,
  FrustrationSignalType,
  SessionSummary,
  SessionTimeline,
  SignalCounts,
} from "../interfaces";

/**
 * `session_analyses` (db/sql/055), and the session rows it is computed from.
 *
 * The only file that touches that table. The service holds the `SessionAnalysisStore`
 * port rather than these functions, so its cooldown and caching rules are tested without
 * a database.
 */

export type AnalysisStatus = "ready" | "empty" | "failed";

export type StoredAnalysis = {
  status: AnalysisStatus;
  score: number;
  counts: SignalCounts;
  signals: FrustrationSignal[];
  timeline: SessionTimeline | null;
  analyzedThroughMs: number;
  computedAt: Date;
  summary: SessionSummary | null;
  summarySource: "ai" | "rules" | null;
  summaryModel: string | null;
  summaryGeneratedAt: Date | null;
  summaryAnalysisAt: Date | null;
  summaryAttemptedAt: Date | null;
};

export type SessionWithAnalysis = {
  websiteId: string;
  sessionId: string;
  startedAt: Date;
  /** Epoch ms of the session's last event, from the metadata row. */
  endMs: number;
  browser: string;
  device: string;
  os: string;
  country: string;
  entryPage: string;
  pagesViewed: number;
  durationSeconds: number;
  analysis: StoredAnalysis | null;
};

export type AnalysisWrite = {
  websiteId: string;
  sessionId: string;
  startedAt: Date;
  status: AnalysisStatus;
  score: number;
  counts: SignalCounts;
  signals: FrustrationSignal[];
  timeline: SessionTimeline | null;
  analyzedThroughMs: number;
};

export type SummaryWrite = {
  summary: SessionSummary;
  source: "ai" | "rules";
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  /** `computed_at` of the analysis the summary was written from. */
  analysisAt: Date;
};

export interface SessionAnalysisStore {
  getSession(websiteId: string, sessionId: string): Promise<SessionWithAnalysis | null>;
  /** Upsert the signals, keeping any summary. Returns the stored `computed_at`. */
  saveAnalysis(row: AnalysisWrite): Promise<Date>;
  /**
   * Mark a summary attempt, unless one was made after `notAttemptedSince`. True when this
   * caller won: the cooldown and the guard against two requests paying for one summary.
   */
  claimSummary(websiteId: string, sessionId: string, notAttemptedSince: Date): Promise<boolean>;
  saveSummary(websiteId: string, sessionId: string, write: SummaryWrite): Promise<void>;
  /** Model-written summaries for the site since `since` — the daily allowance. */
  countSummariesSince(websiteId: string, since: Date): Promise<number>;
  /** Sessions that started after `since`, went quiet before `idleBeforeMs`, and have no current analysis. */
  listPending(opts: { since: Date; idleBeforeMs: number; limit: number }): Promise<Array<{ websiteId: string; sessionId: string }>>;
  listFrustrated(
    websiteId: string,
    opts: { since: Date; signal?: FrustrationSignalType; minScore: number; limit: number },
  ): Promise<FrustratedSessionRow[]>;
  /** The `perSite` worst unsummarised sessions per site since `since`, worst first, `limit` in all. */
  listSummaryCandidates(opts: { since: Date; minScore: number; perSite: number; limit: number }): Promise<Array<{ websiteId: string; sessionId: string }>>;
}

const asDate = (v: unknown): Date | null => (v == null ? null : v instanceof Date ? v : new Date(String(v)));

function parseJson<T>(v: unknown, fallback: T): T {
  if (v == null) return fallback;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return v as T;
}

/** Epoch ms of a session's last event, as the ingest upsert records it, or start + duration on older rows. */
const END_MS = pgSql`COALESCE(
  CASE WHEN jsonb_typeof(s.data->'_snc_re_end') = 'number' THEN (s.data->>'_snc_re_end')::float8 END,
  EXTRACT(EPOCH FROM s.timestamp) * 1000 + s.duration_seconds * 1000
)`;

type JoinedRow = Record<string, unknown>;

function toSession(r: JoinedRow): SessionWithAnalysis {
  const analysed = r.a_status != null;
  return {
    websiteId: String(r.website_id),
    sessionId: String(r.session_id),
    startedAt: asDate(r.started_at) ?? new Date(0),
    endMs: Number(r.end_ms) || 0,
    browser: String(r.browser ?? ""),
    device: String(r.device ?? ""),
    os: String(r.os ?? ""),
    country: String(r.country ?? ""),
    entryPage: String(r.entry_page ?? ""),
    pagesViewed: Number(r.pages_viewed) || 0,
    durationSeconds: Number(r.duration_seconds) || 0,
    analysis: analysed
      ? {
          status: r.a_status as AnalysisStatus,
          score: Number(r.frustration_score) || 0,
          counts: parseJson<SignalCounts>(r.signal_counts, {}),
          signals: parseJson<FrustrationSignal[]>(r.signals, []),
          timeline: parseJson<SessionTimeline | null>(r.timeline, null),
          analyzedThroughMs: Number(r.analyzed_through_ms) || 0,
          computedAt: asDate(r.computed_at) ?? new Date(0),
          summary: parseJson<SessionSummary | null>(r.summary, null),
          summarySource: r.summary_source === "ai" ? "ai" : r.summary_source === "rules" ? "rules" : null,
          summaryModel: (r.summary_model as string | null) ?? null,
          summaryGeneratedAt: asDate(r.summary_generated_at),
          summaryAnalysisAt: asDate(r.summary_analysis_at),
          summaryAttemptedAt: asDate(r.summary_attempted_at),
        }
      : null,
  };
}

export class PostgresSessionAnalysisStore implements SessionAnalysisStore {
  async getSession(websiteId: string, sessionId: string): Promise<SessionWithAnalysis | null> {
    const rows = await pgSql<JoinedRow[]>`
      SELECT s.website_id, s.session_id, s.timestamp AS started_at, ${END_MS} AS end_ms,
        COALESCE(s.browser,'') AS browser, COALESCE(s.device,'') AS device, COALESCE(s.os,'') AS os,
        COALESCE(s.country,'') AS country, COALESCE(s.entry_page,'') AS entry_page,
        s.pages_viewed, s.duration_seconds,
        a.status AS a_status, a.frustration_score, a.signal_counts, a.signals, a.timeline,
        a.analyzed_through_ms::float8 AS analyzed_through_ms, a.computed_at,
        a.summary, a.summary_source, a.summary_model, a.summary_generated_at,
        a.summary_analysis_at, a.summary_attempted_at
      FROM session_replays s
      LEFT JOIN session_analyses a ON a.website_id = s.website_id AND a.session_id = s.session_id
      WHERE s.website_id = ${websiteId} AND s.session_id = ${sessionId} AND s.sequence = 0
      LIMIT 1
    `;
    return rows[0] ? toSession(rows[0]) : null;
  }

  async saveAnalysis(row: AnalysisWrite): Promise<Date> {
    const rows = await pgSql<{ computed_at: Date }[]>`
      INSERT INTO session_analyses (
        website_id, session_id, started_at, status, frustration_score, signal_counts, signals,
        timeline, analyzed_through_ms, computed_at
      ) VALUES (
        ${row.websiteId}, ${row.sessionId}, ${row.startedAt}, ${row.status}, ${row.score},
        ${JSON.stringify(row.counts)}::jsonb, ${JSON.stringify(row.signals)}::jsonb,
        ${JSON.stringify(row.timeline ?? {})}::jsonb, ${Math.trunc(row.analyzedThroughMs)}, NOW()
      )
      ON CONFLICT (website_id, session_id) DO UPDATE SET
        started_at = EXCLUDED.started_at,
        status = EXCLUDED.status,
        frustration_score = EXCLUDED.frustration_score,
        signal_counts = EXCLUDED.signal_counts,
        signals = EXCLUDED.signals,
        timeline = EXCLUDED.timeline,
        analyzed_through_ms = EXCLUDED.analyzed_through_ms,
        computed_at = NOW()
      RETURNING computed_at
    `;
    return asDate(rows[0]?.computed_at) ?? new Date();
  }

  async claimSummary(websiteId: string, sessionId: string, notAttemptedSince: Date): Promise<boolean> {
    const rows = await pgSql`
      UPDATE session_analyses SET summary_attempted_at = NOW()
      WHERE website_id = ${websiteId} AND session_id = ${sessionId}
        AND (summary_attempted_at IS NULL OR summary_attempted_at < ${notAttemptedSince})
      RETURNING 1
    `;
    return rows.length > 0;
  }

  async saveSummary(websiteId: string, sessionId: string, w: SummaryWrite): Promise<void> {
    await pgSql`
      UPDATE session_analyses SET
        summary = ${JSON.stringify(w.summary)}::jsonb,
        summary_source = ${w.source},
        summary_model = ${w.model},
        summary_input_tokens = ${w.inputTokens},
        summary_output_tokens = ${w.outputTokens},
        summary_cost_usd = ${w.costUsd.toFixed(6)},
        summary_generated_at = NOW(),
        summary_analysis_at = ${w.analysisAt}
      WHERE website_id = ${websiteId} AND session_id = ${sessionId}
    `;
  }

  async countSummariesSince(websiteId: string, since: Date): Promise<number> {
    const rows = await pgSql<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM session_analyses
      WHERE website_id = ${websiteId} AND summary_generated_at >= ${since} AND summary_model IS NOT NULL
    `;
    return rows[0]?.n ?? 0;
  }

  async listPending(opts: { since: Date; idleBeforeMs: number; limit: number }) {
    const rows = await pgSql<{ website_id: string; session_id: string }[]>`
      SELECT s.website_id, s.session_id
      FROM session_replays s
      LEFT JOIN session_analyses a ON a.website_id = s.website_id AND a.session_id = s.session_id
      WHERE s.sequence = 0
        AND s.timestamp >= ${opts.since}
        AND ${END_MS} < ${opts.idleBeforeMs}
        AND (a.session_id IS NULL OR a.analyzed_through_ms < ${END_MS})
      ORDER BY s.timestamp DESC
      LIMIT ${opts.limit}
    `;
    return rows.map((r) => ({ websiteId: r.website_id, sessionId: r.session_id }));
  }

  async listFrustrated(
    websiteId: string,
    opts: { since: Date; signal?: FrustrationSignalType; minScore: number; limit: number },
  ): Promise<FrustratedSessionRow[]> {
    const signal = opts.signal
      ? pgSql`AND COALESCE((a.signal_counts->>${opts.signal})::int, 0) > 0`
      : pgSql``;
    const rows = await pgSql<JoinedRow[]>`
      SELECT a.session_id, a.started_at, a.frustration_score, a.signal_counts,
        a.summary->>'text' AS summary_text, a.summary->>'outcome' AS outcome,
        COALESCE(s.device,'') AS device, COALESCE(s.browser,'') AS browser,
        COALESCE(s.country,'') AS country, COALESCE(s.entry_page,'') AS entry_page,
        COALESCE(s.duration_seconds, 0) AS duration_seconds, COALESCE(s.pages_viewed, 0) AS pages_viewed
      FROM session_analyses a
      JOIN session_replays s ON s.website_id = a.website_id AND s.session_id = a.session_id AND s.sequence = 0
      WHERE a.website_id = ${websiteId}
        AND a.frustration_score > 0
        AND a.frustration_score >= ${opts.minScore}
        AND a.started_at >= ${opts.since}
        ${signal}
      ORDER BY a.frustration_score DESC, a.started_at DESC
      LIMIT ${opts.limit}
    `;
    return rows.map((r) => ({
      sessionId: String(r.session_id),
      startedAt: (asDate(r.started_at) ?? new Date(0)).toISOString(),
      score: Number(r.frustration_score) || 0,
      counts: parseJson<SignalCounts>(r.signal_counts, {}),
      device: String(r.device),
      browser: String(r.browser),
      country: String(r.country),
      entryPage: String(r.entry_page),
      durationSeconds: Number(r.duration_seconds) || 0,
      pagesViewed: Number(r.pages_viewed) || 0,
      summary: typeof r.summary_text === "string" ? r.summary_text : null,
      outcome: r.outcome === "succeeded" || r.outcome === "struggled" || r.outcome === "abandoned" ? r.outcome : null,
    }));
  }

  async listSummaryCandidates(opts: { since: Date; minScore: number; perSite: number; limit: number }) {
    const rows = await pgSql<{ website_id: string; session_id: string }[]>`
      SELECT website_id, session_id FROM (
        SELECT website_id, session_id, frustration_score,
          ROW_NUMBER() OVER (PARTITION BY website_id ORDER BY frustration_score DESC, started_at DESC) AS rank
        FROM session_analyses
        WHERE status = 'ready'
          AND frustration_score >= ${opts.minScore}
          AND started_at >= ${opts.since}
          -- Millisecond precision: summary_analysis_at is written back from a JS Date.
          AND (summary IS NULL OR summary_analysis_at < date_trunc('milliseconds', computed_at)
               OR (summary_source = 'rules' AND summary_model IS NULL))
      ) ranked
      WHERE rank <= ${opts.perSite}
      ORDER BY frustration_score DESC
      LIMIT ${opts.limit}
    `;
    return rows.map((r) => ({ websiteId: r.website_id, sessionId: r.session_id }));
  }
}
