import { normalizeHeatmapPagePath } from "../lib/paths";
import { getHeatmapData, listPages } from "../repositories/heatmap.repository";
import type { HeatmapPageSummary, HeatmapPointOut } from "../interfaces";
import { mergeNormalizedPages } from "./shared";

/**
 * The heatmap aggregate reads.
 *
 * These take a resolved `websiteUuid` rather than a loose reference: resolution is
 * `HeatmapService`'s job and happens once per request. `heatmap_points.website_id`
 * is the website UUID, never the short `site_id`.
 */
export async function listHeatmapPages(
  websiteUuid: string,
): Promise<{ pages: HeatmapPageSummary[] }> {
  const pages = await listPages(websiteUuid);
  return { pages: mergeNormalizedPages(pages) };
}

export async function getHeatmapPoints(
  websiteUuid: string,
  pagePath: string,
  eventType: string,
): Promise<{ page_path: string; points: HeatmapPointOut[] }> {
  const norm = normalizeHeatmapPagePath(pagePath);
  const points = await getHeatmapData(websiteUuid, norm, eventType || "click");
  return { page_path: norm, points };
}

/**
 * Raw public API variant of `getHeatmapPoints`.
 *
 * Differs only in echoing back the resolved `event_type`, which that API puts in
 * its response envelope. Like its sibling above it takes an already-resolved
 * `websiteUuid`: the raw API's key middleware has already resolved the website in
 * order to authenticate the request, so resolving again here was a second lookup
 * for an answer the caller was already holding.
 */
export async function getHeatmapPointsRaw(
  websiteUuid: string,
  pagePath: string,
  eventType: string,
) {
  const norm = normalizeHeatmapPagePath(pagePath);
  const et = eventType || "click";
  const points = await getHeatmapData(websiteUuid, norm, et);
  return { page_path: norm, event_type: et, points };
}
