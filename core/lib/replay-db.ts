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
  pageIncrements: number;
  durationSeconds: number;
  hasRageClicks: boolean;
  hasErrors: boolean;
};

/** Mirrors Go UpsertSessionMetaBatch (sequence=0 metadata row). Batch insert/upsert in one query. */
export async function upsertSessionMetaBatch(rows: SessionUpsertRow[]): Promise<void> {
  if (rows.length === 0) return;

  const values = rows.map((row) => {
    const endMs = row.latestEventMs || row.tsMs;
    return {
      websiteId: String(row.websiteId ?? ""),
      sessionId: String(row.sessionId ?? ""),
      sequence: 0 as const,
      data: { _snc_re_end: endMs } as Record<string, unknown>,
      browser: String(row.browser ?? ""),
      device: String(row.device ?? ""),
      os: String(row.os ?? ""),
      country: String(row.country ?? ""),
      entryPage: String(row.entryPage ?? ""),
      timestamp: new Date(row.tsMs),
      pagesViewed: Number(row.pageIncrements) || 0,
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
        pagesViewed: dsql.raw("session_replays.pages_viewed + excluded.pages_viewed"),
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
  const rows = await pgSql<SessionMetaRow[]>`
    SELECT session_id as "sessionId", website_id as "websiteId",
      COALESCE(browser,'') as browser, COALESCE(device,'') as device, COALESCE(os,'') as os,
      COALESCE(country,'') as country, COALESCE(entry_page,'') as "entryPage",
      timestamp as "startedAt", has_rage_clicks as "hasRageClicks", has_errors as "hasErrors",
      duration_seconds as "durationSeconds", pages_viewed as "pagesViewed"
    FROM session_replays
    WHERE website_id = ${siteId} AND session_id = ${sessionId} AND sequence = 0
    UNION ALL
    SELECT session_id AS "sessionId", website_id AS "websiteId",
      COALESCE(browser,'') AS browser, COALESCE(device,'') AS device, COALESCE(os,'') AS os,
      COALESCE(country,'') AS country, COALESCE(entry_page,'') AS "entryPage",
      timestamp AS "startedAt", has_rage_clicks AS "hasRageClicks", has_errors AS "hasErrors",
      duration_seconds AS "durationSeconds", pages_viewed AS "pagesViewed"
    FROM session_replays
    WHERE website_id = ${uuidStr} AND session_id = ${sessionId} AND sequence = 0 AND ${uuidStr} <> ${siteId}
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
