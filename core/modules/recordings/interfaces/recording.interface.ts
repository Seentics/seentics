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

import type { TrackerEvent } from "../../../platform/lib/types";

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
};

/**
 * A recording ready for playback.
 *
 * Re-exported from the service rather than restated here. The real shape is a
 * four-way discriminated union — pending, chunked, bundled, or missing — that
 * encodes how the recording is stored and whether it is ready. Restating it in the
 * interface would mean maintaining two copies of a contract the player parses
 * byte-for-byte, and the copy would drift.
 */
export type { ReplaySessionDetail as RecordingDetail } from "../services/session-detail.service";

/** Read access to recordings, for the dashboard. */
export interface RecordingQuery {
  /**
   * Recorded sessions for a website, newest first.
   *
   * `limit` and `offset` are clamped by the implementation rather than trusted —
   * this is a paginated endpoint over a table that grows without bound.
   */
  listSessions(
    websiteRef: string,
    limit: number,
    offset: number,
  ): Promise<{ sessions: RecordingSummary[]; limit: number; offset: number }>;

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
  ): Promise<import("../services/session-detail.service").ReplaySessionDetail>;
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
 * rather than the engine, which is what removed its `getReplayEngine()` call — a
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
 * is a data-export surface with its own projection. `platform/raw-data` used to import
 * `services/session-list.service` directly.
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
    }>;
  }>;
}
