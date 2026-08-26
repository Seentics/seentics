import type { TransactionSql } from "postgres";
import { sql } from "../../../db";
import type { HeatmapPointOut, HeatmapPointRow, PageSummaryRow } from "../../../platform/lib/types";

/**
 * SQL for `heatmap_points` and the stale-snapshot scan over
 * `heatmap_page_snapshots`.
 *
 * Every `websiteId` here is `websites.id` — the queries cast it to `uuid`, so
 * passing a short `website_id` raises a Postgres syntax error rather than returning
 * the wrong rows. The parameter is named for the identifier it needs because both
 * forms are `string` and the compiler cannot tell them apart.
 *
 * Only `HeatmapService` and `HeatmapEngine` may call into this file; resolving a
 * website reference is their job, done once, so nothing here takes a loose ref.
 */

function pgTimestampToIso(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString();
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}

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
    const k = `${p.websiteId}\0${p.pagePath}\0${p.eventType}\0${p.deviceType}\0${p.xPercent}\0${p.yPercent}\0${p.targetSelector}`;
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
        (website_id, page_path, event_type, device_type, x_percent, y_percent, intensity, target_selector, cap_vw, cap_vh, last_updated)
      SELECT
        wid::uuid, pp, et, dt, xp::int, yp::int, iv::int, ts, cvw::int, cvh::int, NOW()
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
        ${chunk.map((p) => p.capVh ?? null)}::int[]
      ) AS t(wid, pp, et, dt, xp, yp, iv, ts, cvw, cvh)
      ON CONFLICT (website_id, page_path, event_type, device_type, x_percent, y_percent, target_selector)
      DO UPDATE SET
        intensity    = heatmap_points.intensity + EXCLUDED.intensity,
        last_updated = NOW(),
        cap_vw       = COALESCE(EXCLUDED.cap_vw, heatmap_points.cap_vw),
        cap_vh       = COALESCE(EXCLUDED.cap_vh, heatmap_points.cap_vh)
    `;
  }

  // The aggregated cell count, not the input row count: N clicks on one cell became one
  // row with intensity=N, and that is the number the batch marker should record.
  return agg.length;
}

/**
 * SQL expression: normalize dynamic-ID segments in `page_path` so that
 * old rows stored with raw session/UUID IDs can be matched by their `:id` form.
 * Only static SQL — no user input.
 */
const NORM_PAGE_PATH_EXPR = sql.unsafe(`
  regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(page_path,
          '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '/:id', 'gi'),
        '/[a-z]-[a-z0-9]{16,}', '/:id', 'gi'),
      '/[a-z0-9]{24,}', '/:id', 'gi'),
    '/[0-9]{6,}', '/:id', 'g')
`);

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

/**
 * Pages whose stored snapshot has gone stale, for the scheduled re-capture.
 *
 * `DISTINCT ON` because a page can have both a JPEG and an HTML snapshot row
 * shape and one re-capture refreshes both. Rows with no stored artefact at all are
 * excluded — there is nothing to refresh, and the dashboard already triggers a
 * first capture on its own miss.
 *
 * `websiteId` here comes back out of the table, so callers must resolve it to a
 * `website_id` before touching S3 or `analytics_events`.
 */
export async function listStalePageSnapshots(
  staleBefore: Date,
  limit: number,
): Promise<{ websiteId: string; pagePath: string }[]> {
  const rows = await sql<{ website_id: string; page_path: string }[]>`
    SELECT DISTINCT ON (website_id, page_path) website_id::text AS website_id, page_path
    FROM heatmap_page_snapshots
    WHERE updated_at < ${staleBefore}
      AND (s3_key <> '' OR html_s3_key IS NOT NULL)
    LIMIT ${limit}
  `;
  return rows.map((r) => ({ websiteId: r.website_id, pagePath: r.page_path }));
}
