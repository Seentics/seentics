/** Traffic channel summary: direct, organic, referral, social, email, paid, campaign. */
import { analyticsReadSql as pgSql } from "../../../db";
import { CHANNEL_CASE_SQL } from "../lib/traffic-channel";
import { parseDays, windowStartIso } from "./shared";

export async function getTrafficSummaryStats(
  websiteId: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const startIso = windowStartIso(days);

  /*
   * Session-level: each session is credited to the channel it arrived through, and all
   * of its pageviews count toward that channel. Counting each pageview by its own
   * referrer — as this did — reported a multi-page site's in-site navigation as
   * "referral", which measured at ~60% of all pageviews on realistic traffic.
   *
   * A session's channel is its known arrival channel; `direct` only when it has none.
   * `internal` pageviews (in-site clicks) never set it, and a later pageview with no
   * referrer (a reload, a bookmark mid-visit) does not override a known source — the
   * usual analytics convention. A session whose pageviews in the window are all
   * internal (it began before the window) counts as direct.
   *
   * The channel comes from the column ingest stores; the CASE runs only for a row with
   * none. `GROUPING SETS ((channel), ())` yields each channel plus one site-wide row in
   * the same pass — the site-wide visitor count cannot be the per-channel sum, since a
   * visitor who came twice through different channels would count twice.
   */
  const rows = await pgSql<{
    channel: string | null;
    site_total: boolean;
    views: number;
    sessions: number;
    unique_visitors: number;
  }[]>`
    WITH per_session AS (
      SELECT
        coalesce(
          max(ch) FILTER (WHERE ch NOT IN ('internal', 'direct')),
          'direct'
        ) AS channel,
        count(*) AS views,
        max(vkey) AS vkey
      FROM (
        SELECT
          coalesce(nullif(trim(session_id), ''), id::text) AS sid,
          coalesce(channel, ${pgSql.unsafe(CHANNEL_CASE_SQL)}) AS ch,
          -- The dashboard's own visitor key, so the two report the same visitors.
          coalesce(nullif(trim(visitor_id), ''), session_id) AS vkey
        FROM analytics_events
        WHERE website_id = ${websiteId}
          AND event_type = 'pageview'
          AND occurred_at >= ${startIso}
      ) pv
      GROUP BY sid
    )
    SELECT
      channel,
      GROUPING(channel) = 1 AS site_total,
      sum(views)::int AS views,
      count(*)::int AS sessions,
      count(DISTINCT vkey)::int AS unique_visitors
    FROM per_session
    GROUP BY GROUPING SETS ((channel), ())
  `;

  const channels = rows
    .filter((r) => !r.site_total)
    .map((r) => ({
      channel: r.channel as string,
      views: Number(r.views),
      sessions: Number(r.sessions),
      unique_visitors: Number(r.unique_visitors),
    }))
    .sort((a, b) => b.views - a.views);

  return {
    website_id: websiteId,
    date_range: `${days}d`,
    channels,
    total_views: channels.reduce((s, c) => s + c.views, 0),
    // Site-wide distinct count (not the per-channel sum, which double-counts
    // visitors seen through multiple channels).
    total_visitors: channels.length > 0 ? Number(rows.find((r) => r.site_total)?.unique_visitors ?? 0) : 0,
  };
}
