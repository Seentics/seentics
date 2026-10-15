import { analyticsReadSql as pgSql } from "../../../db";
import { occurredAtToIso, parseDays, windowStartIso } from "./shared";
import { clampRawDays, RAW_EVENT_DAYS } from "../lib/raw-window";

/** Rows one export returns. A bigger extract pages through `/analytics/events`. */
export const EXPORT_MAX_ROWS = 10_000;

export async function getExportAnalytics(
  websiteId: string,
  query?: Record<string, string | undefined>,
) {
  // A raw export: there is no raw data past 31 days (lib/raw-window.ts).
  const days = clampRawDays(parseDays(query?.days, RAW_EVENT_DAYS));
  const startIso = windowStartIso(days);

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
    WHERE website_id  = ${websiteId}
      AND occurred_at >= ${startIso}
    ORDER BY occurred_at DESC
    LIMIT ${EXPORT_MAX_ROWS + 1}
  `;
  // One row past the cap says there is more, without counting the whole window.
  const truncated = rows.length > EXPORT_MAX_ROWS;
  if (truncated) rows.length = EXPORT_MAX_ROWS;

  return {
    website_id: websiteId,
    date_range: `${days}d`,
    format:     "json",
    total:      rows.length,
    // The newest EXPORT_MAX_ROWS events only: the window holds more. `/analytics/events` pages
    // through all of them.
    truncated,
    limit:      EXPORT_MAX_ROWS,
    ...(truncated ? { note: `Only the newest ${EXPORT_MAX_ROWS.toLocaleString("en-US")} events in this window are included. Use /analytics/events to page through every event.` } : {}),
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
