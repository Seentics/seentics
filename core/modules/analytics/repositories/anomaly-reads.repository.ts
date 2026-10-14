import { analyticsReadSql as pgSql } from "../../../db";
import { rollupsEnabled } from "../rollups/reads";

/**
 * The counts behind the AI module's hourly anomaly check (`AnalyticsAnomalyReads`).
 *
 * Run for every active site every hour, so each read is a handful of index range scans:
 *
 *  - Recent windows (the last two days) read raw events through `ix_ae_site_time`
 *    (website + time). They are uncompressed, and reading them raw means the check never
 *    mistakes a rollup that has not been rebuilt yet for a drop in traffic.
 *  - Older windows — the seasonal baseline, one to four weeks back — read the hourly rollup
 *    (`analytics_rollup_hourly`, one row per site-hour) when it exists; without it (a Postgres
 *    without `hll`), raw events, which then still carry all their indexes.
 *
 * Every window is hour-aligned and half-open, `[start, end)`.
 */

type Win = { start: Date; end: Date };
/** Raw events are uncompressed for 48 h (038); a window inside the last 47 h reads them. */
const RAW_RECENT_MS = 47 * 3_600_000;

async function rawTraffic(websiteId: string, windows: readonly Win[]): Promise<Map<number, { pageviews: number; visitors: number }>> {
  if (!windows.length) return new Map();
  const rows = await pgSql<{ i: number; pageviews: number; visitors: number }[]>`
    SELECT w.i::int AS i,
           count(e.occurred_at)::int AS pageviews,
           count(DISTINCT coalesce(nullif(trim(e.visitor_id), ''), e.session_id))::int AS visitors
    FROM unnest(${windows.map((w) => w.start.toISOString())}::timestamptz[], ${windows.map((w) => w.end.toISOString())}::timestamptz[])
         WITH ORDINALITY AS w(s, e, i)
    LEFT JOIN analytics_events e
      ON e.website_id = ${websiteId} AND e.event_type = 'pageview'
     AND e.occurred_at >= w.s AND e.occurred_at < w.e
    GROUP BY w.i
  `;
  return new Map(rows.map((r) => [r.i - 1, { pageviews: r.pageviews, visitors: r.visitors }]));
}

async function rollupTraffic(websiteId: string, windows: readonly Win[]): Promise<Map<number, { pageviews: number; visitors: number }>> {
  if (!windows.length) return new Map();
  const rows = await pgSql<{ i: number; pageviews: number; visitors: number }[]>`
    SELECT w.i::int AS i,
           coalesce(sum(h.pageviews), 0)::int AS pageviews,
           coalesce(round(hll_cardinality(hll_union_agg(h.visitors))), 0)::int AS visitors
    FROM unnest(${windows.map((w) => w.start.toISOString())}::timestamptz[], ${windows.map((w) => w.end.toISOString())}::timestamptz[])
         WITH ORDINALITY AS w(s, e, i)
    LEFT JOIN analytics_rollup_hourly h
      ON h.website_id = ${websiteId} AND h.hour >= w.s AND h.hour < w.e
    GROUP BY w.i
  `;
  return new Map(rows.map((r) => [r.i - 1, { pageviews: r.pageviews, visitors: r.visitors }]));
}

/** Pageviews and distinct visitors in each window, in the order given. */
export async function trafficInWindows(websiteId: string, windows: readonly Win[], now = new Date()): Promise<Array<{ pageviews: number; visitors: number }>> {
  const recentFrom = now.getTime() - RAW_RECENT_MS;
  const useRollup = rollupsEnabled();
  const raw: Array<{ w: Win; i: number }> = [];
  const rolled: Array<{ w: Win; i: number }> = [];
  windows.forEach((w, i) => (useRollup && w.start.getTime() < recentFrom ? rolled : raw).push({ w, i }));

  const [fromRaw, fromRollup] = await Promise.all([
    rawTraffic(websiteId, raw.map((x) => x.w)),
    rollupTraffic(websiteId, rolled.map((x) => x.w)),
  ]);
  const out = windows.map(() => ({ pageviews: 0, visitors: 0 }));
  raw.forEach((x, j) => { out[x.i] = fromRaw.get(j) ?? out[x.i]!; });
  rolled.forEach((x, j) => { out[x.i] = fromRollup.get(j) ?? out[x.i]!; });
  return out;
}

const SOURCE = `coalesce(
  nullif(lower(trim(e.utm_source)), ''),
  substring(lower(e.referrer) from '^[a-z][a-z0-9+.-]*://(?:www\\.)?([^/:?#]+)'),
  nullif(e.channel, ''),
  'direct'
)`;

/**
 * Where a window's pageviews went, against a reference window of the same length: the pages
 * and sources that moved most, for the anomaly's explanation. Raw events, both windows; called
 * only when an anomaly opens, never on the hourly sweep. Sources leave out in-site navigation. Paths and names as stored — the AI
 * module masks them before they go anywhere.
 */
export async function windowBreakdown(
  websiteId: string,
  current: Win,
  reference: Win,
  limit = 5,
): Promise<{ pages: Array<{ name: string; cur: number; ref: number }>; sources: Array<{ name: string; cur: number; ref: number }> }> {
  const cs = current.start.toISOString(), ce = current.end.toISOString();
  const rs = reference.start.toISOString(), re = reference.end.toISOString();
  const query = (expr: string, arrivals: boolean) => pgSql<{ name: string; cur: number; ref: number }[]>`
    WITH t AS (
      SELECT ${pgSql.unsafe(expr)} AS name,
             count(*) FILTER (WHERE e.occurred_at >= ${cs} AND e.occurred_at < ${ce})::int AS cur,
             count(*) FILTER (WHERE e.occurred_at >= ${rs} AND e.occurred_at < ${re})::int AS ref
      FROM analytics_events e
      WHERE e.website_id = ${websiteId} AND e.event_type = 'pageview'
        AND ((e.occurred_at >= ${cs} AND e.occurred_at < ${ce}) OR (e.occurred_at >= ${rs} AND e.occurred_at < ${re}))
        ${arrivals ? pgSql`AND coalesce(e.channel, '') <> 'internal'` : pgSql``}
      GROUP BY 1
    )
    SELECT name, cur, ref FROM t
    WHERE name IS NOT NULL
    ORDER BY abs(cur - ref) DESC, name
    LIMIT ${limit}
  `;
  const [pages, sources] = await Promise.all([query("coalesce(nullif(e.page, ''), '/')", false), query(SOURCE, true)]);
  return { pages, sources };
}
