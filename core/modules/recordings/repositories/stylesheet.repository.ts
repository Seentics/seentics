import { sql as pgSql } from "../../../db";

/**
 * `replay_stylesheets` and `replay_stylesheet_backfill` (db/sql/059), and the session rows
 * the backfill walks.
 *
 * The only file that touches those tables. The archive service holds the
 * `StylesheetStore` port rather than these queries, so its state transitions are tested
 * without a database.
 */

export type StylesheetStatus = "pending" | "stored" | "failed" | "too_large" | "not_css";

export type StylesheetRow = {
  websiteId: string;
  urlHash: string;
  url: string;
  status: StylesheetStatus;
  storageKey: string | null;
  attempts: number;
};

export type ClaimedStylesheet = { websiteId: string; urlHash: string; url: string; attempts: number };

export type BackfillCursor = {
  cursorTs: Date;
  cursorWebsiteId: string;
  cursorSessionId: string;
  floorTs: Date;
};

export type BackfillSession = { websiteId: string; sessionId: string; startedAt: Date };

export interface StylesheetStore {
  /**
   * Record URLs as pending, unless the site already has `maxPending` waiting. A known URL
   * is left as it is, except that its `last_seen_at` is refreshed when a day old.
   * Returns rows newly inserted.
   */
  enqueue(websiteId: string, entries: { url: string; urlHash: string }[], maxPending: number): Promise<number>;
  get(websiteId: string, urlHash: string): Promise<StylesheetRow | null>;
  /**
   * Due pending rows, locked against other workers and pushed `leaseSeconds` into the
   * future, so a worker that dies mid-fetch gives them back when the lease runs out.
   */
  claimDue(limit: number, leaseSeconds: number): Promise<ClaimedStylesheet[]>;
  /** Whether the site already stores an object with this content. */
  hasContent(websiteId: string, contentSha256: string): Promise<boolean>;
  markStored(websiteId: string, urlHash: string, write: { storageKey: string; bytes: number; contentSha256: string }): Promise<void>;
  /** A terminal outcome: `failed`, `too_large` or `not_css`. */
  markFinal(websiteId: string, urlHash: string, status: Exclude<StylesheetStatus, "pending" | "stored">, attempts: number, error: string): Promise<void>;
  /** Still pending, tried again at `nextAttemptAt`. */
  scheduleRetry(websiteId: string, urlHash: string, attempts: number, nextAttemptAt: Date, error: string): Promise<void>;
  /** Rows of a site nothing has referenced since `before`, oldest first. */
  listUnseenSince(websiteId: string, before: Date, limit: number): Promise<{ urlHash: string; storageKey: string | null }[]>;
  /** Of `keys`, those still referenced by a row of the site outside `excludingHashes`. */
  keysStillReferenced(websiteId: string, keys: string[], excludingHashes: string[]): Promise<string[]>;
  deleteRows(websiteId: string, urlHashes: string[]): Promise<number>;
  /** The backfill position, or `null` once it is complete (or was never seeded). */
  backfillCursor(): Promise<BackfillCursor | null>;
  /** Sessions before the cursor and at or after the floor, newest first. */
  backfillSessions(cursor: BackfillCursor, limit: number): Promise<BackfillSession[]>;
  /** Move the cursor past `last`, or mark the backfill complete when `last` is null. */
  advanceBackfill(last: BackfillSession | null, scanned: number): Promise<void>;
}

type RawRow = {
  website_id: string;
  url_hash: string;
  url: string;
  status: StylesheetStatus;
  storage_key: string | null;
  attempts: number;
};

export class PostgresStylesheetStore implements StylesheetStore {
  async enqueue(websiteId: string, entries: { url: string; urlHash: string }[], maxPending: number): Promise<number> {
    if (entries.length === 0) return 0;
    const rows = await pgSql<{ inserted: boolean }[]>`
      INSERT INTO replay_stylesheets (website_id, url_hash, url)
      SELECT ${websiteId}, t.h, t.u
      FROM unnest(${entries.map((e) => e.urlHash)}::text[], ${entries.map((e) => e.url)}::text[]) AS t(h, u)
      WHERE (
        SELECT COUNT(*) FROM replay_stylesheets
        WHERE website_id = ${websiteId} AND status = 'pending'
      ) < ${maxPending}
      ON CONFLICT (website_id, url_hash) DO UPDATE SET last_seen_at = NOW()
        WHERE replay_stylesheets.last_seen_at < NOW() - INTERVAL '1 day'
      RETURNING (xmax = 0) AS inserted
    `;
    return rows.filter((r) => r.inserted).length;
  }

  async get(websiteId: string, urlHash: string): Promise<StylesheetRow | null> {
    const rows = await pgSql<RawRow[]>`
      SELECT website_id, url_hash, url, status, storage_key, attempts
      FROM replay_stylesheets
      WHERE website_id = ${websiteId} AND url_hash = ${urlHash}
    `;
    const r = rows[0];
    return r
      ? { websiteId: r.website_id, urlHash: r.url_hash, url: r.url, status: r.status, storageKey: r.storage_key, attempts: Number(r.attempts) }
      : null;
  }

  async claimDue(limit: number, leaseSeconds: number): Promise<ClaimedStylesheet[]> {
    const rows = await pgSql<RawRow[]>`
      WITH due AS (
        SELECT website_id, url_hash FROM replay_stylesheets
        WHERE status = 'pending' AND next_attempt_at <= NOW()
        ORDER BY next_attempt_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE replay_stylesheets s
      SET next_attempt_at = NOW() + make_interval(secs => ${leaseSeconds})
      FROM due
      WHERE s.website_id = due.website_id AND s.url_hash = due.url_hash
      RETURNING s.website_id, s.url_hash, s.url, s.status, s.storage_key, s.attempts
    `;
    return rows.map((r) => ({ websiteId: r.website_id, urlHash: r.url_hash, url: r.url, attempts: Number(r.attempts) }));
  }

  async hasContent(websiteId: string, contentSha256: string): Promise<boolean> {
    const rows = await pgSql<{ one: number }[]>`
      SELECT 1 AS one FROM replay_stylesheets
      WHERE website_id = ${websiteId} AND content_sha256 = ${contentSha256} AND status = 'stored'
      LIMIT 1
    `;
    return rows.length > 0;
  }

  async markStored(websiteId: string, urlHash: string, write: { storageKey: string; bytes: number; contentSha256: string }): Promise<void> {
    await pgSql`
      UPDATE replay_stylesheets
      SET status = 'stored', storage_key = ${write.storageKey}, bytes = ${write.bytes},
          content_sha256 = ${write.contentSha256}, fetched_at = NOW(),
          attempts = attempts + 1, last_error = NULL
      WHERE website_id = ${websiteId} AND url_hash = ${urlHash}
    `;
  }

  async markFinal(
    websiteId: string,
    urlHash: string,
    status: Exclude<StylesheetStatus, "pending" | "stored">,
    attempts: number,
    error: string,
  ): Promise<void> {
    await pgSql`
      UPDATE replay_stylesheets
      SET status = ${status}, attempts = ${attempts}, last_error = ${error.slice(0, 500)}, fetched_at = NOW()
      WHERE website_id = ${websiteId} AND url_hash = ${urlHash}
    `;
  }

  async scheduleRetry(websiteId: string, urlHash: string, attempts: number, nextAttemptAt: Date, error: string): Promise<void> {
    await pgSql`
      UPDATE replay_stylesheets
      SET attempts = ${attempts}, next_attempt_at = ${nextAttemptAt}, last_error = ${error.slice(0, 500)}
      WHERE website_id = ${websiteId} AND url_hash = ${urlHash}
    `;
  }

  async listUnseenSince(websiteId: string, before: Date, limit: number): Promise<{ urlHash: string; storageKey: string | null }[]> {
    const rows = await pgSql<{ url_hash: string; storage_key: string | null }[]>`
      SELECT url_hash, storage_key FROM replay_stylesheets
      WHERE website_id = ${websiteId} AND last_seen_at < ${before}
      ORDER BY last_seen_at
      LIMIT ${limit}
    `;
    return rows.map((r) => ({ urlHash: r.url_hash, storageKey: r.storage_key }));
  }

  async keysStillReferenced(websiteId: string, keys: string[], excludingHashes: string[]): Promise<string[]> {
    if (keys.length === 0) return [];
    const rows = await pgSql<{ storage_key: string }[]>`
      SELECT DISTINCT storage_key FROM replay_stylesheets
      WHERE website_id = ${websiteId}
        AND storage_key = ANY(${keys}::text[])
        AND NOT (url_hash = ANY(${excludingHashes}::text[]))
    `;
    return rows.map((r) => r.storage_key);
  }

  async deleteRows(websiteId: string, urlHashes: string[]): Promise<number> {
    if (urlHashes.length === 0) return 0;
    const rows = await pgSql<{ url_hash: string }[]>`
      DELETE FROM replay_stylesheets
      WHERE website_id = ${websiteId} AND url_hash = ANY(${urlHashes}::text[])
      RETURNING url_hash
    `;
    return rows.length;
  }

  async backfillCursor(): Promise<BackfillCursor | null> {
    const rows = await pgSql<{ cursor_ts: Date; cursor_website_id: string; cursor_session_id: string; floor_ts: Date }[]>`
      SELECT cursor_ts, cursor_website_id, cursor_session_id, floor_ts
      FROM replay_stylesheet_backfill
      WHERE id = 1 AND completed_at IS NULL
    `;
    const r = rows[0];
    return r
      ? { cursorTs: new Date(r.cursor_ts), cursorWebsiteId: r.cursor_website_id, cursorSessionId: r.cursor_session_id, floorTs: new Date(r.floor_ts) }
      : null;
  }

  async backfillSessions(cursor: BackfillCursor, limit: number): Promise<BackfillSession[]> {
    // Keyset, newest first, on the (timestamp) WHERE sequence = 0 index from db/sql/055.
    const rows = await pgSql<{ website_id: string; session_id: string; timestamp: Date }[]>`
      SELECT website_id, session_id, timestamp
      FROM session_replays
      WHERE sequence = 0
        AND timestamp <= ${cursor.cursorTs}
        AND timestamp >= ${cursor.floorTs}
        AND (timestamp, website_id, session_id) < (${cursor.cursorTs}::timestamptz, ${cursor.cursorWebsiteId}, ${cursor.cursorSessionId})
      ORDER BY timestamp DESC, website_id DESC, session_id DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({ websiteId: r.website_id, sessionId: r.session_id, startedAt: new Date(r.timestamp) }));
  }

  async advanceBackfill(last: BackfillSession | null, scanned: number): Promise<void> {
    if (!last) {
      await pgSql`
        UPDATE replay_stylesheet_backfill
        SET completed_at = NOW(), sessions_scanned = sessions_scanned + ${scanned}
        WHERE id = 1
      `;
      return;
    }
    await pgSql`
      UPDATE replay_stylesheet_backfill
      SET cursor_ts = ${last.startedAt}, cursor_website_id = ${last.websiteId},
          cursor_session_id = ${last.sessionId}, sessions_scanned = sessions_scanned + ${scanned}
      WHERE id = 1
    `;
  }
}
