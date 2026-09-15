import type { TransactionSql } from "postgres";
import { sql } from "../../../db";
import type { HeatmapPointRow } from "../interfaces";
import { NORM_PAGE_PATH_EXPR } from "./page-path-normalisation";

/**
 * Writes against `heatmap_points`.
 *
 * Alone in its own file because `batchUpsertPoints` is the least forgiving write in the
 * system — the `ON CONFLICT` *adds* to `intensity`, so a replayed batch does not
 * duplicate a row, it inflates a number indistinguishably from real traffic. Everything
 * that makes that safe (the caller's transaction, the batch marker, the in-batch
 * aggregation) is here, and nothing else is.
 */

/*
 * Every `websiteId` here is `websites.id`, and the queries cast it to `uuid` — passing
 * anything else raises a Postgres error rather than quietly returning the wrong rows.
 * Callers resolve the website once, at the service boundary; nothing here takes a loose
 * reference.
 */

export async function batchUpsertPoints(
  /**
   * The caller's transaction, so the upsert commits with the batch marker that makes it
   * replay-safe. This is the least forgiving write in the system: the `ON CONFLICT` below
   * *adds* to `intensity`, so a replayed batch does not duplicate a row — it inflates a
   * number, indistinguishably from real traffic.
   */
  tx: TransactionSql,
  rows: HeatmapPointRow[],
): Promise<number> {
  if (rows.length === 0) return 0;

  // Aggregate duplicate cells within the batch so the DB sees intensity=N instead of
  // N separate single-count rows for the same (website, page, type, device, x, y, selector).
  type Cell = HeatmapPointRow & { intensity: number };
  const cells = new Map<string, Cell>();
  for (const p of rows) {
    const k = `${p.websiteId}\0${p.pagePath}\0${p.eventType}\0${p.deviceType}\0${p.xPercent}\0${p.yPercent}\0${p.targetSelector}\0${p.pageVersion}`;
    const c = cells.get(k);
    if (c) {
      c.intensity++;
      if (p.capVw != null) c.capVw = p.capVw;
      if (p.capVh != null) c.capVh = p.capVh;
    } else {
      cells.set(k, { ...p, intensity: 1 });
    }
  }

  const agg = [...cells.values()];

  // One bulk upsert per chunk using unnest — a single round-trip vs N per the old loop.
  const CHUNK = 500;
  for (let i = 0; i < agg.length; i += CHUNK) {
    const chunk = agg.slice(i, i + CHUNK);
    await tx`
      INSERT INTO heatmap_points
        (website_id, page_path, event_type, device_type, x_percent, y_percent, intensity,
         target_selector, cap_vw, cap_vh, page_version, target_locator, target_rect,
         relative_x, relative_y, position_mode, client_x, client_y, page_x, page_y,
         scroll_x, scroll_y, document_width, document_height, device_pixel_ratio,
         tracker_version, schema_version, last_updated)
      SELECT
        wid::uuid, pp, et, dt, xp::int, yp::int, iv::int, sel, cvw::int, cvh::int,
        pv, tl::jsonb, tr::jsonb, rx::real, ry::real, pm, cx::real, cy::real,
        px::real, py::real, sx::real, sy::real, dw::int, dh::int, dpr::real,
        tv, sv::int, NOW()
      FROM unnest(
        ${chunk.map((p) => p.websiteId)}::text[],
        ${chunk.map((p) => p.pagePath)}::text[],
        ${chunk.map((p) => p.eventType)}::text[],
        ${chunk.map((p) => p.deviceType)}::text[],
        ${chunk.map((p) => p.xPercent)}::int[],
        ${chunk.map((p) => p.yPercent)}::int[],
        ${chunk.map((p) => p.intensity)}::int[],
        ${chunk.map((p) => p.targetSelector)}::text[],
        ${chunk.map((p) => p.capVw ?? null)}::int[],
        ${chunk.map((p) => p.capVh ?? null)}::int[],
        ${chunk.map((p) => p.pageVersion)}::text[],
        ${chunk.map((p) => p.targetLocator ? JSON.stringify(p.targetLocator) : null)}::text[],
        ${chunk.map((p) => p.targetRect ? JSON.stringify(p.targetRect) : null)}::text[],
        ${chunk.map((p) => p.relativeX)}::real[],
        ${chunk.map((p) => p.relativeY)}::real[],
        ${chunk.map((p) => p.positionMode)}::text[],
        ${chunk.map((p) => p.clientX)}::real[],
        ${chunk.map((p) => p.clientY)}::real[],
        ${chunk.map((p) => p.pageX)}::real[],
        ${chunk.map((p) => p.pageY)}::real[],
        ${chunk.map((p) => p.scrollX)}::real[],
        ${chunk.map((p) => p.scrollY)}::real[],
        ${chunk.map((p) => p.documentWidth)}::int[],
        ${chunk.map((p) => p.documentHeight)}::int[],
        ${chunk.map((p) => p.devicePixelRatio)}::real[],
        ${chunk.map((p) => p.trackerVersion)}::text[],
        ${chunk.map((p) => p.schemaVersion)}::int[]
      ) AS t(wid, pp, et, dt, xp, yp, iv, sel, cvw, cvh, pv, tl, tr, rx, ry, pm,
             cx, cy, px, py, sx, sy, dw, dh, dpr, tv, sv)
      ON CONFLICT (website_id, page_path, event_type, device_type, x_percent, y_percent, target_selector, page_version)
      DO UPDATE SET
        intensity    = heatmap_points.intensity + EXCLUDED.intensity,
        last_updated = NOW(),
        cap_vw       = COALESCE(EXCLUDED.cap_vw, heatmap_points.cap_vw),
        cap_vh       = COALESCE(EXCLUDED.cap_vh, heatmap_points.cap_vh),
        page_version = COALESCE(NULLIF(EXCLUDED.page_version, ''), heatmap_points.page_version),
        target_locator = COALESCE(EXCLUDED.target_locator, heatmap_points.target_locator),
        target_rect = COALESCE(EXCLUDED.target_rect, heatmap_points.target_rect),
        relative_x = COALESCE(EXCLUDED.relative_x, heatmap_points.relative_x),
        relative_y = COALESCE(EXCLUDED.relative_y, heatmap_points.relative_y),
        position_mode = EXCLUDED.position_mode,
        client_x = COALESCE(EXCLUDED.client_x, heatmap_points.client_x),
        client_y = COALESCE(EXCLUDED.client_y, heatmap_points.client_y),
        page_x = COALESCE(EXCLUDED.page_x, heatmap_points.page_x),
        page_y = COALESCE(EXCLUDED.page_y, heatmap_points.page_y),
        scroll_x = COALESCE(EXCLUDED.scroll_x, heatmap_points.scroll_x),
        scroll_y = COALESCE(EXCLUDED.scroll_y, heatmap_points.scroll_y),
        document_width = COALESCE(EXCLUDED.document_width, heatmap_points.document_width),
        document_height = COALESCE(EXCLUDED.document_height, heatmap_points.document_height),
        device_pixel_ratio = COALESCE(EXCLUDED.device_pixel_ratio, heatmap_points.device_pixel_ratio),
        tracker_version = COALESCE(NULLIF(EXCLUDED.tracker_version, ''), heatmap_points.tracker_version),
        schema_version = GREATEST(EXCLUDED.schema_version, heatmap_points.schema_version)
    `;
  }

  // The aggregated cell count, not the input row count: N clicks on one cell became one
  // row with intensity=N, and that is the number the batch marker should record.
  return agg.length;
}

export async function deleteHeatmaps(websiteId: string, pagePaths: string[]): Promise<void> {
  if (pagePaths.length === 0) return;
  await sql`
    DELETE FROM heatmap_points
    WHERE website_id = ${websiteId}::uuid
      AND (
        page_path = ANY(${pagePaths})
        OR ${NORM_PAGE_PATH_EXPR} = ANY(${pagePaths})
      )
  `;
}
