import { sql } from "../db";
import type { HeatmapPointOut, HeatmapPointRow, PageSummaryRow } from "./types";

function pgTimestampToIso(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString();
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}

export async function batchUpsertPoints(rows: HeatmapPointRow[]): Promise<void> {
  if (rows.length === 0) return;
  await sql.begin(async (tx) => {
    for (const p of rows) {
      await tx`
        INSERT INTO heatmap_points
          (website_id, page_path, event_type, device_type, x_percent, y_percent, intensity, target_selector, cap_vw, cap_vh, last_updated)
        VALUES (
          ${p.websiteId}::uuid,
          ${p.pagePath},
          ${p.eventType},
          ${p.deviceType},
          ${p.xPercent},
          ${p.yPercent},
          1,
          ${p.targetSelector},
          ${p.capVw},
          ${p.capVh},
          NOW()
        )
        ON CONFLICT (website_id, page_path, event_type, device_type, x_percent, y_percent, target_selector)
        DO UPDATE SET
          intensity = heatmap_points.intensity + 1,
          last_updated = NOW(),
          cap_vw = COALESCE(EXCLUDED.cap_vw, heatmap_points.cap_vw),
          cap_vh = COALESCE(EXCLUDED.cap_vh, heatmap_points.cap_vh)
      `;
    }
  });
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
      AND regexp_replace(
            COALESCE(NULLIF(BTRIM(page_path), ''), '/'),
            '/$', ''
          ) = regexp_replace(
            COALESCE(NULLIF(BTRIM(${pagePath}), ''), '/'),
            '/$', ''
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

export async function deleteHeatmaps(websiteId: string, pagePaths: string[]): Promise<void> {
  if (pagePaths.length === 0) return;
  await sql`
    DELETE FROM heatmap_points
    WHERE website_id = ${websiteId}::uuid AND page_path = ANY(${pagePaths})
  `;
}
