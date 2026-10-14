import { sql } from "../../../db";
import type { ClickRow, ScrollRow } from "../lib/heatmap-insights";
import { NORM_PAGE_PATH_EXPR } from "./page-path-normalisation";

/**
 * The two aggregates heatmap insights are computed from.
 *
 * Grouped in SQL so the analysis sees a few hundred rows however busy the page: clicks by
 * element and tenth of the page, scroll summaries by depth and fold. Paths are matched the
 * way `heatmap-reads.repository` matches them — the stored path or its normalised form —
 * so the insight covers exactly the points the heatmap draws.
 *
 * `websiteId` is `websites.id` (cast to uuid; anything else is a Postgres error).
 */

/** Clicks per element and band, busiest first. A page with more distinct cells than this is summarised by its busiest. */
const MAX_CLICK_ROWS = 3000;

function windowStartDay(days: number): string {
  const start = Date.now() - (Math.max(1, Math.floor(days)) - 1) * 86_400_000;
  return new Date(start).toISOString().slice(0, 10);
}

function pathMatches(pagePath: string) {
  return sql`(
    regexp_replace(COALESCE(NULLIF(BTRIM(page_path), ''), '/'), '/$', '')
      = regexp_replace(COALESCE(NULLIF(BTRIM(${pagePath}), ''), '/'), '/$', '')
    OR regexp_replace(${NORM_PAGE_PATH_EXPR}, '/$', '')
      = regexp_replace(COALESCE(NULLIF(BTRIM(${pagePath}), ''), '/'), '/$', '')
  )`;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Scroll summaries by device, depth (0–100) and fold (viewport / document height, 0–100). */
export async function readScrollRows(websiteId: string, pagePath: string, days: number): Promise<ScrollRow[]> {
  const fromDay = windowStartDay(days);
  const rows = await sql`
    SELECT device_type,
           y_percent AS depth,
           CASE WHEN cap_vh IS NOT NULL AND document_height > 0
                THEN LEAST(100, round(cap_vh * 100.0 / document_height))::int END AS fold,
           sum(intensity)::bigint AS views,
           round(sum(cap_vh::bigint * intensity) FILTER (WHERE cap_vh IS NOT NULL)::numeric
             / NULLIF(sum(intensity) FILTER (WHERE cap_vh IS NOT NULL), 0)) AS viewport_px,
           round(sum(document_height::bigint * intensity) FILTER (WHERE document_height IS NOT NULL)::numeric
             / NULLIF(sum(intensity) FILTER (WHERE document_height IS NOT NULL), 0)) AS document_px
      FROM heatmap_points
     WHERE website_id = ${websiteId}::uuid
       AND event_type = 'scroll'
       AND day >= ${fromDay}::date
       AND ${pathMatches(pagePath)}
     GROUP BY device_type, y_percent, 3
  `;
  return (rows as Record<string, unknown>[]).map((r) => ({
    device: String(r.device_type ?? ""),
    depth: Math.max(0, Math.min(100, Number(r.depth) || 0)),
    fold: num(r.fold),
    views: Number(r.views) || 0,
    viewportPx: num(r.viewport_px),
    documentPx: num(r.document_px),
  }));
}

/** Clicks by device, element and tenth of the page, with the element's tag, role and pinning. */
export async function readClickRows(websiteId: string, pagePath: string, days: number): Promise<ClickRow[]> {
  const fromDay = windowStartDay(days);
  const rows = await sql`
    SELECT device_type,
           COALESCE(target_selector, '') AS selector,
           LEAST(9, y_percent / 1000) AS band,
           sum(intensity)::bigint AS clicks,
           sum(y_percent::bigint * intensity) AS y_weighted,
           (array_agg(lower(target_locator->>'tag') ORDER BY day DESC)
              FILTER (WHERE COALESCE(target_locator->>'tag', '') <> ''))[1] AS tag,
           (array_agg(target_locator->>'role' ORDER BY day DESC)
              FILTER (WHERE COALESCE(target_locator->>'role', '') <> ''))[1] AS role,
           bool_or(COALESCE(target_locator->>'seentics_id', '') <> '') AS annotated,
           bool_or(position_mode IN ('fixed', 'sticky')) AS pinned
      FROM heatmap_points
     WHERE website_id = ${websiteId}::uuid
       AND event_type = 'click'
       AND day >= ${fromDay}::date
       AND ${pathMatches(pagePath)}
     GROUP BY device_type, 2, 3
     ORDER BY clicks DESC
     LIMIT ${MAX_CLICK_ROWS}
  `;
  return (rows as Record<string, unknown>[]).map((r) => ({
    device: String(r.device_type ?? ""),
    selector: String(r.selector ?? ""),
    band: Number(r.band) || 0,
    clicks: Number(r.clicks) || 0,
    yWeighted: Number(r.y_weighted) || 0,
    tag: r.tag ? String(r.tag) : null,
    role: r.role ? String(r.role) : null,
    annotated: r.annotated === true,
    pinned: r.pinned === true,
  }));
}
