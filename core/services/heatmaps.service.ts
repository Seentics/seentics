import { env } from "../config";
import { getHeatmapData, listPages, deleteHeatmaps } from "../lib/heatmap-db";
import { getLayoutSnapshot } from "../lib/layout-db";
import { normalizeHeatmapPagePath } from "../lib/paths";
import { presignGet } from "../lib/s3";
import { resolveWebsiteIds, resolveWebsiteIdsLenient } from "../lib/website-resolve";

async function resolve(
  websiteParam: string,
  lenientResolve: boolean,
): Promise<{ uuidStr: string }> {
  const { uuidStr } = lenientResolve
    ? await resolveWebsiteIdsLenient(websiteParam)
    : await resolveWebsiteIds(websiteParam);
  return { uuidStr };
}

export async function listHeatmapPages(websiteParam: string, opts: { lenientResolve: boolean }) {
  const { uuidStr } = await resolve(websiteParam, opts.lenientResolve);
  const pages = await listPages(uuidStr);
  return {
    pages: pages.map((p) => ({
      page_path: p.page_path,
      click_count: p.click_count,
      scroll_count: p.scroll_count,
      avg_scroll: p.avg_scroll,
      last_seen: p.last_seen,
    })),
  };
}

/** Raw API: pages + site ids for envelope. */
export async function listHeatmapPagesRaw(websiteParam: string) {
  const { uuidStr, siteId } = await resolveWebsiteIds(websiteParam);
  const pages = await listPages(uuidStr);
  return {
    siteId,
    uuidStr,
    pages: pages.map((p) => ({
      page_path: p.page_path,
      click_count: p.click_count,
      scroll_count: p.scroll_count,
      avg_scroll: p.avg_scroll,
      last_seen: p.last_seen,
    })),
  };
}

export async function getHeatmapPoints(
  websiteParam: string,
  pagePath: string,
  eventType: string,
  opts: { lenientResolve: boolean },
) {
  const { uuidStr } = await resolve(websiteParam, opts.lenientResolve);
  const norm = normalizeHeatmapPagePath(pagePath);
  const points = await getHeatmapData(uuidStr, norm, eventType || "click");
  return { page_path: norm, points };
}

export async function getHeatmapPointsRaw(
  websiteParam: string,
  pagePath: string,
  eventType: string,
) {
  const { uuidStr, siteId } = await resolveWebsiteIds(websiteParam);
  const norm = normalizeHeatmapPagePath(pagePath);
  const et = eventType || "click";
  const points = await getHeatmapData(uuidStr, norm, et);
  return { siteId, uuidStr, page_path: norm, event_type: et, points };
}

export async function getHeatmapLayoutSnapshot(
  websiteParam: string,
  pagePath: string,
  opts: { lenientResolve: boolean },
) {
  const { uuidStr } = await resolve(websiteParam, opts.lenientResolve);
  const norm = normalizeHeatmapPagePath(pagePath);
  const row = await getLayoutSnapshot(uuidStr, norm);
  if (!row?.s3_key) {
    return { layout: null as null };
  }

  const cfg = env();
  const expMs = cfg.presignTtlMs;
  const url = await presignGet(cfg.s3.bucket, row.s3_key, expMs);
  const deadline = new Date(Date.now() + expMs).toISOString();
  return {
    layout: {
      image_url: url,
      image_url_expires_at: deadline,
      doc_width: row.doc_width,
      doc_height: row.doc_height,
    },
  };
}

export async function bulkDeleteHeatmapPages(
  websiteParam: string,
  pagePaths: string[],
  opts: { lenientResolve: boolean },
) {
  const { uuidStr } = await resolve(websiteParam, opts.lenientResolve);
  await deleteHeatmaps(uuidStr, pagePaths);
}
