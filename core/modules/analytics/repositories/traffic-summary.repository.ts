/** Traffic channel summary: direct, organic, referral, social, email, paid, campaign. */
import { sql as pgSql } from "../../../db";
import { parseDays, windowStartIso } from "./shared";

// Host-anchored patterns: escape dots and require the domain to sit at the end of
// the referrer host (optionally behind subdomains), so e.g. 'x.com' never matches
// 'wix.com' and 'google.' never matches a path segment.
const SOCIAL_HOST_PATTERN =
  "^https?://([^/]*\\.)?(facebook\\.com|twitter\\.com|x\\.com|instagram\\.com|linkedin\\.com|pinterest\\.com|reddit\\.com|t\\.co|youtube\\.com|tiktok\\.com|snapchat\\.com)([/:?#]|$)";

const SEARCH_HOST_PATTERN =
  "^https?://([^/]*\\.)?(google|bing|duckduckgo|yahoo|baidu|yandex|ecosia|brave)\\.";

export async function getTrafficSummaryStats(
  websiteId: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const startIso = windowStartIso(days);

  const rows = await pgSql<{
    channel: string;
    views: number;
    unique_visitors: number;
    total_visitors: number;
  }[]>`
    WITH base AS (
      SELECT
        CASE
          WHEN lower(coalesce(utm_medium, '')) IN ('cpc', 'ppc', 'paid', 'paid_social', 'paidsearch', 'paid_search', 'sem')
            OR lower(coalesce(utm_medium, '')) LIKE 'paid%' THEN 'paid'
          WHEN utm_medium = 'email' OR utm_source = 'email' THEN 'email'
          WHEN utm_medium = 'social'
            OR utm_source IN ('facebook', 'twitter', 'x', 'instagram', 'linkedin', 'pinterest', 'tiktok', 'youtube', 'reddit')
            OR (referrer IS NOT NULL AND referrer ~* ${SOCIAL_HOST_PATTERN}) THEN 'social'
          WHEN referrer IS NOT NULL AND referrer ~* ${SEARCH_HOST_PATTERN} THEN 'organic'
          WHEN utm_source IS NOT NULL AND length(trim(utm_source)) > 0 THEN 'campaign'
          WHEN referrer IS NOT NULL AND length(trim(referrer)) > 0 THEN 'referral'
          ELSE 'direct'
        END AS channel,
        coalesce(nullif(trim(visitor_id), ''), session_id) AS vkey
      FROM analytics_events
      WHERE website_id = ${websiteId}
        AND event_type = 'pageview'
        AND occurred_at >= ${startIso}
    ),
    per_channel AS (
      SELECT
        channel,
        count(*)::int AS views,
        count(DISTINCT vkey)::int AS unique_visitors
      FROM base
      GROUP BY channel
    ),
    site_total AS (
      SELECT count(DISTINCT vkey)::int AS total_visitors FROM base
    )
    SELECT c.channel, c.views, c.unique_visitors, t.total_visitors
    FROM per_channel c CROSS JOIN site_total t
    ORDER BY c.views DESC
  `;

  const channels = rows.map((r) => ({
    channel: r.channel,
    views: Number(r.views),
    unique_visitors: Number(r.unique_visitors),
  }));

  return {
    website_id: websiteId,
    date_range: `${days}d`,
    channels,
    total_views: channels.reduce((s, c) => s + c.views, 0),
    // Site-wide distinct count (not the per-channel sum, which double-counts
    // visitors seen through multiple channels).
    total_visitors: Number(rows[0]?.total_visitors ?? 0),
  };
}
