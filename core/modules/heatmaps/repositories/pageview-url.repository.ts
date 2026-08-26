import { and, desc, eq } from "drizzle-orm";
import { analyticsEvents, db } from "../../../db";

/**
 * How many recent pageviews to scan when hunting for a concrete URL to screenshot.
 * Large enough that a low-traffic page still appears, small enough to stay a
 * single index scan.
 */
const RECENT_PAGEVIEW_SCAN_LIMIT = 200;

/**
 * Recent pageview URLs for a site, newest first.
 *
 * A cross-module read: `analytics_events` is owned by the analytics module, and
 * heatmaps only wants it as a fallback source of *real* URLs to screenshot when a
 * page's URL cannot be derived from the website's registered domain. It is
 * isolated here rather than inlined in the service so the coupling is one import
 * to delete when analytics grows a port for it.
 *
 * Keyed by `siteId` — `analytics_events.website_id` stores the short `site_id`,
 * not the website UUID. Passing a UUID here returns an empty array rather than an
 * error, which is exactly the silent-empty failure mode this parameter name exists
 * to prevent.
 */
export async function listRecentPageviewUrls(siteId: string): Promise<string[]> {
  const rows = await db
    .select({ page: analyticsEvents.page })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.websiteId, siteId), eq(analyticsEvents.eventType, "pageview")))
    .orderBy(desc(analyticsEvents.occurredAt))
    .limit(RECENT_PAGEVIEW_SCAN_LIMIT);

  return rows.map((r) => r.page).filter((p): p is string => !!p);
}
