/** Top referrers, attributed per session. */
import { analyticsReadSql as pgSql } from "../../../db";
import { referrerDomainSql } from "../lib/dimension-sql";
import { arrivalPageviewSql, CHANNEL_CASE_SQL } from "../lib/traffic-channel";
import { topRows } from "../rollups/reads";
import { filterSql } from "../lib/filter-sql";
import { readScope, type ReadScope } from "../lib/read-scope";

export type SessionReferrerRow = { referrer: string; views: number; unique_visitors: number };

/**
 * Pageviews and visitors per referring domain, where every pageview of a session is
 * credited to the domain the session arrived from. Shared by top-referrers and
 * dimensions-bulk. Grouped by domain (`google.com`, `t.co`), not by full referrer URL:
 * by URL every shared link was its own row, and the UI re-merged them by domain from
 * the top 50 only, summing unique visitors across rows as it went.
 *
 * A session's referrer is where it arrived from: its first pageview that was an arrival at all
 * (lib/traffic-channel.ts `arrivalPageviewSql` — not in-site navigation, not the site's own hosts,
 * not a checkout or sign-in the visitor was sent to and came back from), or 'direct' when it has
 * none. It was the alphabetically greatest of all of a session's referrers, which credited a
 * visit that came from Google and returned from checkout to the checkout.
 *
 * One grouping pass per session instead of `first_value() OVER (PARTITION BY session_id
 * ORDER BY occurred_at)`; the first arrival is taken with an ordered `array_agg`.
 *
 * Filtered, a session's pageviews are those that pass the filters, and its arrival the first
 * of them that was one.
 */
export async function sessionReferrerRows(
  websiteId: string,
  { span, filters, useRollups }: Pick<ReadScope, "span" | "filters" | "useRollups">,
  limit = 50,
): Promise<SessionReferrerRow[]> {
  if (useRollups) {
    return (await topRows(websiteId, "referrer", span, limit)).map((r) => ({
      referrer: r.k, views: r.views, unique_visitors: r.unique_visitors,
    }));
  }
  return pgSql<SessionReferrerRow[]>`
    WITH per_session AS (
      SELECT
        coalesce(
          (array_agg(domain ORDER BY occurred_at, id) FILTER (WHERE ${pgSql.unsafe(arrivalPageviewSql("ch", "domain", "page_host"))}))[1],
          'direct'
        ) AS referrer,
        count(*) AS views,
        max(vk) AS vk
      FROM (
        SELECT
          session_id, occurred_at, id,
          ${pgSql.unsafe(referrerDomainSql("referrer"))} AS domain,
          ${pgSql.unsafe(referrerDomainSql("page"))} AS page_host,
          coalesce(channel, ${pgSql.unsafe(CHANNEL_CASE_SQL)}) AS ch,
          coalesce(nullif(trim(visitor_id), ''), session_id) AS vk
        FROM analytics_events
        WHERE website_id = ${websiteId}
          AND event_type = 'pageview'
          AND occurred_at >= ${span.start}
          AND occurred_at < ${span.end}
          AND session_id IS NOT NULL
          AND length(trim(session_id)) > 0
          ${filterSql(filters, websiteId, span)}
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
  const rows = await sessionReferrerRows(websiteId, readScope(query));

  return {
    top_referrers: rows.map((r) => ({
      referrer: r.referrer ?? "direct",
      views: Number(r.views),
      unique: Number(r.unique_visitors),
    })),
  };
}
