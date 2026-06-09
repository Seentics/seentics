import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { env } from "../config";
import { getHeatmapData, listPages, deleteHeatmaps } from "../lib/heatmap-db";
import { getLayoutSnapshot, upsertLayoutSnapshot } from "../lib/layout-db";
import { extractPath, normalizeHeatmapPagePath } from "../lib/paths";
import { presignGet, putJpeg } from "../lib/s3";
import { resolveWebsiteIds, resolveWebsiteIdsLenient } from "../lib/website-resolve";
import { heatmapScreenshotKey, layoutPathSlot } from "../lib/keys";
import { getWebsiteBySiteId } from "../lib/website-site";
import { analyticsEvents, db } from "../db";
import { captureHeatmapScreenshot } from "./heatmap-playwright.service";
import { log as baseLog } from "../lib/logger";

const log = baseLog.child({ category: "heatmap_screenshot" });

/** Paths currently being captured — prevents concurrent Playwright launches for the same path. */
const _capturing = new Set<string>();

/**
 * Find a concrete pageview URL from analytics events that normalizes to `norm`,
 * then trigger a Playwright screenshot capture in the background.
 * No-ops if a capture is already in flight for this path.
 */
async function autoCapture(
  websiteParam: string,
  websiteUuid: string,
  norm: string,
  opts: { lenientResolve: boolean },
): Promise<void> {
  const captureKey = `${websiteUuid}:${norm}`;
  if (_capturing.has(captureKey)) {
    log.info({ msg: "heatmap_autocapture_skipped_in_flight", website_uuid: websiteUuid, norm });
    return;
  }
  _capturing.add(captureKey);
  log.info({ msg: "heatmap_autocapture_start", website_uuid: websiteUuid, norm });
  try {
    const rows = await db
      .select({ page: analyticsEvents.page })
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.websiteId, websiteUuid), eq(analyticsEvents.eventType, "pageview")))
      .orderBy(desc(analyticsEvents.occurredAt))
      .limit(50);

    log.info({ msg: "heatmap_autocapture_events_query", website_uuid: websiteUuid, norm, rows_found: rows.length, sample: rows.slice(0, 3).map(r => r.page) });

    const pageUrl = rows
      .map((r) => r.page)
      .find((p) => !!p && normalizeHeatmapPagePath(extractPath(p ?? "")) === norm);

    if (!pageUrl) {
      log.warn({ msg: "heatmap_autocapture_no_matching_url", website_uuid: websiteUuid, norm, rows_checked: rows.length });
      return;
    }

    log.info({ msg: "heatmap_autocapture_playwright_start", website_uuid: websiteUuid, norm, page_url: pageUrl });
    try {
      const result = await captureHeatmapScreenshot(websiteParam, { pageUrl, pagePath: norm }, opts);
      log.info({ msg: "heatmap_autocapture_playwright_done", website_uuid: websiteUuid, norm, stored: result.stored, s3_key: result.s3Key });
    } catch (captureErr) {
      log.warn({ msg: "heatmap_autocapture_playwright_failed", website_uuid: websiteUuid, norm, page_url: pageUrl, err: String(captureErr) });
    }
  } catch (err) {
    log.error({ msg: "heatmap_autocapture_error", website_uuid: websiteUuid, norm, err: String(err) });
  } finally {
    _capturing.delete(captureKey);
  }
}

async function resolve(
  websiteParam: string,
  lenientResolve: boolean,
): Promise<{ uuidStr: string }> {
  const { uuidStr } = lenientResolve
    ? await resolveWebsiteIdsLenient(websiteParam)
    : await resolveWebsiteIds(websiteParam);
  return { uuidStr };
}

function mergeNormalizedPages(pages: Awaited<ReturnType<typeof listPages>>) {
  type Acc = { page_path: string; click_count: number; scroll_count: number; scroll_sum: number; scroll_n: number; last_seen: string };
  const by = new Map<string, Acc>();
  for (const p of pages) {
    const key = normalizeHeatmapPagePath(p.page_path);
    const e = by.get(key);
    if (e) {
      e.click_count  += p.click_count;
      e.scroll_count += p.scroll_count;
      e.scroll_sum   += p.avg_scroll;
      e.scroll_n     += 1;
      if (p.last_seen > e.last_seen) e.last_seen = p.last_seen;
    } else {
      by.set(key, { page_path: key, click_count: p.click_count, scroll_count: p.scroll_count, scroll_sum: p.avg_scroll, scroll_n: 1, last_seen: p.last_seen });
    }
  }
  return [...by.values()]
    .sort((a, b) => b.click_count - a.click_count)
    .map((e) => ({
      page_path:    e.page_path,
      click_count:  e.click_count,
      scroll_count: e.scroll_count,
      avg_scroll:   e.scroll_n > 0 ? Math.round(e.scroll_sum / e.scroll_n) : 0,
      last_seen:    e.last_seen,
    }));
}

export async function listHeatmapPages(websiteParam: string, opts: { lenientResolve: boolean }) {
  const { uuidStr } = await resolve(websiteParam, opts.lenientResolve);
  const pages = await listPages(uuidStr);
  return { pages: mergeNormalizedPages(pages) };
}

/** Raw API: pages + site ids for envelope. */
export async function listHeatmapPagesRaw(websiteParam: string) {
  const { uuidStr, siteId } = await resolveWebsiteIds(websiteParam);
  const pages = await listPages(uuidStr);
  return { siteId, uuidStr, pages: mergeNormalizedPages(pages) };
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
    log.info({ msg: "heatmap_snapshot_miss", website_uuid: uuidStr, norm, triggering_autocapture: true });
    // No snapshot — find a real URL from analytics events and trigger Playwright in background.
    void autoCapture(websiteParam, uuidStr, norm, opts);
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
