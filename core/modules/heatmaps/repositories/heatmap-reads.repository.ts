import { sql } from "../../../db";
import type { HeatmapPointOut } from "../interfaces";
import { NORM_PAGE_PATH_EXPR } from "./page-path-normalisation";
import type { PageSummaryRow } from "../interfaces";

/**
 * Reads against `heatmap_points`, for the dashboard and the raw API.
 *
 * Both queries match a requested path against the stored one *and* its normalised form,
 * because rows written before a normalisation rule existed still carry the raw path —
 * see `page-path-normalisation`.
 */

/*
 * Every `websiteId` here is `websites.id`, and the queries cast it to `uuid` — passing
 * anything else raises a Postgres error rather than quietly returning the wrong rows.
 * Callers resolve the website once, at the service boundary; nothing here takes a loose
 * reference.
 */

function pgTimestampToIso(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString();
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}

/**
 * The first UTC day inside a window of `days` days ending today, or null for no window
 * (every day still retained).
 */
function windowStartDay(days: number | undefined): string | null {
  if (days === undefined || !Number.isFinite(days) || days < 1) return null;
  const start = Date.now() - (Math.floor(days) - 1) * 86_400_000;
  return new Date(start).toISOString().slice(0, 10);
}

/**
 * A page's cells over the last `days` days (every retained day when omitted).
 *
 * Rows are one per cell per day; a cell's days are summed into one point. The cell's
 * geometry (locator, rect, viewport…) is taken from its most recent day, which is the
 * one most likely to match the page as it is now — the same choice the write path made
 * when it kept one row per cell and let each click refresh those columns.
 */
export async function getHeatmapData(
  websiteId: string,
  pagePath: string,
  eventType: string,
  days?: number,
): Promise<HeatmapPointOut[]> {
  const fromDay = windowStartDay(days);
  const rows = await sql`
    SELECT * FROM (
      SELECT DISTINCT ON (page_path, device_type, x_percent, y_percent, target_selector, page_version)
             page_path, event_type, device_type, x_percent, y_percent,
             (sum(intensity) OVER (
               PARTITION BY page_path, device_type, x_percent, y_percent, target_selector, page_version
             ))::int AS intensity,
             COALESCE(target_selector, '') AS target_selector,
             cap_vw, cap_vh, page_version, target_locator, target_rect,
             relative_x, relative_y, position_mode, client_x, client_y, page_x, page_y,
             scroll_x, scroll_y, document_width, document_height, device_pixel_ratio,
             tracker_version, schema_version
      FROM heatmap_points
      WHERE website_id = ${websiteId}::uuid
        AND event_type = ${eventType}
        AND (${fromDay}::date IS NULL OR day >= ${fromDay}::date)
        AND (
          regexp_replace(COALESCE(NULLIF(BTRIM(page_path), ''), '/'), '/$', '')
            = regexp_replace(COALESCE(NULLIF(BTRIM(${pagePath}), ''), '/'), '/$', '')
          OR regexp_replace(${NORM_PAGE_PATH_EXPR}, '/$', '')
            = regexp_replace(COALESCE(NULLIF(BTRIM(${pagePath}), ''), '/'), '/$', '')
        )
      ORDER BY page_path, device_type, x_percent, y_percent, target_selector, page_version, day DESC
    ) cells
    ORDER BY intensity DESC
  `;
  return (rows as Record<string, unknown>[]).map((r) => ({
    page_path: String(r.page_path),
    event_type: String(r.event_type),
    device_type: String(r.device_type),
    x_percent: Number(r.x_percent),
    y_percent: Number(r.y_percent),
    intensity: Number(r.intensity),
    target_selector: String(r.target_selector),
    cap_vw: r.cap_vw != null ? Number(r.cap_vw) : null,
    cap_vh: r.cap_vh != null ? Number(r.cap_vh) : null,
    page_version: String(r.page_version ?? ""),
    target_locator: (r.target_locator && typeof r.target_locator === "object")
      ? r.target_locator as Record<string, unknown>
      : null,
    target_rect: (r.target_rect && typeof r.target_rect === "object")
      ? r.target_rect as Record<string, unknown>
      : null,
    relative_x: r.relative_x != null ? Number(r.relative_x) : null,
    relative_y: r.relative_y != null ? Number(r.relative_y) : null,
    position_mode: r.position_mode === "fixed" || r.position_mode === "sticky"
      ? r.position_mode
      : "normal",
    client_x: r.client_x != null ? Number(r.client_x) : null,
    client_y: r.client_y != null ? Number(r.client_y) : null,
    page_x: r.page_x != null ? Number(r.page_x) : null,
    page_y: r.page_y != null ? Number(r.page_y) : null,
    scroll_x: r.scroll_x != null ? Number(r.scroll_x) : null,
    scroll_y: r.scroll_y != null ? Number(r.scroll_y) : null,
    document_width: r.document_width != null ? Number(r.document_width) : null,
    document_height: r.document_height != null ? Number(r.document_height) : null,
    device_pixel_ratio: r.device_pixel_ratio != null ? Number(r.device_pixel_ratio) : null,
    tracker_version: String(r.tracker_version ?? ""),
    schema_version: Number(r.schema_version ?? 1),
  }));
}

/** Every page with heatmap data over the last `days` days (every retained day when omitted). */
export async function listPages(websiteId: string, days?: number): Promise<PageSummaryRow[]> {
  const fromDay = windowStartDay(days);
  const rows = await sql`
    SELECT page_path,
           COALESCE(SUM(CASE WHEN event_type = 'click'  THEN intensity ELSE 0 END), 0)::int AS click_count,
           COALESCE(SUM(CASE WHEN event_type = 'scroll' THEN intensity ELSE 0 END), 0)::int AS scroll_count,
           -- Each scroll row is a depth (0–100) and how many page views reached it, so the
           -- average is weighted by that count — an unweighted AVG counted a depth one
           -- visitor reached the same as one a thousand did.
           COALESCE(
             SUM(CASE WHEN event_type = 'scroll' THEN y_percent * intensity END)::float
               / NULLIF(SUM(CASE WHEN event_type = 'scroll' THEN intensity END), 0),
             0
           ) AS avg_scroll_raw,
           MAX(last_updated) AS last_seen
    FROM heatmap_points
    WHERE website_id = ${websiteId}::uuid
      AND (${fromDay}::date IS NULL OR day >= ${fromDay}::date)
    GROUP BY page_path
    ORDER BY click_count DESC
  `;
  return (rows as Record<string, unknown>[]).map((r) => ({
    page_path: String(r.page_path),
    click_count: Number(r.click_count),
    scroll_count: Number(r.scroll_count),
    // Already a percentage: scroll depth is stored at 100× (point-scaling.test.ts), so the
    // division by 100 this used to do turned every page's average into 0 (or 1 at 100%).
    avg_scroll: Math.round(Number(r.avg_scroll_raw)),
    last_seen: pgTimestampToIso(r.last_seen),
  }));
}
