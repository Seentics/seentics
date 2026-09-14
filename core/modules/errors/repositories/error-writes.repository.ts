import { sql } from "../../../db";

/** One occurrence, already fingerprinted and normalised by the ingest service. */
export type ErrorRow = {
  websiteId: string;
  fingerprint: string;
  kind: string;
  message: string;
  stack: string;
  sourceFile: string;
  lineNo: number | null;
  colNo: number | null;
  pagePath: string;
  sessionId: string | null;
  visitorId: string | null;
  browser: string;
  os: string;
  deviceType: string;
  occurredAt: Date;
};

/**
 * Raise the group counts for a batch, creating groups that are new.
 *
 * One statement for the whole batch rather than one per row. A page throwing in a render
 * loop sends several occurrences of one fault in a single flush, and `ON CONFLICT` on the
 * same key repeated within one `VALUES` list would raise
 * "cannot affect row a second time" — so the rows are folded by fingerprint first, in
 * memory, and the accumulated count is added in one go.
 *
 * `message`, `last_page_path` and the location follow the most recent occurrence:
 * a fault's newest example is the one worth showing, and `GREATEST` on `last_seen` keeps
 * that true even if a batch arrives out of order.
 */
export async function upsertErrorGroups(rows: readonly ErrorRow[]): Promise<void> {
  if (rows.length === 0) return;

  type Folded = { row: ErrorRow; count: number };
  const byKey = new Map<string, Folded>();
  for (const row of rows) {
    const key = `${row.websiteId}\0${row.fingerprint}`;
    const seen = byKey.get(key);
    if (!seen) {
      byKey.set(key, { row, count: 1 });
      continue;
    }
    seen.count++;
    // Keep the newest occurrence as the representative sample.
    if (row.occurredAt > seen.row.occurredAt) seen.row = row;
  }

  const values = [...byKey.values()];
  await sql`
    INSERT INTO error_groups
      (website_id, fingerprint, kind, message, source_file, line_no, col_no,
       last_page_path, event_count, first_seen, last_seen)
    SELECT
      (v->>'website_id')::uuid,
      v->>'fingerprint',
      v->>'kind',
      v->>'message',
      v->>'source_file',
      NULLIF(v->>'line_no', '')::int,
      NULLIF(v->>'col_no', '')::int,
      v->>'last_page_path',
      (v->>'count')::int,
      (v->>'occurred_at')::timestamptz,
      (v->>'occurred_at')::timestamptz
    FROM jsonb_array_elements(${JSON.stringify(
      values.map(({ row, count }) => ({
        website_id: row.websiteId,
        fingerprint: row.fingerprint,
        kind: row.kind,
        message: row.message,
        source_file: row.sourceFile,
        line_no: row.lineNo == null ? "" : String(row.lineNo),
        col_no: row.colNo == null ? "" : String(row.colNo),
        last_page_path: row.pagePath,
        count: String(count),
        occurred_at: row.occurredAt.toISOString(),
      })),
    )}::jsonb) AS v
    ON CONFLICT (website_id, fingerprint) DO UPDATE SET
      event_count = error_groups.event_count + EXCLUDED.event_count,
      last_seen   = GREATEST(error_groups.last_seen, EXCLUDED.last_seen),
      -- Only when this batch is actually newer, so an out-of-order flush cannot
      -- replace a current sample with a stale one.
      message        = CASE WHEN EXCLUDED.last_seen >= error_groups.last_seen
                            THEN EXCLUDED.message ELSE error_groups.message END,
      source_file    = CASE WHEN EXCLUDED.last_seen >= error_groups.last_seen
                            THEN EXCLUDED.source_file ELSE error_groups.source_file END,
      line_no        = CASE WHEN EXCLUDED.last_seen >= error_groups.last_seen
                            THEN EXCLUDED.line_no ELSE error_groups.line_no END,
      col_no         = CASE WHEN EXCLUDED.last_seen >= error_groups.last_seen
                            THEN EXCLUDED.col_no ELSE error_groups.col_no END,
      last_page_path = CASE WHEN EXCLUDED.last_seen >= error_groups.last_seen
                            THEN EXCLUDED.last_page_path ELSE error_groups.last_page_path END,
      -- A fault that comes back is unresolved again. Silently leaving it closed is how a
      -- regression hides: someone marked it fixed, it started throwing again, and the
      -- list still says resolved.
      status = CASE WHEN error_groups.status = 'resolved'
                    THEN 'unresolved' ELSE error_groups.status END
  `;
}

/** Store the individual occurrences behind their groups. */
export async function insertErrorEvents(rows: readonly ErrorRow[]): Promise<void> {
  if (rows.length === 0) return;
  await sql`
    INSERT INTO error_events
      (website_id, fingerprint, message, stack, source_file, line_no, col_no,
       page_path, session_id, visitor_id, browser, os, device_type, occurred_at)
    SELECT
      (v->>'website_id')::uuid,
      v->>'fingerprint',
      v->>'message',
      v->>'stack',
      v->>'source_file',
      NULLIF(v->>'line_no', '')::int,
      NULLIF(v->>'col_no', '')::int,
      v->>'page_path',
      NULLIF(v->>'session_id', ''),
      NULLIF(v->>'visitor_id', ''),
      v->>'browser',
      v->>'os',
      v->>'device_type',
      (v->>'occurred_at')::timestamptz
    FROM jsonb_array_elements(${JSON.stringify(
      rows.map((row) => ({
        website_id: row.websiteId,
        fingerprint: row.fingerprint,
        message: row.message,
        stack: row.stack,
        source_file: row.sourceFile,
        line_no: row.lineNo == null ? "" : String(row.lineNo),
        col_no: row.colNo == null ? "" : String(row.colNo),
        page_path: row.pagePath,
        session_id: row.sessionId ?? "",
        visitor_id: row.visitorId ?? "",
        browser: row.browser,
        os: row.os,
        device_type: row.deviceType,
        occurred_at: row.occurredAt.toISOString(),
      })),
    )}::jsonb) AS v
  `;
}
