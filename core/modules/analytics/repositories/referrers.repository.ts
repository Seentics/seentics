/** Top referrers, attributed per session. */
import { analyticsReadSql as pgSql } from "../../../db";
import { referrerDomainSql } from "../lib/dimension-sql";
import { CHANNEL_CASE_SQL } from "../lib/traffic-channel";
import { parseDays, windowStartIso } from "./shared";
import { rollupsEnabled, topRows } from "../rollups/reads";

export type SessionReferrerRow = { referrer: string; views: number; unique_visitors: number };

/**
 * Pageviews and visitors per referring domain, where every pageview of a session is
 * credited to the domain the session arrived from. Shared by top-referrers and
 * dimensions-bulk. Grouped by domain (`google.com`, `t.co`), not by full referrer URL:
 * by URL every shared link was its own row, and the UI re-merged them by domain from
 * the top 50 only, summing unique visitors across rows as it went.
 *
 * A session's referrer is its external referrer, or 'direct' when it has none. In-site
 * navigation (`channel = 'internal'`) never counts: previously this took the session's
 * *first* referrer, so a session that began mid-visit — its first pageview reached from
 * another page of the site — listed the site itself as a referrer.
 *
 * One grouping pass per session instead of `first_value() OVER (PARTITION BY session_id
 * ORDER BY occurred_at)`, which sorted every pageview in the window by session and was
 * the bulk of this query's cost. If a session somehow has two different external
 * referrers, the greatest is taken — deterministic, and vanishingly rare once internal
 * navigation is excluded.
 */
export async function sessionReferrerRows(websiteId: string, days: number, limit = 50): Promise<SessionReferrerRow[]> {
  if (rollupsEnabled()) {
    return (await topRows(websiteId, "referrer", days, limit)).map((r) => ({
      referrer: r.k, views: r.views, unique_visitors: r.unique_visitors,
    }));
  }
  const startIso = windowStartIso(days);
  return pgSql<SessionReferrerRow[]>`
    WITH per_session AS (
      SELECT
        coalesce(
          max(domain) FILTER (WHERE ch <> 'internal'),
          'direct'
        ) AS referrer,
        count(*) AS views,
        max(vk) AS vk
      FROM (
        SELECT
          session_id,
          ${pgSql.unsafe(referrerDomainSql("referrer"))} AS domain,
          coalesce(channel, ${pgSql.unsafe(CHANNEL_CASE_SQL)}) AS ch,
          coalesce(nullif(trim(visitor_id), ''), session_id) AS vk
        FROM analytics_events
        WHERE website_id = ${websiteId}
          AND event_type = 'pageview'
          AND occurred_at >= ${startIso}
          AND session_id IS NOT NULL
          AND length(trim(session_id)) > 0
      ) pv
      GROUP BY session_id
    )
    SELECT referrer, sum(views)::int AS views, count(DISTINCT vk)::int AS unique_visitors
    FROM per_session
    GROUP BY referrer
    ORDER BY views DESC, referrer ASC
    LIMIT ${limit}
  `;
}

export async function getReferrersAnalytics(
  websiteId: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const rows = await sessionReferrerRows(websiteId, days);

  return {
    top_referrers: rows.map((r) => ({
      referrer: r.referrer ?? "direct",
      views: Number(r.views),
      unique: Number(r.unique_visitors),
    })),
  };
}
