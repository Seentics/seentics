import { sql as pgSql } from "../../db";
import { occurredAtToIso, parseDays, resolveSiteId } from "./shared";

export async function getExportAnalytics(
  websiteParam: string,
  query?: Record<string, string | undefined>,
) {
  const days = parseDays(query?.days, 30);
  const { siteId } = await resolveSiteId(websiteParam);
  const startIso = new Date(Date.now() - days * 86400000).toISOString();

  const rows = await pgSql<{
    event_type:   string;
    page:         string | null;
    visitor_id:   string | null;
    session_id:   string | null;
    referrer:     string | null;
    country:      string | null;
    city:         string | null;
    browser:      string | null;
    device:       string | null;
    os:           string | null;
    language:     string | null;
    utm_source:   string | null;
    utm_medium:   string | null;
    utm_campaign: string | null;
    screen_width: number | null;
    screen_height: number | null;
    occurred_at:  string;
  }[]>`
    SELECT
      event_type,
      page,
      visitor_id,
      session_id,
      referrer,
      country,
      city,
      browser,
      device,
      os,
      language,
      utm_source,
      utm_medium,
      utm_campaign,
      screen_width,
      screen_height,
      occurred_at
    FROM analytics_events
    WHERE website_id  = ${siteId}
      AND occurred_at >= ${startIso}
    ORDER BY occurred_at DESC
    LIMIT 10000
  `;

  return {
    website_id: siteId,
    date_range: `${days}d`,
    format:     "json",
    total:      rows.length,
    data: rows.map((e) => ({
      event_type:   e.event_type,
      page:         e.page,
      visitor_id:   e.visitor_id,
      session_id:   e.session_id,
      referrer:     e.referrer,
      country:      e.country,
      city:         e.city,
      browser:      e.browser,
      device:       e.device,
      os:           e.os,
      language:     e.language,
      utm_source:   e.utm_source,
      utm_medium:   e.utm_medium,
      utm_campaign: e.utm_campaign,
      screen_width:  e.screen_width,
      screen_height: e.screen_height,
      occurred_at:  occurredAtToIso(e.occurred_at),
    })),
  };
}
