/**
 * Dashboard reads served from the rollups (db/sql/031_analytics_rollups.sql).
 *
 * Each function returns the same row shape as the raw-event query it replaces, so a
 * repository only chooses where its rows come from and keeps its response shaping.
 * Repositories call these only when `rollupsEnabled()` — a Postgres without the `hll`
 * extension has no rollup tables and keeps reading raw events.
 *
 * Windows are calendar days in UTC: "last N days" is today plus the N−1 days before it.
 * Unique visitors are HyperLogLog unions (~1% on large counts, exact on small ones);
 * every other number is exact.
 *
 * Freshness: `ensureFresh` rebuilds a site's stale recent days before a read, so a
 * dashboard reflects events up to the request rather than up to the background
 * builder's last 30-second run. It is debounced per site and a no-op when nothing new
 * has arrived.
 */
import { analyticsReadSql as pgSql, sql } from "../../../db";
import { log as baseLog } from "../../../platform/observability/logger";
import { buildStaleRollups } from "./builder";

const log = baseLog.child({ category: "analytics_rollups" });

// ─── Availability ─────────────────────────────────────────────────────────────

let enabled = false;

/** Whether the rollup tables exist. Set once at startup, after migrations. */
export function rollupsEnabled(): boolean {
  return enabled;
}

export async function detectRollups(): Promise<boolean> {
  const [row] = await sql<{ ok: boolean }[]>`SELECT to_regclass('analytics_rollup_daily') IS NOT NULL AS ok`;
  enabled = Boolean(row?.ok);
  log.info({ msg: enabled ? "rollups_enabled" : "rollups_unavailable_reading_raw_events" });
  return enabled;
}

/** For tests. */
export function setRollupsEnabled(value: boolean): void {
  enabled = value;
}

// ─── Freshness ────────────────────────────────────────────────────────────────

/** A site's recent rollups are checked at most this often. */
const FRESH_MS = 5_000;
/**
 * How long a read waits for that rebuild before answering from the rollups as they
 * are. A small site's rebuild fits inside it, so its numbers are current; a busy
 * site's today (92k events, ~2 s warm, ~15 s cold) does not, and it used to hold
 * the first dashboard request after any new traffic for all of that. The rebuild
 * carries on in the background; the next read sees it.
 */
const FRESH_WAIT_MS = 300;
const lastChecked = new Map<string, number>();
const inFlight = new Map<string, Promise<void>>();

/**
 * Rebuild this site's stale recent days (today, and yesterday early in the day) before
 * a read — waiting at most `FRESH_WAIT_MS` for it. Concurrent reads for one site share
 * a single rebuild; within `FRESH_MS` of the last check it returns immediately.
 * Failures are logged, never thrown — a read with slightly stale rollups beats a failed
 * dashboard.
 */
export function ensureFresh(websiteId: string): Promise<void> {
  if (!enabled) return Promise.resolve();
  const running = inFlight.get(websiteId) ?? startRefresh(websiteId);
  if (!running) return Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const waited = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, FRESH_WAIT_MS);
  });
  return Promise.race([running, waited]).finally(() => clearTimeout(timer));
}

let refreshRecent = async (websiteId: string): Promise<unknown> => buildStaleRollups({ websiteId, recentOnly: true });

/** For tests: stands in for the rebuild, without a module mock that would leak into other files. */
export function setRollupRefresher(fn: (websiteId: string) => Promise<unknown>): void {
  refreshRecent = fn;
}

/** Starts the site's refresh unless one ran within `FRESH_MS`; the promise settles when it is done. */
function startRefresh(websiteId: string): Promise<void> | null {
  if (Date.now() - (lastChecked.get(websiteId) ?? 0) < FRESH_MS) return null;

  const run = (async () => {
    try {
      await refreshRecent(websiteId);
    } catch (e) {
      log.warn({ msg: "rollup_read_refresh_failed", website_id: websiteId, err: String(e) });
    } finally {
      lastChecked.set(websiteId, Date.now());
      inFlight.delete(websiteId);
      if (lastChecked.size > 50_000) lastChecked.clear();
    }
  })();
  inFlight.set(websiteId, run);
  return run;
}

// ─── Windows ──────────────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

export type RollupWindow = { from: string; to: string; prevFrom: string; prevTo: string };

/** Today plus the `days − 1` days before it, and the same length immediately before. */
export function rollupWindow(days: number, now = Date.now()): RollupWindow {
  const today = Date.parse(new Date(now).toISOString().slice(0, 10) + "T00:00:00Z");
  const day = (offset: number) => new Date(today + offset * DAY_MS).toISOString().slice(0, 10);
  return { from: day(-(days - 1)), to: day(0), prevFrom: day(-(2 * days - 1)), prevTo: day(-days) };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

const uniques = (expr = "visitors") => pgSql.unsafe(`coalesce(round(hll_cardinality(hll_union_agg(${expr}))), 0)::int`);

/** Site totals for the window and the one before it, in the dashboard's row shape. */
export async function dashboardRows(websiteId: string, days: number) {
  await ensureFresh(websiteId);
  const w = rollupWindow(days);
  const [row] = await pgSql<{
    pv: number; uv: number; sessions: number; bounces: number; duration: number;
    prev_pv: number; prev_uv: number; prev_sessions: number; prev_bounces: number; prev_duration: number;
  }[]>`
    SELECT
      coalesce(sum(pageviews) FILTER (WHERE cur), 0)::bigint AS pv,
      coalesce(round(hll_cardinality(hll_union_agg(visitors) FILTER (WHERE cur))), 0)::int AS uv,
      coalesce(sum(sessions) FILTER (WHERE cur), 0)::bigint AS sessions,
      coalesce(sum(bounces) FILTER (WHERE cur), 0)::bigint AS bounces,
      coalesce(sum(duration_s) FILTER (WHERE cur), 0)::bigint AS duration,
      coalesce(sum(pageviews) FILTER (WHERE NOT cur), 0)::bigint AS prev_pv,
      coalesce(round(hll_cardinality(hll_union_agg(visitors) FILTER (WHERE NOT cur))), 0)::int AS prev_uv,
      coalesce(sum(sessions) FILTER (WHERE NOT cur), 0)::bigint AS prev_sessions,
      coalesce(sum(bounces) FILTER (WHERE NOT cur), 0)::bigint AS prev_bounces,
      coalesce(sum(duration_s) FILTER (WHERE NOT cur), 0)::bigint AS prev_duration
    FROM (
      SELECT *, day >= ${w.from}::date AS cur
      FROM analytics_rollup_daily
      WHERE website_id = ${websiteId} AND dimension = 'site'
        AND day BETWEEN ${w.prevFrom}::date AND ${w.to}::date
    ) d
  `;
  const n = (v: unknown) => Number(v ?? 0);
  const rate = (part: number, whole: number) => (whole > 0 ? (part * 100) / whole : 0);
  const avg = (total: number, count: number) => (count > 0 ? Math.round(total / count) : 0);
  return {
    agg: { pv: n(row?.pv), uv: n(row?.uv), prev_pv: n(row?.prev_pv), prev_uv: n(row?.prev_uv) },
    sess: {
      session_cnt: n(row?.sessions),
      avg_session_sec: avg(n(row?.duration), n(row?.sessions)),
      bounce_pct: rate(n(row?.bounces), n(row?.sessions)),
      prev_session_cnt: n(row?.prev_sessions),
      prev_avg_session_sec: avg(n(row?.prev_duration), n(row?.prev_sessions)),
      prev_bounce_pct: rate(n(row?.prev_bounces), n(row?.prev_sessions)),
    },
  };
}

export type TopRow = { k: string; views: number; sessions: number; bounces: number; duration_s: number; unique_visitors: number };

/**
 * The top values of one dimension over the window. `orderBy` picks the ranking;
 * ties break on the value so the order is stable between loads. A caller that does not
 * show visitors passes `withUniques: false` and gets `unique_visitors: 0`, sparing the
 * second pass that unions their sketches.
 */
export async function topRows(
  websiteId: string,
  dimension: string,
  days: number,
  limit: number,
  orderBy: "views" | "unique_visitors" | "sessions" = "views",
  withUniques = true,
): Promise<TopRow[]> {
  await ensureFresh(websiteId);
  const w = rollupWindow(days);
  // Ranked by a plain sum, the top values are picked first and only their sketches are
  // unioned: `path` holds ~150k values on a large site, and unioning a sketch for each
  // before discarding all but 50 took 1.2 s over 90 days.
  const rows = !withUniques && orderBy !== "unique_visitors"
    ? await pgSql<TopRow[]>`
        SELECT
          value AS k,
          sum(pageviews)::bigint AS views,
          sum(sessions)::bigint AS sessions,
          sum(bounces)::bigint AS bounces,
          sum(duration_s)::bigint AS duration_s,
          0 AS unique_visitors
        FROM analytics_rollup_daily
        WHERE website_id = ${websiteId} AND dimension = ${dimension}
          AND day BETWEEN ${w.from}::date AND ${w.to}::date
        GROUP BY value
        ORDER BY ${pgSql.unsafe(orderBy)} DESC, value ASC
        LIMIT ${limit}
      `
    : orderBy === "unique_visitors"
    ? await pgSql<TopRow[]>`
        SELECT
          value AS k,
          sum(pageviews)::bigint AS views,
          sum(sessions)::bigint AS sessions,
          sum(bounces)::bigint AS bounces,
          sum(duration_s)::bigint AS duration_s,
          ${uniques()} AS unique_visitors
        FROM analytics_rollup_daily
        WHERE website_id = ${websiteId} AND dimension = ${dimension}
          AND day BETWEEN ${w.from}::date AND ${w.to}::date
        GROUP BY value
        ORDER BY unique_visitors DESC, value ASC
        LIMIT ${limit}
      `
    : await pgSql<TopRow[]>`
        WITH top AS (
          SELECT
            value,
            sum(pageviews)::bigint AS views,
            sum(sessions)::bigint AS sessions,
            sum(bounces)::bigint AS bounces,
            sum(duration_s)::bigint AS duration_s
          FROM analytics_rollup_daily
          WHERE website_id = ${websiteId} AND dimension = ${dimension}
            AND day BETWEEN ${w.from}::date AND ${w.to}::date
          GROUP BY value
          ORDER BY ${pgSql.unsafe(orderBy)} DESC, value ASC
          LIMIT ${limit}
        )
        SELECT
          t.value AS k, t.views, t.sessions, t.bounces, t.duration_s,
          ${uniques("d.visitors")} AS unique_visitors
        FROM top t
        JOIN analytics_rollup_daily d
          ON d.website_id = ${websiteId} AND d.dimension = ${dimension} AND d.value = t.value
         AND d.day BETWEEN ${w.from}::date AND ${w.to}::date
        GROUP BY t.value, t.views, t.sessions, t.bounces, t.duration_s
        ORDER BY t.${pgSql.unsafe(orderBy)} DESC, t.value ASC
      `;
  return rows.map((r) => ({
    k: r.k,
    views: Number(r.views),
    sessions: Number(r.sessions),
    bounces: Number(r.bounces),
    duration_s: Number(r.duration_s),
    unique_visitors: Number(r.unique_visitors),
  }));
}

/** Unique visitors across the whole site over the window. */
export async function siteUniques(websiteId: string, days: number): Promise<number> {
  await ensureFresh(websiteId);
  const w = rollupWindow(days);
  const [row] = await pgSql<{ uv: number }[]>`
    SELECT ${uniques()} AS uv
    FROM analytics_rollup_daily
    WHERE website_id = ${websiteId} AND dimension = 'site'
      AND day BETWEEN ${w.from}::date AND ${w.to}::date
  `;
  return Number(row?.uv ?? 0);
}

/**
 * Pageviews and visitors per local day in `tz`, regrouped from UTC hours, for today and the
 * `days − 1` local days before it. Exact for whole-hour offsets; in a half-hour zone an hour
 * straddling local midnight is counted on the day it started.
 */
export async function dailyRows(websiteId: string, days: number, tz: string) {
  await ensureFresh(websiteId);
  const rows = await pgSql<{ date: string; views: number; unique_visitors: number }[]>`
    SELECT
      (hour AT TIME ZONE ${tz})::date::text AS date,
      sum(pageviews)::bigint AS views,
      ${uniques()} AS unique_visitors
    FROM analytics_rollup_hourly
    -- From the start of the viewer's local day, days-1 days back — not from midnight UTC, which
    -- is mid-afternoon or mid-morning where they are and made the first bar a partial day (or an
    -- extra one) in every zone but UTC.
    WHERE website_id = ${websiteId}
      AND hour >= (date_trunc('day', now() AT TIME ZONE ${tz}) - ${days - 1} * interval '1 day') AT TIME ZONE ${tz}
    GROUP BY 1
    ORDER BY 1
  `;
  return rows.map((r) => ({ date: r.date, views: Number(r.views), unique_visitors: Number(r.unique_visitors) }));
}

/** Pageviews and visitors per hour of day in `tz`, over the window. */
export async function hourlyRows(websiteId: string, days: number, tz: string) {
  await ensureFresh(websiteId);
  const w = rollupWindow(days);
  const rows = await pgSql<{ h: number; views: number; unique: number }[]>`
    SELECT
      extract(hour FROM hour AT TIME ZONE ${tz})::int AS h,
      sum(pageviews)::bigint AS views,
      ${uniques()} AS unique
    FROM analytics_rollup_hourly
    WHERE website_id = ${websiteId} AND hour >= ${w.from}::date
    GROUP BY 1
    ORDER BY 1
  `;
  return rows.map((r) => ({ h: r.h, views: Number(r.views), unique: Number(r.unique) }));
}

/** Visitors whose first-ever visit falls inside the window. */
export async function newVisitorCount(websiteId: string, days: number): Promise<number> {
  await ensureFresh(websiteId);
  const w = rollupWindow(days);
  const [row] = await pgSql<{ n: number }[]>`
    SELECT count(*)::int AS n
    FROM analytics_rollup_visitor_first_seen
    WHERE website_id = ${websiteId} AND first_day BETWEEN ${w.from}::date AND ${w.to}::date
  `;
  return Number(row?.n ?? 0);
}
