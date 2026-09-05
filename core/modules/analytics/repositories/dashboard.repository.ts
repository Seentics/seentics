/** High-level KPIs for the main dashboard (single scan where possible). */
import { sql as pgSql } from "../../../db";
import { log } from "../../../platform/lib/logger";
import { parseDays } from "./shared";
import { LIVE_VISITOR_WINDOW_MS } from "./realtime.repository";

/** The windowed pageview/visitor counts, current period and the one before it. */
type TrafficAgg = {
  pv: number;
  uv: number;
  prev_pv: number;
  prev_uv: number;
};

/** Session counts, duration and bounce rate, current period and the one before it. */
type SessionAgg = {
  session_cnt: number;
  avg_session_sec: number;
  bounce_pct: number;
  prev_session_cnt: number;
  prev_avg_session_sec: number;
  prev_bounce_pct: number;
};

/** What the three queries return together. */
type DashboardRows = {
  agg: TrafficAgg | undefined;
  sess: SessionAgg | undefined;
  liveVisitors: number;
};

/**
 * The three queries behind the dashboard's headline numbers.
 *
 * Parallel, not combined: the traffic and session aggregates read the same table over the
 * same window but group differently, and the live-visitor count uses a much shorter
 * window with its own index. One query would mean either a wider scan or a join that
 * serves neither.
 *
 * Separated from `getDashboardStats` so that reading the SQL and reading the arithmetic
 * around it are two different acts.
 */
async function fetchDashboardRows(
  websiteId: string,
  startIso: string,
  endIso: string,
  prevStartIso: string,
): Promise<DashboardRows> {
  const [[agg], [sess], liveRow] = await Promise.all([
    pgSql<TrafficAgg[]>`
      SELECT
        COALESCE(
          count(*) FILTER (
            WHERE event_type = 'pageview'
              AND occurred_at >= ${startIso}
              AND occurred_at <= ${endIso}
          ),
          0
        )::int AS pv,
        COALESCE(
          count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id)) FILTER (
            WHERE event_type = 'pageview'
              AND occurred_at >= ${startIso}
              AND occurred_at <= ${endIso}
          ),
          0
        )::int AS uv,
        COALESCE(
          count(*) FILTER (
            WHERE event_type = 'pageview'
              AND occurred_at >= ${prevStartIso}
              AND occurred_at < ${startIso}
          ),
          0
        )::int AS prev_pv,
        COALESCE(
          count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id)) FILTER (
            WHERE event_type = 'pageview'
              AND occurred_at >= ${prevStartIso}
              AND occurred_at < ${startIso}
          ),
          0
        )::int AS prev_uv
      FROM analytics_events
      WHERE website_id = ${websiteId}
        -- Redundant against the four FILTERs above, which every one of them already
        -- applies — and that is the point. Without it the planner sees a query over all
        -- event types and cannot use ix_analytics_pageview_visitor, the partial covering
        -- index built for exactly this shape, so it read the heap for every custom event
        -- and heatmap row in the window before discarding them.
        AND event_type = 'pageview'
        AND occurred_at >= ${prevStartIso}
        AND occurred_at <= ${endIso}
    `,
    pgSql<SessionAgg[]>`
      -- Every event type, not just pageviews: session duration is measured from the first
      -- to the last thing a visitor did, and a session whose only later activity is a
      -- custom event lasted that long whether or not a page was loaded again. Narrowing
      -- this to pageviews would make the index work but would quietly redefine the metric.
      --
      -- ix_analytics_session_visitor serves it as it stands. A covering index on
      -- (website_id, occurred_at) INCLUDE (session_id, event_type) was added for this and
      -- then removed: the planner never chose it, and dropping it left the plan identical.
      WITH e AS (
        SELECT session_id, event_type, occurred_at
        FROM analytics_events
        WHERE website_id = ${websiteId}
          AND occurred_at >= ${prevStartIso}
          AND occurred_at <= ${endIso}
      ),
      cur_s AS (
        SELECT
          session_id,
          count(*) FILTER (WHERE event_type = 'pageview')::int AS pvc,
          min(occurred_at) AS mn,
          max(occurred_at) AS mx
        FROM e
        WHERE occurred_at >= ${startIso}
          AND occurred_at <= ${endIso}
          AND session_id IS NOT NULL
          AND length(trim(session_id)) > 0
        GROUP BY session_id
        -- Only sessions with at least one pageview, so session count,
        -- pages-per-session, and bounce rate share one population.
        HAVING count(*) FILTER (WHERE event_type = 'pageview') >= 1
      ),
      prev_s AS (
        SELECT
          session_id,
          count(*) FILTER (WHERE event_type = 'pageview')::int AS pvc,
          min(occurred_at) AS mn,
          max(occurred_at) AS mx
        FROM e
        WHERE occurred_at >= ${prevStartIso}
          AND occurred_at < ${startIso}
          AND session_id IS NOT NULL
          AND length(trim(session_id)) > 0
        GROUP BY session_id
        HAVING count(*) FILTER (WHERE event_type = 'pageview') >= 1
      )
      SELECT
        coalesce((SELECT count(*)::int FROM cur_s), 0) AS session_cnt,
        coalesce(
          (SELECT round(avg(GREATEST(0, EXTRACT(EPOCH FROM (mx - mn)))))::int FROM cur_s),
          0
        ) AS avg_session_sec,
        coalesce(
          (
            SELECT CASE
              WHEN count(*) FILTER (WHERE pvc >= 1) = 0 THEN 0::double precision
              ELSE (count(*) FILTER (WHERE pvc = 1))::double precision * 100.0
                / (count(*) FILTER (WHERE pvc >= 1))::double precision
            END
            FROM cur_s
          ),
          0
        ) AS bounce_pct,
        coalesce((SELECT count(*)::int FROM prev_s), 0) AS prev_session_cnt,
        coalesce(
          (SELECT round(avg(GREATEST(0, EXTRACT(EPOCH FROM (mx - mn)))))::int FROM prev_s),
          0
        ) AS prev_avg_session_sec,
        coalesce(
          (
            SELECT CASE
              WHEN count(*) FILTER (WHERE pvc >= 1) = 0 THEN 0::double precision
              ELSE (count(*) FILTER (WHERE pvc = 1))::double precision * 100.0
                / (count(*) FILTER (WHERE pvc >= 1))::double precision
            END
            FROM prev_s
          ),
          0
        ) AS prev_bounce_pct
    `,
    pgSql<{ c: number }[]>`
      SELECT count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS c
      FROM analytics_events
      WHERE website_id = ${websiteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${new Date(Date.now() - LIVE_VISITOR_WINDOW_MS).toISOString()}
    `,
  ]);

  return { agg, sess, liveVisitors: Number(liveRow[0]?.c ?? 0) };
}

/**
 * The three result rows into the response the dashboard renders.
 *
 * Pure apart from its logging, and lifted out for the same reason as the revenue
 * report's shaping: it was ~85 lines trailing ~145 lines of SQL, so the half that
 * computes period-over-period change could only be read alongside the half that fetches.
 *
 * Every `*_change` is a percentage *difference* except `bounce_change`, which is a
 * difference in percentage points — bounce rate is already a percentage, and expressing
 * its movement as a percentage of a percentage is the kind of number nobody can act on.
 */
function shapeDashboardStats(
  websiteId: string,
  days: number,
  { agg, sess, liveVisitors }: DashboardRows,
) {
  const pageViews = Number(agg?.pv ?? 0);
  const uniqueVisitors = Number(agg?.uv ?? 0);
  const prevPv = Number(agg?.prev_pv ?? 0);
  const prevUv = Number(agg?.prev_uv ?? 0);

  const sessionCnt = Number(sess?.session_cnt ?? 0);
  const avgSessionSec = Number(sess?.avg_session_sec ?? 0);
  const bouncePct = Number(sess?.bounce_pct ?? 0);
  const prevSessionCnt = Number(sess?.prev_session_cnt ?? 0);
  const prevAvgSessionSec = Number(sess?.prev_avg_session_sec ?? 0);
  const prevBouncePct = Number(sess?.prev_bounce_pct ?? 0);

  const pagesPerSession = sessionCnt > 0 ? pageViews / sessionCnt : 0;

  const visitorChange = prevUv ? ((uniqueVisitors - prevUv) / prevUv) * 100 : 0;
  const pageviewChange = prevPv ? ((pageViews - prevPv) / prevPv) * 100 : 0;
  const sessionChange = prevSessionCnt ? ((sessionCnt - prevSessionCnt) / prevSessionCnt) * 100 : 0;
  const bounceChange = bouncePct - prevBouncePct;
  const durationChange =
    prevAvgSessionSec > 0 ? ((avgSessionSec - prevAvgSessionSec) / prevAvgSessionSec) * 100 : 0;

  log.debug({
    msg: "analytics_dashboard_stats",
    website_id: websiteId,
    days,
    page_views: pageViews,
    unique_visitors: uniqueVisitors,
    sessions: sessionCnt,
    live_visitors: liveVisitors,
    bounce_pct: bouncePct,
    avg_session_sec: avgSessionSec,
  });
  if (pageViews === 0 && uniqueVisitors === 0 && sessionCnt === 0) {
    log.debug({
      msg: "analytics_dashboard_zero_in_range",
      website_id: websiteId,
      hint: "No rows in analytics_events for this website_id in the selected window. Confirm ingest logs (analytics_ingest_inserted) and DATABASE_URL.",
    });
  }

  return {
    website_id: websiteId,
    date_range: `${days}d`,
    total_visitors: uniqueVisitors,
    unique_visitors: uniqueVisitors,
    sessions: sessionCnt,
    live_visitors: liveVisitors,
    page_views: pageViews,
    session_duration: avgSessionSec,
    bounce_rate: bouncePct,
    metrics: {
      page_views: pageViews,
      total_visitors: uniqueVisitors,
      unique_visitors: uniqueVisitors,
      sessions: sessionCnt,
      bounce_rate: bouncePct,
      avg_session_time: avgSessionSec,
      pages_per_session: Math.round(pagesPerSession * 100) / 100,
    },
    comparison: {
      current_period: {
        total_visitors: uniqueVisitors,
        unique_visitors: uniqueVisitors,
        page_views: pageViews,
        sessions: sessionCnt,
        bounce_rate: bouncePct,
        avg_session_time: avgSessionSec,
      },
      previous_period: {
        total_visitors: prevUv,
        unique_visitors: prevUv,
        page_views: prevPv,
        sessions: prevSessionCnt,
        bounce_rate: prevBouncePct,
        avg_session_time: prevAvgSessionSec,
      },
      visitor_change: visitorChange,
      pageview_change: pageviewChange,
      session_change: sessionChange,
      bounce_change: bounceChange,
      duration_change: durationChange,
    },
  };
}

export async function getDashboardStats(
  websiteId: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const prevStart = new Date(start.getTime() - days * 86400000);

  /** The driver binds string timestamps, not `Date` (byteLength bind). */
  const rows = await fetchDashboardRows(
    websiteId,
    start.toISOString(),
    end.toISOString(),
    prevStart.toISOString(),
  );

  return shapeDashboardStats(websiteId, days, rows);
}

