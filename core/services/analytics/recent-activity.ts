import { sql as pgSql } from "../../db";
import { occurredAtToIso, resolveSiteId } from "./shared";

const RECENT_ACTIVITY_DEFAULT_DAYS = 30;

export async function getRecentActivityAnalytics(
  websiteParam: string,
  limit: number,
  opts?: { withinMinutes?: number },
) {
  const { siteId } = await resolveSiteId(websiteParam);
  const withinMin = opts?.withinMinutes;
  const startIso =
    typeof withinMin === "number" && Number.isFinite(withinMin) && withinMin > 0 && withinMin <= 24 * 60
      ? new Date(Date.now() - withinMin * 60_000).toISOString()
      : new Date(Date.now() - RECENT_ACTIVITY_DEFAULT_DAYS * 86400000).toISOString();
  const cap = Math.min(limit, 100);

  const rows = await pgSql<{
    event_type: string;
    page: string | null;
    visitor_id: string | null;
    session_id: string | null;
    country: string | null;
    browser: string | null;
    device: string | null;
    os: string | null;
    referrer: string | null;
    occurred_at: string;
  }[]>`
    SELECT
      event_type,
      page,
      visitor_id,
      session_id,
      country,
      browser,
      device,
      os,
      referrer,
      occurred_at
    FROM analytics_events
    WHERE website_id  = ${siteId}
      AND occurred_at >= ${startIso}
    ORDER BY occurred_at DESC
    LIMIT ${cap}
  `;

  return {
    website_id: siteId,
    date_range:
      typeof withinMin === "number" && withinMin > 0 && withinMin <= 24 * 60
        ? `${withinMin}m`
        : `${RECENT_ACTIVITY_DEFAULT_DAYS}d`,
    activity: rows.map((e) => ({
      type:        e.event_type,
      page:        e.page,
      visitor_id:  e.visitor_id,
      session_id:  e.session_id,
      country:     e.country,
      browser:     e.browser,
      device:      e.device,
      os:          e.os,
      referrer:    e.referrer,
      occurred_at: occurredAtToIso(e.occurred_at),
    })),
  };
}
