import type { ErrorGroupWindowCount, ErrorSurgeCandidate } from "../interfaces";
import { sql } from "../../../db";
import type { ErrorGroupSummary, ErrorGroupWindowStats, ErrorSample } from "../interfaces";

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
  const groups = (rows as Record<string, unknown>[]).map(toGroup);
  const stats = await windowStats(websiteId, groups.map((g) => g.fingerprint), opts.days);
  return groups.map((g) => ({ ...g, window: stats.get(g.fingerprint) ?? { count: 0, prev_count: 0, sessions: 0, pages: [] } }));
}

/**
 * This period's and the previous period's occurrences for the listed faults, with visitors and
 * pages. Only the faults on the page, through `ix_error_events_group_occurred`, so it stays as
 * bounded as the list itself.
 */
async function windowStats(websiteId: string, fingerprints: string[], days: number): Promise<Map<string, ErrorGroupWindowStats>> {
  const out = new Map<string, ErrorGroupWindowStats>();
  if (fingerprints.length === 0) return out;
  const d = Math.min(365, Math.max(1, Math.trunc(days) || 7));
  const since = new Date(Date.now() - d * 86_400_000).toISOString();
  const before = new Date(Date.now() - 2 * d * 86_400_000).toISOString();
  const rows = await sql`
    WITH ev AS (
      SELECT fingerprint, occurred_at >= ${since} AS cur, session_id, page_path
      FROM error_events
      WHERE website_id = ${websiteId}::uuid
        AND fingerprint = ANY(${fingerprints})
        AND occurred_at >= ${before}
    ),
    pages AS (
      SELECT fingerprint, page_path, count(*) AS n,
             row_number() OVER (PARTITION BY fingerprint ORDER BY count(*) DESC, page_path) AS rk
      FROM ev WHERE cur AND page_path <> '' GROUP BY fingerprint, page_path
    )
    SELECT e.fingerprint,
           count(*) FILTER (WHERE e.cur)::int AS count,
           count(*) FILTER (WHERE NOT e.cur)::int AS prev_count,
           count(DISTINCT e.session_id) FILTER (WHERE e.cur)::int AS sessions,
           COALESCE((SELECT array_agg(p.page_path ORDER BY p.rk) FROM pages p WHERE p.fingerprint = e.fingerprint AND p.rk <= 3), '{}') AS pages
    FROM ev e
    GROUP BY e.fingerprint
  `;
  for (const r of rows as Record<string, unknown>[]) {
    out.set(String(r.fingerprint), {
      count: Number(r.count ?? 0),
      prev_count: Number(r.prev_count ?? 0),
      sessions: Number(r.sessions ?? 0),
      pages: Array.isArray(r.pages) ? (r.pages as unknown[]).map(String) : [],
    });
  }
  return out;
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


/**
 * One site's unresolved faults, most frequent within the last `days` first.
 *
 * Counted from `error_events` (one row per occurrence, indexed on website and time), because
 * `error_groups.event_count` only ever grows: it is a lifetime total, not a weekly one.
 */
export async function listErrorGroupsByWindowCount(
  websiteId: string,
  opts: { days: number; limit?: number },
): Promise<ErrorGroupWindowCount[]> {
  const since = windowStart(opts.days);
  const limit = Math.min(MAX_GROUPS, Math.max(1, Math.trunc(opts.limit ?? 20) || 20));
  const rows = await sql`
    SELECT g.fingerprint, g.message, g.last_page_path, g.first_seen, g.last_seen, e.window_count
    FROM (
      SELECT fingerprint, count(*)::int AS window_count
      FROM error_events
      WHERE website_id = ${websiteId}::uuid AND occurred_at >= ${since}
      GROUP BY fingerprint
    ) e
    JOIN error_groups g ON g.website_id = ${websiteId}::uuid AND g.fingerprint = e.fingerprint
    WHERE g.status = 'unresolved'
    ORDER BY e.window_count DESC, g.fingerprint
    LIMIT ${limit}
  `;
  return (rows as Record<string, unknown>[]).map((r) => ({
    fingerprint: String(r.fingerprint),
    message: String(r.message),
    last_page_path: String(r.last_page_path ?? ""),
    first_seen: new Date(r.first_seen as string).toISOString(),
    last_seen: new Date(r.last_seen as string).toISOString(),
    window_count: Number(r.window_count ?? 0),
  }));
}

/**
 * The anomaly check's error reads (`ErrorAnomalyReads.surgeCandidates`): the current window's
 * busiest faults plus the ones named in `include`, with their sessions and their counts in
 * each baseline window. Ignored faults are left out — the owner has said they do not matter.
 *
 * Two statements, both index range scans: the current window by website and time, then each
 * candidate's baseline windows by website, fingerprint and time.
 */
export async function errorSurgeCandidates(
  websiteId: string,
  current: { start: Date; end: Date },
  baselines: ReadonlyArray<{ start: Date; end: Date }>,
  opts: { limit: number; include?: readonly string[] },
): Promise<ErrorSurgeCandidate[]> {
  const limit = Math.min(MAX_GROUPS, Math.max(1, Math.trunc(opts.limit) || 10));
  const include = [...new Set(opts.include ?? [])].slice(0, 50);
  const rows = await sql<{ fingerprint: string; message: string; last_page_path: string | null; first_seen: Date | string; current: number; sessions: number }[]>`
    WITH cur AS (
      SELECT fingerprint, count(*)::int AS current, count(DISTINCT session_id)::int AS sessions
      FROM error_events
      WHERE website_id = ${websiteId}::uuid
        AND occurred_at >= ${current.start.toISOString()}::timestamptz AND occurred_at < ${current.end.toISOString()}::timestamptz
      GROUP BY fingerprint
    ),
    picked AS (
      (SELECT fingerprint FROM cur ORDER BY current DESC, fingerprint LIMIT ${limit})
      UNION
      SELECT unnest(${include}::text[])
    )
    SELECT g.fingerprint, g.message, g.last_page_path, g.first_seen,
           coalesce(c.current, 0)::int AS current, coalesce(c.sessions, 0)::int AS sessions
    FROM picked p
    JOIN error_groups g ON g.website_id = ${websiteId}::uuid AND g.fingerprint = p.fingerprint
    LEFT JOIN cur c ON c.fingerprint = p.fingerprint
    WHERE g.status <> 'ignored'
  `;
  if (!rows.length) return [];

  const fingerprints = rows.map((r) => r.fingerprint);
  const counts = baselines.length
    ? await sql<{ fingerprint: string; i: number; n: number }[]>`
        SELECT f.fingerprint, w.i::int AS i, count(e.id)::int AS n
        FROM unnest(${fingerprints}::text[]) AS f(fingerprint)
        -- Bound as text[] and cast: this client cannot bind a timestamptz[] (see db/index.ts).
        CROSS JOIN unnest(${baselines.map((b) => b.start.toISOString())}::text[]::timestamptz[], ${baselines.map((b) => b.end.toISOString())}::text[]::timestamptz[])
             WITH ORDINALITY AS w(s, e, i)
        LEFT JOIN error_events e
          ON e.website_id = ${websiteId}::uuid AND e.fingerprint = f.fingerprint
         AND e.occurred_at >= w.s AND e.occurred_at < w.e
        GROUP BY f.fingerprint, w.i
      `
    : [];
  const byFingerprint = new Map<string, number[]>();
  for (const c of counts) {
    const list = byFingerprint.get(c.fingerprint) ?? baselines.map(() => 0);
    list[c.i - 1] = c.n;
    byFingerprint.set(c.fingerprint, list);
  }
  return rows.map((r) => ({
    fingerprint: r.fingerprint,
    message: String(r.message ?? ""),
    last_page_path: String(r.last_page_path ?? ""),
    first_seen: new Date(r.first_seen).toISOString(),
    current: Number(r.current ?? 0),
    sessions: Number(r.sessions ?? 0),
    baseline: byFingerprint.get(r.fingerprint) ?? baselines.map(() => 0),
  }));
}
