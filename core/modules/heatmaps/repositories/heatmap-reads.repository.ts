import { sql } from "../../../db";
import type { HeatmapPointOut } from "../../../platform/lib/types";
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

export async function getHeatmapData(
  websiteId: string,
  pagePath: string,
  eventType: string,
): Promise<HeatmapPointOut[]> {
  const rows = await sql`
    SELECT page_path, event_type, device_type, x_percent, y_percent, intensity,
           COALESCE(target_selector, '') AS target_selector,
           cap_vw, cap_vh
    FROM heatmap_points
    WHERE website_id = ${websiteId}::uuid
      AND event_type = ${eventType}
      AND (
        regexp_replace(COALESCE(NULLIF(BTRIM(page_path), ''), '/'), '/$', '')
          = regexp_replace(COALESCE(NULLIF(BTRIM(${pagePath}), ''), '/'), '/$', '')
        OR regexp_replace(${NORM_PAGE_PATH_EXPR}, '/$', '')
          = regexp_replace(COALESCE(NULLIF(BTRIM(${pagePath}), ''), '/'), '/$', '')
      )
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
  }));
}

export async function listPages(websiteId: string): Promise<PageSummaryRow[]> {
  const rows = await sql`
    SELECT page_path,
           COALESCE(SUM(CASE WHEN event_type = 'click'  THEN intensity ELSE 0 END), 0)::int AS click_count,
           COALESCE(SUM(CASE WHEN event_type = 'scroll' THEN intensity ELSE 0 END), 0)::int AS scroll_count,
           COALESCE(AVG(CASE WHEN event_type = 'scroll' THEN y_percent END), 0)::int AS avg_scroll_raw,
           MAX(last_updated) AS last_seen
    FROM heatmap_points
    WHERE website_id = ${websiteId}::uuid
    GROUP BY page_path
    ORDER BY click_count DESC
  `;
  return (rows as Record<string, unknown>[]).map((r) => ({
    page_path: String(r.page_path),
    click_count: Number(r.click_count),
    scroll_count: Number(r.scroll_count),
    avg_scroll: Math.floor(Number(r.avg_scroll_raw) / 100),
    last_seen: pgTimestampToIso(r.last_seen),
  }));
}
