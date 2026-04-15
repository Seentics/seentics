/** Traffic channel summary: direct, organic, referral, social, email, paid. */
import { sql as pgSql } from "../../db";
import { parseDays, resolveSiteId } from "./shared";

export async function getTrafficSummaryStats(
  websiteParam: string,
  query: Record<string, string | undefined>,
) {
  const days = parseDays(query.days);
  const { siteId } = await resolveSiteId(websiteParam);
  const start = new Date(Date.now() - days * 86400000);
  const startIso = start.toISOString();

  const SOCIAL_DOMAINS = [
    "facebook.com", "twitter.com", "x.com", "instagram.com", "linkedin.com",
    "pinterest.com", "tiktok.com", "youtube.com", "reddit.com", "snapchat.com",
  ];
  const socialPattern = SOCIAL_DOMAINS.join("|");

  const rows = await pgSql<{
    channel: string;
    views: number;
    unique_visitors: number;
  }[]>`
    SELECT
      CASE
        WHEN utm_medium IN ('cpc', 'ppc', 'paid', 'paid_social', 'paidsearch') THEN 'paid'
        WHEN utm_medium = 'email' OR utm_source = 'email' THEN 'email'
        WHEN utm_medium = 'social'
          OR utm_source IN ('facebook', 'twitter', 'instagram', 'linkedin', 'pinterest', 'tiktok', 'youtube', 'reddit')
          OR (referrer IS NOT NULL AND referrer ~ ${socialPattern}) THEN 'social'
        WHEN referrer IS NOT NULL AND length(trim(referrer)) > 0 AND utm_source IS NULL THEN 'organic'
        WHEN utm_source IS NOT NULL AND length(trim(utm_source)) > 0 THEN 'referral'
        ELSE 'direct'
      END AS channel,
      count(*)::int AS views,
      count(DISTINCT coalesce(nullif(trim(visitor_id), ''), session_id))::int AS unique_visitors
    FROM analytics_events
    WHERE website_id = ${siteId}
      AND event_type = 'pageview'
      AND occurred_at >= ${startIso}
    GROUP BY channel
    ORDER BY views DESC
  `;

  const channels = rows.map((r) => ({
    channel: r.channel,
    views: Number(r.views),
    unique_visitors: Number(r.unique_visitors),
  }));

  return {
    website_id: siteId,
    date_range: `${days}d`,
    channels,
    total_views: channels.reduce((s, c) => s + c.views, 0),
    total_visitors: channels.reduce((s, c) => s + c.unique_visitors, 0),
  };
}
