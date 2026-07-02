import { sql as pgSql, db, sessionReplays } from "../db";
import { sql as dsql } from "drizzle-orm";
import type { SessionMetaRow } from "./types";

export type SessionUpsertRow = {
  websiteId: string;
  sessionId: string;
  tsMs: number;
  latestEventMs: number;
  browser: string;
  device: string;
  os: string;
  country: string;
  entryPage: string;
  /** URL changes within this (sorted) batch — pages = transitions + entry page. */
  urlTransitions: number;
  /** First/last normalized page URL of the batch, for cross-batch boundary detection. */
  firstUrl: string;
  lastUrl: string;
  durationSeconds: number;
  hasRageClicks: boolean;
  hasErrors: boolean;
};

/**
 * Merge two upsert rows for the SAME session. Needed because Postgres rejects an
 * INSERT ... ON CONFLICT that touches the same row twice ("cannot affect row a
 * second time") — one duplicate would discard the whole batch.
 */
function mergeSessionRows(a: SessionUpsertRow, b: SessionUpsertRow): SessionUpsertRow {
  const [x, y] = a.tsMs <= b.tsMs ? [a, b] : [b, a];
  const boundary = x.lastUrl && y.firstUrl && x.lastUrl !== y.firstUrl ? 1 : 0;
  const pick = (p: string, q: string) => (p && p !== "Unknown" ? p : q);
  return {
    websiteId: x.websiteId,
    sessionId: x.sessionId,
    tsMs: x.tsMs,
    latestEventMs: Math.max(x.latestEventMs, y.latestEventMs),
    browser: pick(x.browser, y.browser),
    device: pick(x.device, y.device),
    os: pick(x.os, y.os),
    country: x.country || y.country,
    entryPage: x.entryPage || y.entryPage,
    urlTransitions: x.urlTransitions + y.urlTransitions + boundary,
    firstUrl: x.firstUrl || y.firstUrl,
    lastUrl: y.lastUrl || x.lastUrl,
    durationSeconds: Math.max(x.durationSeconds, y.durationSeconds),
    hasRageClicks: x.hasRageClicks || y.hasRageClicks,
    hasErrors: x.hasErrors || y.hasErrors,
  };
}

/** Mirrors Go UpsertSessionMetaBatch (sequence=0 metadata row). Batch insert/upsert in one query. */
export async function upsertSessionMetaBatch(inputRows: SessionUpsertRow[]): Promise<void> {
  if (inputRows.length === 0) return;

  const byKey = new Map<string, SessionUpsertRow>();
  for (const row of inputRows) {
    const k = `${row.websiteId}\0${row.sessionId}`;
    const prev = byKey.get(k);
    byKey.set(k, prev ? mergeSessionRows(prev, row) : row);
  }
  const rows = [...byKey.values()];

  const values = rows.map((row) => {
    const endMs = row.latestEventMs || row.tsMs;
    return {
      websiteId: String(row.websiteId ?? ""),
      sessionId: String(row.sessionId ?? ""),
      sequence: 0 as const,
      data: {
        _snc_re_end: endMs,
        _snc_re_fu: String(row.firstUrl ?? ""),
        _snc_re_lu: String(row.lastUrl ?? ""),
      } as Record<string, unknown>,
      browser: String(row.browser ?? ""),
      device: String(row.device ?? ""),
      os: String(row.os ?? ""),
      country: String(row.country ?? ""),
      entryPage: String(row.entryPage ?? ""),
      timestamp: new Date(row.tsMs),
      // New session: entry page + URL transitions within the batch.
      pagesViewed: (Number(row.urlTransitions) || 0) + 1,
      durationSeconds: Number(row.durationSeconds) || 0,
      hasRageClicks: row.hasRageClicks === true,
      hasErrors: row.hasErrors === true,
    };
  });

  await db
    .insert(sessionReplays)
    .values(values)
    .onConflictDoUpdate({
      target: [sessionReplays.websiteId, sessionReplays.sessionId, sessionReplays.sequence],
      set: {
        durationSeconds: dsql.raw(`GREATEST(
          session_replays.duration_seconds,
          excluded.duration_seconds,
          GREATEST(0, EXTRACT(EPOCH FROM (
            COALESCE(
              CASE WHEN excluded.data ? '_snc_re_end' THEN
                to_timestamp((excluded.data->>'_snc_re_end')::bigint / 1000.0)
              ELSE NULL END,
              excluded.timestamp
            ) - session_replays.timestamp
          ))::INT)
        )`),
        /**
         * Existing session: add this batch's transitions (excluded.pages_viewed − 1;
         * the +1 entry page only applies on first insert) plus 1 if the page changed
         * exactly at the batch boundary (previous batch's last URL ≠ this batch's first).
         */
        pagesViewed: dsql.raw(`session_replays.pages_viewed
          + GREATEST(excluded.pages_viewed - 1, 0)
          + CASE WHEN COALESCE(session_replays.data->>'_snc_re_lu','') <> ''
                  AND COALESCE(excluded.data->>'_snc_re_fu','') <> ''
                  AND session_replays.data->>'_snc_re_lu' <> excluded.data->>'_snc_re_fu'
             THEN 1 ELSE 0 END`),
        /** Carry _snc_re_lu/_snc_re_fu forward so the next batch's boundary check compares against THIS batch. */
        data: dsql.raw("excluded.data"),
        hasRageClicks: dsql.raw(
          "CASE WHEN excluded.has_rage_clicks THEN TRUE ELSE session_replays.has_rage_clicks END",
        ),
        hasErrors: dsql.raw(
          "CASE WHEN excluded.has_errors THEN TRUE ELSE session_replays.has_errors END",
        ),
        browser: dsql.raw(
          "CASE WHEN excluded.browser <> '' THEN excluded.browser ELSE session_replays.browser END",
        ),
        device: dsql.raw(
          "CASE WHEN excluded.device <> '' THEN excluded.device ELSE session_replays.device END",
        ),
        os: dsql.raw("CASE WHEN excluded.os <> '' THEN excluded.os ELSE session_replays.os END"),
        country: dsql.raw(
          "CASE WHEN excluded.country <> '' THEN excluded.country ELSE session_replays.country END",
        ),
        entryPage: dsql.raw(
          "CASE WHEN excluded.entry_page <> '' THEN excluded.entry_page ELSE session_replays.entry_page END",
        ),
      },
    });
}

export async function listSessions(
  siteId: string,
  uuidStr: string,
  limit: number,
  offset: number,
): Promise<SessionMetaRow[]> {
  return pgSql<SessionMetaRow[]>`
    SELECT * FROM (
      SELECT DISTINCT ON ("sessionId")
        session_id AS "sessionId", website_id AS "websiteId",
        COALESCE(browser,'') AS browser, COALESCE(device,'') AS device, COALESCE(os,'') AS os,
        COALESCE(country,'') AS country, COALESCE(entry_page,'') AS "entryPage",
        timestamp AS "startedAt", has_rage_clicks AS "hasRageClicks", has_errors AS "hasErrors",
        duration_seconds AS "durationSeconds", pages_viewed AS "pagesViewed"
      FROM (
        SELECT * FROM session_replays WHERE website_id = ${siteId} AND sequence = 0
        UNION ALL
        SELECT * FROM session_replays WHERE website_id = ${uuidStr} AND sequence = 0 AND ${uuidStr} <> ${siteId}
      ) raw
      ORDER BY "sessionId", timestamp DESC
    ) deduped
    ORDER BY "startedAt" DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function getSessionMeta(
  siteId: string,
  uuidStr: string,
  sessionId: string,
): Promise<SessionMetaRow | null> {
  /**
   * One row per (website_id, session_id, sequence=0). Match either resolved id
   * (short `site_id` or UUID) so list + detail never disagree. Avoid `UNION … LIMIT 1`
   * edge cases with driver/PLAN behavior.
   */
  const rows = await pgSql<SessionMetaRow[]>`
    SELECT session_id as "sessionId", website_id as "websiteId",
      COALESCE(browser,'') as browser, COALESCE(device,'') as device, COALESCE(os,'') as os,
      COALESCE(country,'') as country, COALESCE(entry_page,'') as "entryPage",
      timestamp as "startedAt", has_rage_clicks as "hasRageClicks", has_errors as "hasErrors",
      duration_seconds as "durationSeconds", pages_viewed as "pagesViewed"
    FROM session_replays
    WHERE session_id = ${sessionId} AND sequence = 0
      AND (website_id = ${siteId} OR website_id = ${uuidStr})
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function deleteSessionByEitherId(
  primaryId: string,
  fallbackId: string,
  sessionId: string,
): Promise<void> {
  await pgSql`
    DELETE FROM session_replays
    WHERE (website_id = ${primaryId} OR website_id = ${fallbackId}) AND session_id = ${sessionId}
  `;
}
