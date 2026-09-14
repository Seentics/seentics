import { sql } from "../../../db";
import type { ErrorGroupSummary, ErrorSample } from "../interfaces";

/** Hard ceilings, so a caller cannot ask for an unbounded scan. */
const MAX_GROUPS = 200;
const MAX_SAMPLES = 50;

function windowStart(days: number): string {
  const d = Math.min(365, Math.max(1, Math.trunc(days) || 7));
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();
}

function toGroup(r: Record<string, unknown>): ErrorGroupSummary {
  return {
    id: String(r.id),
    fingerprint: String(r.fingerprint),
    kind: String(r.kind),
    message: String(r.message),
    source_file: String(r.source_file ?? ""),
    line_no: r.line_no == null ? null : Number(r.line_no),
    status: String(r.status),
    event_count: Number(r.event_count ?? 0),
    last_page_path: String(r.last_page_path ?? ""),
    first_seen: new Date(r.first_seen as string).toISOString(),
    last_seen: new Date(r.last_seen as string).toISOString(),
  };
}

/**
 * One site's faults, most recently seen first.
 *
 * Reads `error_groups` alone — no join, no aggregate. That is the entire reason the
 * groups table is maintained on ingest: this is the query the dashboard runs on every
 * load, and it should be an index range scan over a table with one row per distinct
 * fault, not a grouping pass over every occurrence.
 *
 * `search` is a case-insensitive substring over the message and source. Deliberately not
 * full-text: the corpus is small, the patterns people actually type are fragments of a
 * stack frame or a filename, and `to_tsvector` would tokenise
 * `Cannot read properties of undefined` into words that match half the table.
 */
export async function listErrorGroups(
  websiteId: string,
  opts: { days: number; status?: string; search?: string; limit?: number },
): Promise<ErrorGroupSummary[]> {
  const since = windowStart(opts.days);
  const limit = Math.min(MAX_GROUPS, Math.max(1, Math.trunc(opts.limit ?? 100) || 100));
  // Empty means "every status" — the caller's way of asking for resolved ones too.
  const status = (opts.status ?? "").trim();
  const search = (opts.search ?? "").trim();

  const rows = await sql`
    SELECT id, fingerprint, kind, message, source_file, line_no, status,
           event_count, last_page_path, first_seen, last_seen
    FROM error_groups
    WHERE website_id = ${websiteId}::uuid
      AND last_seen >= ${since}
      AND (${status} = '' OR status = ${status})
      AND (
        ${search} = ''
        OR message ILIKE ${"%" + search + "%"}
        OR source_file ILIKE ${"%" + search + "%"}
      )
    ORDER BY last_seen DESC
    LIMIT ${limit}
  `;
  return (rows as Record<string, unknown>[]).map(toGroup);
}

/** One group's header row, or null when the fingerprint is not this site's. */
export async function getErrorGroup(
  websiteId: string,
  fingerprint: string,
): Promise<ErrorGroupSummary | null> {
  const rows = await sql`
    SELECT id, fingerprint, kind, message, source_file, line_no, status,
           event_count, last_page_path, first_seen, last_seen
    FROM error_groups
    WHERE website_id = ${websiteId}::uuid AND fingerprint = ${fingerprint}
    LIMIT 1
  `;
  const row = (rows as Record<string, unknown>[])[0];
  return row ? toGroup(row) : null;
}

/**
 * Recent occurrences of one fault.
 *
 * `session_id` is the payload that matters — it is what the dashboard turns into a link
 * to the replay of the visitor who hit this. Ordered newest first because a fault is
 * usually debugged from its most recent example, against the current deploy.
 */
export async function listErrorSamples(
  websiteId: string,
  fingerprint: string,
  opts: { days: number; limit?: number },
): Promise<ErrorSample[]> {
  const since = windowStart(opts.days);
  const limit = Math.min(MAX_SAMPLES, Math.max(1, Math.trunc(opts.limit ?? 20) || 20));

  const rows = await sql`
    SELECT id, message, stack, source_file, line_no, col_no, page_path,
           session_id, visitor_id, browser, os, device_type, occurred_at
    FROM error_events
    WHERE website_id = ${websiteId}::uuid
      AND fingerprint = ${fingerprint}
      AND occurred_at >= ${since}
    ORDER BY occurred_at DESC
    LIMIT ${limit}
  `;
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    message: String(r.message),
    stack: String(r.stack ?? ""),
    source_file: String(r.source_file ?? ""),
    line_no: r.line_no == null ? null : Number(r.line_no),
    col_no: r.col_no == null ? null : Number(r.col_no),
    page_path: String(r.page_path ?? ""),
    session_id: r.session_id == null ? null : String(r.session_id),
    visitor_id: r.visitor_id == null ? null : String(r.visitor_id),
    browser: String(r.browser ?? ""),
    os: String(r.os ?? ""),
    device_type: String(r.device_type ?? ""),
    occurred_at: new Date(r.occurred_at as string).toISOString(),
  }));
}

/**
 * Move a group between `unresolved`, `resolved` and `ignored`.
 *
 * Scoped by website in the statement rather than checked beforehand: a fingerprint is
 * guessable, and an update that filtered only on it would let one tenant resolve
 * another's faults. Returns false when nothing matched, which the route answers as 404.
 */
export async function setErrorGroupStatus(
  websiteId: string,
  fingerprint: string,
  status: string,
): Promise<boolean> {
  const rows = await sql`
    UPDATE error_groups
    SET status = ${status}
    WHERE website_id = ${websiteId}::uuid AND fingerprint = ${fingerprint}
    RETURNING id
  `;
  return (rows as unknown[]).length > 0;
}
