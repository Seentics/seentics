/** High-level KPIs for the main dashboard (single scan where possible). */
import { sql as pgSql } from "../../db";
import { log } from "../../lib/logger";
import { parseDays, resolveSiteId } from "./shared";
import { LIVE_VISITOR_WINDOW_MS } from "./realtime";

export async function getDashboardStats(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const prevStart = new Date(start.getTime() - days * 86400000);
  /** Raw `postgres` tagged queries expect string timestamps here, not `Date` (driver byteLength bind). */
  const endIso = end.toISOString();
  const startIso = start.toISOString();
  const prevStartIso = prevStart.toISOString();

  const [[agg], [sess], liveRow] = await Promise.all([
    pgSql<
      {
        pv: number;
        uv: number;
        prev_pv: number;
        prev_uv: number;
      }[]
    >`
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
      WHERE website_id = ${siteId}
        AND occurred_at >= ${prevStartIso}
        AND occurred_at <= ${endIso}
    `,
    pgSql<
      {
        session_cnt: number;
        avg_session_sec: number;
        bounce_pct: number;
        prev_session_cnt: number;
        prev_avg_session_sec: number;
        prev_bounce_pct: number;
      }[]
    >`
      WITH e AS (
        SELECT session_id, event_type, occurred_at
        FROM analytics_events
        WHERE website_id = ${siteId}
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
      WHERE website_id = ${siteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${new Date(Date.now() - LIVE_VISITOR_WINDOW_MS).toISOString()}
    `,
  ]);

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

  const liveVisitors = Number(liveRow[0]?.c ?? 0);
  const pagesPerSession = sessionCnt > 0 ? pageViews / sessionCnt : 0;

  const visitorChange = prevUv ? ((uniqueVisitors - prevUv) / prevUv) * 100 : 0;
  const pageviewChange = prevPv ? ((pageViews - prevPv) / prevPv) * 100 : 0;
  const sessionChange = prevSessionCnt ? ((sessionCnt - prevSessionCnt) / prevSessionCnt) * 100 : 0;
  const bounceChange = bouncePct - prevBouncePct;
  const durationChange =
    prevAvgSessionSec > 0 ? ((avgSessionSec - prevAvgSessionSec) / prevAvgSessionSec) * 100 : 0;

  log.debug({
    msg: "analytics_dashboard_stats",
    website_param: websiteParam,
    site_id: siteId,
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
      website_param: websiteParam,
      site_id: siteId,
      hint: "No rows in analytics_events for this site_id in the selected window. Confirm ingest logs (analytics_ingest_inserted) and DATABASE_URL.",
    });
  }

  return {
    website_id: siteId,
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
