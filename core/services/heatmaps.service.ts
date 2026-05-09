import { createHash } from "node:crypto";
import { env } from "../config";
import { getHeatmapData, listPages, deleteHeatmaps } from "../lib/heatmap-db";
import { getLayoutSnapshot, upsertLayoutSnapshot } from "../lib/layout-db";
import { normalizeHeatmapPagePath } from "../lib/paths";
import { presignGet, putJpeg } from "../lib/s3";
import { resolveWebsiteIds, resolveWebsiteIdsLenient } from "../lib/website-resolve";
import { heatmapScreenshotKey, layoutPathSlot } from "../lib/keys";
import { getWebsiteBySiteId } from "../lib/website-site";

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

/**
 * Save a screenshot captured on-demand from the dashboard (html2canvas via the heatmap page).
 * Bypasses the tracker /collect flow — authenticated dashboard user triggers this directly.
 */
export async function saveDashboardScreenshot(
  websiteParam: string,
  pagePath: string,
  imageBase64: string,
  docWidth: number,
  docHeight: number,
  opts: { lenientResolve: boolean },
): Promise<void> {
  const { uuidStr: _uuidStr, siteId } = opts.lenientResolve
    ? await resolveWebsiteIdsLenient(websiteParam)
    : await resolveWebsiteIds(websiteParam);

  const norm = normalizeHeatmapPagePath(pagePath);

  // Decode base64 (strip data URL prefix if present)
  let imgStr = (imageBase64 ?? "").trim();
  const dataUrlIdx = imgStr.indexOf("base64,");
  if (dataUrlIdx >= 0) imgStr = imgStr.slice(dataUrlIdx + 7);

  let buf: Buffer;
  try {
    buf = Buffer.from(imgStr, "base64");
  } catch {
    throw new Error("invalid base64 image data");
  }

  const maxBytes = 10 * 1024 * 1024;
  if (buf.length < 400 || buf.length > maxBytes) {
    throw new Error(`screenshot size out of range: ${buf.length} bytes`);
  }
  if (buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) {
    throw new Error("image is not a valid JPEG");
  }

  const wsite = await getWebsiteBySiteId(siteId);
  if (!wsite) throw new Error("website not found");

  const cfg = env();
  const sum = createHash("sha256").update(buf).digest("hex");

  let dW = Math.trunc(docWidth ?? 0);
  let dH = Math.trunc(docHeight ?? 0);
  if (dW < 200) dW = 1280;
  if (dH < 200) dH = 800;

  const key = heatmapScreenshotKey(siteId, layoutPathSlot(siteId, norm));
  await putJpeg(cfg.s3.bucket, key, buf);
  await upsertLayoutSnapshot(wsite.id, norm, key, sum, dW, dH);
}

export async function bulkDeleteHeatmapPages(
  websiteParam: string,
  pagePaths: string[],
  opts: { lenientResolve: boolean },
) {
  const { uuidStr } = await resolve(websiteParam, opts.lenientResolve);
  await deleteHeatmaps(uuidStr, pagePaths);
}
