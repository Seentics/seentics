import { sql } from "../db";
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

/** Mirrors Go UpsertSessionMetaBatch (sequence=0 metadata row). */
export async function upsertSessionMetaBatch(rows: SessionUpsertRow[]): Promise<void> {
  if (rows.length === 0) return;

  for (const row of rows) {
    const endMs = row.latestEventMs || row.tsMs;
    const ts = new Date(row.tsMs);
    const dataObj: { _snc_re_end: number } = { _snc_re_end: endMs };
    await sql`
      INSERT INTO session_replays (
        website_id, session_id, sequence, data,
        browser, device, os, country, entry_page,
        timestamp, pages_viewed, duration_seconds, has_rage_clicks, has_errors
      ) VALUES (
        ${row.websiteId},
        ${row.sessionId},
        0,
        ${sql.json(dataObj)},
        ${row.browser},
        ${row.device},
        ${row.os},
        ${row.country},
        ${row.entryPage},
        ${ts},
        ${row.pageIncrements},
        ${row.durationSeconds},
        ${row.hasRageClicks},
        ${row.hasErrors}
      )
      ON CONFLICT (website_id, session_id, sequence) DO UPDATE SET
        duration_seconds = GREATEST(
          session_replays.duration_seconds,
          EXCLUDED.duration_seconds,
          GREATEST(0, EXTRACT(EPOCH FROM (
            COALESCE(
              CASE WHEN EXCLUDED.data ? '_snc_re_end' THEN
                to_timestamp((EXCLUDED.data->>'_snc_re_end')::bigint / 1000.0)
              ELSE NULL END,
              EXCLUDED.timestamp
            ) - session_replays.timestamp
          ))::INT)
        ),
        pages_viewed = session_replays.pages_viewed + EXCLUDED.pages_viewed,
        has_rage_clicks = CASE WHEN EXCLUDED.has_rage_clicks THEN TRUE ELSE session_replays.has_rage_clicks END,
        has_errors = CASE WHEN EXCLUDED.has_errors THEN TRUE ELSE session_replays.has_errors END,
        browser = CASE WHEN EXCLUDED.browser <> '' THEN EXCLUDED.browser ELSE session_replays.browser END,
        device = CASE WHEN EXCLUDED.device <> '' THEN EXCLUDED.device ELSE session_replays.device END,
        os = CASE WHEN EXCLUDED.os <> '' THEN EXCLUDED.os ELSE session_replays.os END,
        country = CASE WHEN EXCLUDED.country <> '' THEN EXCLUDED.country ELSE session_replays.country END,
        entry_page = CASE WHEN EXCLUDED.entry_page <> '' THEN EXCLUDED.entry_page ELSE session_replays.entry_page END
    `;
  }
}

export async function listSessions(
  siteId: string,
  uuidStr: string,
  limit: number,
  offset: number,
): Promise<SessionMetaRow[]> {
  return sql<SessionMetaRow[]>`
    SELECT * FROM (
      SELECT session_id as "sessionId", website_id as "websiteId",
        COALESCE(browser,'') as browser, COALESCE(device,'') as device, COALESCE(os,'') as os,
        COALESCE(country,'') as country, COALESCE(entry_page,'') as "entryPage",
        timestamp as "startedAt", has_rage_clicks as "hasRageClicks", has_errors as "hasErrors",
        duration_seconds as "durationSeconds", pages_viewed as "pagesViewed"
      FROM session_replays
      WHERE website_id = ${siteId} AND sequence = 0
    UNION ALL
    SELECT session_id AS "sessionId", website_id AS "websiteId",
      COALESCE(browser,'') AS browser, COALESCE(device,'') AS device, COALESCE(os,'') AS os,
      COALESCE(country,'') AS country, COALESCE(entry_page,'') AS "entryPage",
      timestamp AS "startedAt", has_rage_clicks AS "hasRageClicks", has_errors AS "hasErrors",
      duration_seconds AS "durationSeconds", pages_viewed AS "pagesViewed"
    FROM session_replays
    WHERE website_id = ${uuidStr} AND sequence = 0 AND ${uuidStr} <> ${siteId}
    ) t
    ORDER BY t."startedAt" DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function getSessionMeta(
  siteId: string,
  uuidStr: string,
  sessionId: string,
): Promise<SessionMetaRow | null> {
  const rows = await sql<SessionMetaRow[]>`
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
  await sql`
    DELETE FROM session_replays
    WHERE (website_id = ${primaryId} OR website_id = ${fallbackId}) AND session_id = ${sessionId}
  `;
}
