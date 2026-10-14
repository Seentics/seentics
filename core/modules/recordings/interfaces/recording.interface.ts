/**
 * The recordings module's public surface.
 *
 * "Recording" is the domain term (and what the events are named); the HTTP path
 * stays `/api/v1/replays` and the storage stays `session_replays`, because both
 * are already depended on by the web client and by existing rows. The rename
 * stops at the module boundary on purpose — renaming a live API and a table is a
 * migration, not a refactor.
 *
 * Split by capability: the tracker's write path and the dashboard's read path have
 * nothing in common except the table, and no consumer needs both.
 */

import type { TrackerEvent } from "../../ingest/interfaces";
import type { FrustrationSignalType, SignalCounts } from "./session-analysis.interface";

/** Server-side narrowing for the session list. Every field is optional. */
export type SessionListFilters = {
  search?: string;
  device?: string;
  hasErrors?: boolean;
  hasRageClicks?: boolean;
  /** Only sessions that started within this many days. */
  days?: number;
  /** Only analysed sessions scoring at least this (0-100). */
  minFrustration?: number;
  /** Only analysed sessions with at least one signal of this type. */
  signal?: FrustrationSignalType;
  /** `recent` (default): newest first. `frustration`: highest score first, unanalysed last. */
  sort?: "recent" | "frustration";
  /** One of the session groups the list is browsed by (`SESSION_GROUPS`). */
  group?: SessionGroup;
};

/**
 * The groups the session list is browsed by: what kind of visit it was.
 *
 * A session can be in several (errors and rage clicks together); `smooth` is an analysed session
 * with no friction at all. Errors and rage clicks also count the ingest flags, so a session still
 * waiting for its analysis is grouped by those.
 */
export const SESSION_GROUPS = ["smooth", "errors", "rage", "dead_clicks", "forms", "u_turns", "thrash", "gave_up"] as const;
export type SessionGroup = (typeof SESSION_GROUPS)[number];

/** Totals over all sessions matching the filters, not just the current page. */
export type SessionListSummary = {
  total: number;
  withErrors: number;
  withRageClicks: number;
  avgDurationSeconds: number;
  /** Sessions in each group, under the same filters (a group filter itself aside). */
  groups: Record<SessionGroup, number>;
};

/** Summary of one recorded session, as the session list renders it. */
export type RecordingSummary = {
  sessionId: string;
  /** Whichever website identifier the rows were written under — see the note below. */
  websiteId: string;
  browser: string;
  device: string;
  os: string;
  country: string;
  entryPage: string;
  startedAt: string;
  hasRageClicks: boolean;
  hasErrors: boolean;
  durationSeconds: number;
  pagesViewed: number;
  /** 0-100 from the stored analysis; `null` until the session has been analysed. */
  frustrationScore: number | null;
  /** Signals found, by type; `null` until analysed. */
  signalCounts: SignalCounts | null;
  /**
   * One line saying what happened: the AI summary's first sentence, or the worst signal in plain
   * words. `null` until analysed, or when an analysed session had no friction.
   */
  summary: string | null;
  /** From the AI summary, when there is one. */
  outcome: "succeeded" | "struggled" | "abandoned" | null;
};

export type RecordingChunkUrl = {
  sequence: number;
  url: string;
  expires_at: string;
};

/** The session-list projection rendered in the player's header. */
export type RecordingDetailMeta = {
  sessionId: string;
  websiteId: string;
  browser: string;
  device: string;
  os: string;
  country: string;
  entryPage: string;
  startedAt: string;
  hasRageClicks: boolean;
  hasErrors: boolean;
  durationSeconds: number;
  pagesViewed: number;
};

type RecordingWarmChunk = { sequence: number; data: unknown; timestamp: string };

/**
 * The archived-stylesheet capability for this recording's site (`StylesheetAccess`). The
 * player points each stylesheet `<link>` at `/embed/:websiteId/stylesheet?url=…&st=<token>`
 * instead of the live site, whose hashed CSS files are gone after its next deploy.
 */
export type RecordingStylesheetAccess = {
  stylesheet_token?: string;
  stylesheet_token_expires_at?: string;
};

/** A recording response in each of its storage/readiness states. */
export type RecordingDetail =
  | {
      status: 200;
      body: {
        session_id: string;
        meta: RecordingDetailMeta | null;
        warm_chunks: RecordingWarmChunk[];
        recording_pending: false;
        replay_storage?: "legacy_inline";
      } & RecordingStylesheetAccess;
    }
  | {
      status: 200;
      body: {
        session_id: string;
        meta: RecordingDetailMeta | null;
        recording_pending: true;
        replay_storage?: "pending";
      } & RecordingStylesheetAccess;
    }
  | {
      status: 200;
      body: {
        session_id: string;
        meta: RecordingDetailMeta | null;
        replay_storage: "chunks";
        replay_chunk_count: number;
        replay_chunk_urls: RecordingChunkUrl[];
        warm_chunks?: RecordingWarmChunk[];
        recording_pending: false;
      } & RecordingStylesheetAccess;
    }
  | {
      status: 200;
      body: {
        session_id: string;
        meta: RecordingDetailMeta | null;
        replay_storage: "bundle";
        replay_url: string;
        replay_url_expires_at: string;
        recording_pending: false;
      } & RecordingStylesheetAccess;
    }
  | { status: 404; body: { error: string } };

/** Read access to recordings, for the dashboard. */
export interface RecordingQuery {
  /**
   * One page of recorded sessions, newest first.
   *
   * `limit` and `offset` are clamped by the implementation rather than trusted —
   * this is a paginated endpoint over a table that grows without bound.
   *
   * `total` counts every session matching `filters`, not just the returned page, so a
   * client can page and report a real count instead of the size of its own buffer.
   * Filtering is server-side for the same reason.
   */
  listSessions(
    websiteRef: string,
    limit: number,
    offset: number,
    filters?: SessionListFilters,
  ): Promise<{
    sessions: RecordingSummary[];
    limit: number;
    offset: number;
    total: number;
    /** Errors, rage clicks and mean duration over the whole filtered set. */
    summary: SessionListSummary;
  }>;

  /**
   * One recording, with a `status` the route passes straight through.
   *
   * Reports "not recorded yet" and "no such session" as results rather than
   * throwing: a session whose chunks are still uploading is a routine state the
   * player renders differently from an error, and conflating the two would show
   * users a failure for a recording that is simply still arriving.
   */
  getSessionDetail(
    websiteRef: string,
    sessionId: string,
  ): Promise<RecordingDetail>;
}

/** Deletion, kept separate so the read path cannot reach it. */
export interface RecordingMutations {
  /**
   * Delete recordings and their stored chunks.
   *
   * Best-effort across the batch: object storage and the database can disagree
   * after a partial failure, and refusing to delete the rest because one object
   * is already gone would leave the user unable to clear anything.
   */
  batchDelete(websiteRef: string, sessionIds: string[]): Promise<void>;
}


/**
 * The ingest write path.
 *
 * The recordings engine consumes raw tracker events; ingest holds this interface
 * rather than the engine, which is what removed its `recordingIngestService()` call — a
 * reach into this module's process-wide singleton that no test could substitute.
 */
export interface RecordingIngest {
  /** `batchId` is stable across redeliveries, so the metadata write can skip a repeat. */
  processEvents(batchId: string, events: TrackerEvent[]): Promise<void>;
}

/**
 * Reads for the raw API.
 *
 * Separate from `RecordingQuery` for the same reason as `HeatmapRawReads`: the raw API
 * is a data-export surface with its own projection. `app/http/public-api` used to import
 * `services/recording-session-list.service` directly.
 */
export interface RecordingRawReads {
  listSessionsRaw(
    websiteId: string,
    limit: number,
    offset: number,
  ): Promise<{
    /** Echoed back clamped, so the caller can see what it actually got. */
    limit: number;
    offset: number;
    /** Every session matching, not just this page. */
    total: number;
    /** Wire shape (snake_case) — this is a data-export surface. */
    sessions: Array<{
      session_id: string;
      website_id: string;
      browser: string;
      device: string;
      os: string;
      country: string;
      entry_page: string;
      started_at: string;
      duration_seconds: number;
      pages_viewed: number;
      has_rage_clicks: boolean;
      has_errors: boolean;
      /** From the session analysis; `null` until the session has been analysed. */
      frustration_score: number | null;
      signal_counts: SignalCounts | null;
      summary: string | null;
      outcome: "succeeded" | "struggled" | "abandoned" | null;
    }>;
  }>;
}

/**
 * One session's metadata row, as the repository reads it.
 *
 * Lived in `platform/contracts/types.ts` with the recordings repository as its only consumer —
 * a module's own storage shape in a shared file, which the boundary test could not see
 * because `platform/` is not a module. See `app/tests/module-boundaries.test.ts`.
 */
export type SessionMetaRow = {
  sessionId: string;
  websiteId: string;
  browser: string;
  device: string;
  os: string;
  country: string;
  entryPage: string;
  /** From SQL: driver may return `Date` or ISO string. */
  startedAt: Date | string;
  hasRageClicks: boolean;
  hasErrors: boolean;
  durationSeconds: number;
  pagesViewed: number;
  /** From the `session_analyses` join on the list read; absent elsewhere. */
  frustrationScore?: number | null;
  signalCounts?: SignalCounts | null;
  /** The AI summary's text and outcome, and the stored signals, for the one-line list summary. */
  summaryText?: string | null;
  summaryOutcome?: string | null;
  signals?: unknown;
};
