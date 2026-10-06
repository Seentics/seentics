/** Traffic channel summary: direct, organic, referral, social, email, paid, campaign. */
import { analyticsReadSql as pgSql } from "../../../db";
import { referrerDomainSql } from "../lib/dimension-sql";
import { arrivalPageviewSql, CHANNEL_CASE_SQL } from "../lib/traffic-channel";
import { parseDays, windowStartIso } from "./shared";
import { rollupsEnabled, siteUniques, topRows } from "../rollups/reads";

type ChannelRow = {
  channel: string | null;
  site_total: boolean;
  views: number;
  sessions: number;
  unique_visitors: number;
};

/** The same rows as the raw query below, from the rollups' session channels. */
async function channelRowsFromRollups(websiteId: string, days: number): Promise<ChannelRow[]> {
  const [channels, uv] = await Promise.all([topRows(websiteId, "channel", days, 20), siteUniques(websiteId, days)]);
  const views = channels.reduce((s, c) => s + c.views, 0);
  const sessions = channels.reduce((s, c) => s + c.sessions, 0);
  return [
    ...channels.map((c) => ({ channel: c.k, site_total: false, views: c.views, sessions: c.sessions, unique_visitors: c.unique_visitors })),
    { channel: null, site_total: true, views, sessions, unique_visitors: uv },
  ];
}

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
   * A session's channel is the one it arrived through: that of its first pageview that was
   * an arrival at all. In-site clicks, the site's own hosts and a checkout or sign-in the
   * visitor was sent to and came back from are not arrivals (`arrivalPageviewSql`), so they
   * never set it, and neither does anything that happens later in the visit. It used to be
   * the alphabetically greatest channel of all the session's pageviews, which moved a visit
   * from search to "referral" the moment it returned from paying. A session whose pageviews
   * in the window are all non-arrivals (it began before the window) counts as direct.
   *
   * The channel comes from the column ingest stores; the CASE runs only for a row with
   * none. `GROUPING SETS ((channel), ())` yields each channel plus one site-wide row in
   * the same pass — the site-wide visitor count cannot be the per-channel sum, since a
   * visitor who came twice through different channels would count twice.
   */
  const rows = rollupsEnabled() ? await channelRowsFromRollups(websiteId, days) : await pgSql<ChannelRow[]>`
    WITH per_session AS (
      SELECT
        coalesce(
          (array_agg(ch ORDER BY occurred_at, id) FILTER (WHERE ${pgSql.unsafe(arrivalPageviewSql("ch", "domain", "page_host"))}))[1],
          'direct'
        ) AS channel,
        count(*) AS views,
        max(vkey) AS vkey
      FROM (
        SELECT
          coalesce(nullif(trim(session_id), ''), id::text) AS sid,
          occurred_at, id,
          coalesce(channel, ${pgSql.unsafe(CHANNEL_CASE_SQL)}) AS ch,
          ${pgSql.unsafe(referrerDomainSql("referrer"))} AS domain,
          ${pgSql.unsafe(referrerDomainSql("page"))} AS page_host,
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
