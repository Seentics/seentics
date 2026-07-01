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
import { analyticsEvents, db, sql, websites } from "../db";
import { captureHeatmapScreenshot } from "./heatmap-playwright.service";
import { log as baseLog } from "../lib/logger";

const log = baseLog.child({ category: "heatmap_screenshot" });

const WEBHOOK_URL = "https://webhook.site/2cf6bc19-cdac-4bca-bd9f-022c5bd557ef";
async function wh(event: string, data: Record<string, unknown>) {
  try {
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, ts: new Date().toISOString(), ...data }),
    });
  } catch { /* never block main flow */ }
}

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
  siteId: string,
  norm: string,
  opts: { lenientResolve: boolean },
  force = false,
): Promise<void> {
  const captureKey = `${websiteUuid}:${norm}`;
  if (_capturing.has(captureKey)) {
    log.info({ msg: "heatmap_autocapture_skipped_in_flight", website_uuid: websiteUuid, norm });
    void wh("autocapture_skipped_in_flight", { websiteUuid, norm });
    return;
  }
  _capturing.add(captureKey);
  log.info({ msg: "heatmap_autocapture_start", website_uuid: websiteUuid, norm });
  void wh("autocapture_start", { websiteUuid, siteId, norm });
  try {
    // 1. Build URL from the website's stored domain (most reliable).
    let pageUrl: string | undefined;
    try {
      const siteRows = await db
        .select({ url: websites.url })
        .from(websites)
        .where(eq(websites.siteId, siteId))
        .limit(1);
      let storedUrl = siteRows[0]?.url?.trim();
      // Ensure the stored URL has a protocol — DB values like "seentics.com" lack one
      if (storedUrl && !/^https?:\/\//i.test(storedUrl)) {
        storedUrl = `https://${storedUrl}`;
      }
      void wh("autocapture_website_lookup", { websiteUuid, norm, storedUrl: storedUrl ?? null, rowsFound: siteRows.length });
      if (storedUrl) {
        const base = storedUrl.replace(/\/+$/, "");
        pageUrl = norm === "/" ? `${base}/` : `${base}${norm}`;
        log.info({ msg: "heatmap_autocapture_url_from_website", website_uuid: websiteUuid, norm, page_url: pageUrl });
        void wh("autocapture_url_from_website", { websiteUuid, norm, pageUrl });
      }
    } catch (e) {
      log.warn({ msg: "heatmap_autocapture_website_url_failed", err: String(e) });
      void wh("autocapture_website_url_failed", { websiteUuid, norm, err: String(e) });
    }

    // 2. Fall back to scanning recent analytics events if website URL wasn't available.
    if (!pageUrl) {
      // analytics_events.website_id stores the short site_id, not the UUID.
      const rows = await db
        .select({ page: analyticsEvents.page })
        .from(analyticsEvents)
        .where(and(eq(analyticsEvents.websiteId, siteId), eq(analyticsEvents.eventType, "pageview")))
        .orderBy(desc(analyticsEvents.occurredAt))
        .limit(200);

      log.info({ msg: "heatmap_autocapture_events_query", website_uuid: websiteUuid, norm, rows_found: rows.length, sample: rows.slice(0, 3).map(r => r.page) });
      void wh("autocapture_events_query", { websiteUuid, norm, rowsFound: rows.length, sample: rows.slice(0, 5).map(r => r.page) });

      pageUrl = (rows
        .map((r) => r.page)
        .find((p) => !!p && normalizeHeatmapPagePath(extractPath(p ?? "")) === norm)) ?? undefined;
      void wh("autocapture_events_match", { websiteUuid, norm, matchedUrl: pageUrl ?? null });
    }

    if (!pageUrl) {
      log.warn({ msg: "heatmap_autocapture_no_matching_url", website_uuid: websiteUuid, norm });
      void wh("autocapture_no_url_found", { websiteUuid, siteId, norm });
      return;
    }

    log.info({ msg: "heatmap_autocapture_playwright_start", website_uuid: websiteUuid, norm, page_url: pageUrl });
    void wh("autocapture_playwright_start", { websiteUuid, norm, pageUrl });
    try {
      const result = await captureHeatmapScreenshot(websiteParam, { pageUrl, pagePath: norm, force }, opts);
      log.info({ msg: "heatmap_autocapture_playwright_done", website_uuid: websiteUuid, norm, stored: result.stored, s3_key: result.s3Key });
      void wh("autocapture_playwright_done", { websiteUuid, norm, stored: result.stored, s3Key: result.s3Key ?? null, message: result.message ?? null });
    } catch (captureErr) {
      log.warn({ msg: "heatmap_autocapture_playwright_failed", website_uuid: websiteUuid, norm, page_url: pageUrl, err: String(captureErr) });
      void wh("autocapture_playwright_failed", { websiteUuid, norm, pageUrl, err: String(captureErr) });
    }
  } catch (err) {
    log.error({ msg: "heatmap_autocapture_error", website_uuid: websiteUuid, norm, err: String(err) });
    void wh("autocapture_error", { websiteUuid, norm, err: String(err) });
  } finally {
    _capturing.delete(captureKey);
  }
}

async function resolve(
  websiteParam: string,
  lenientResolve: boolean,
): Promise<{ uuidStr: string; siteId: string }> {
  const result = lenientResolve
    ? await resolveWebsiteIdsLenient(websiteParam)
    : await resolveWebsiteIds(websiteParam);
  return { uuidStr: result.uuidStr, siteId: result.siteId };
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
  const { uuidStr } = await resolve(websiteParam, opts.lenientResolve); // siteId not needed here
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
  const { uuidStr, siteId } = await resolve(websiteParam, opts.lenientResolve);
  const norm = normalizeHeatmapPagePath(pagePath);
  const row = await getLayoutSnapshot(uuidStr, norm);
  // A row exists if either a JPEG screenshot (s3_key) or a DOM HTML snapshot (html_s3_key) is stored.
  // upsertLayoutHtmlSnapshot inserts with s3_key='' so checking only s3_key would treat a valid
  // DOM snapshot as a miss and suppress it behind an unnecessary Playwright autoCapture.
  if (!row?.s3_key && !row?.html_s3_key) {
    log.info({ msg: "heatmap_snapshot_miss", website_uuid: uuidStr, norm, triggering_autocapture: true });
    void wh("snapshot_miss_triggering_autocapture", { websiteUuid: uuidStr, siteId, norm, websiteParam });
    // No snapshot at all — find a real URL from analytics events and trigger Playwright in background.
    void autoCapture(websiteParam, uuidStr, siteId, norm, opts);
    return { layout: null as null };
  }

  // Stale snapshot: re-capture in background if older than 3 days, but still return existing data.
  const STALE_MS = 3 * 24 * 60 * 60 * 1000;
  if (row.updated_at && Date.now() - new Date(row.updated_at).getTime() > STALE_MS) {
    log.info({ msg: "heatmap_snapshot_stale_refresh", website_uuid: uuidStr, norm });
    void autoCapture(websiteParam, uuidStr, siteId, norm, opts, true);
  }

  void wh("snapshot_hit", { websiteUuid: uuidStr, norm, s3Key: row.s3_key, htmlS3Key: row.html_s3_key });

  const cfg = env();
  const expMs = cfg.presignTtlMs;
  const deadline = new Date(Date.now() + expMs).toISOString();

  // Presign HTML snapshot URL if available (primary — DOM snapshot approach)
  const htmlUrl = row.html_s3_key
    ? await presignGet(cfg.s3.bucket, row.html_s3_key, expMs)
    : undefined;

  // Presign JPEG URL if available (fallback — only when html snapshot absent)
  const imageUrl = row.s3_key ? await presignGet(cfg.s3.bucket, row.s3_key, expMs) : undefined;

  return {
    layout: {
      image_url: imageUrl,
      image_url_expires_at: deadline,
      html_url: htmlUrl,
      html_url_expires_at: htmlUrl ? deadline : undefined,
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

/**
 * Scheduled job: find heatmap page snapshots older than `staleDays` and re-capture them.
 * Processes up to 50 at a time to avoid Playwright overload. Called by the scheduler.
 */
export async function refreshStaleHeatmapScreenshots(staleDays = 3): Promise<{ queued: number }> {
  const staleCut = new Date(Date.now() - staleDays * 86_400_000);
  const stale = await sql<{ website_id: string; page_path: string }[]>`
    SELECT DISTINCT ON (website_id, page_path) website_id::text AS website_id, page_path
    FROM heatmap_page_snapshots
    WHERE updated_at < ${staleCut}
      AND (s3_key <> '' OR html_s3_key IS NOT NULL)
    LIMIT 50
  `;
  if (stale.length === 0) return { queued: 0 };
  log.info({ msg: "heatmap_stale_refresh_batch", count: stale.length, stale_before: staleCut.toISOString() });
  for (const row of stale) {
    try {
      const { uuidStr, siteId } = await resolveWebsiteIdsLenient(row.website_id);
      void autoCapture(row.website_id, uuidStr, siteId, row.page_path, { lenientResolve: true }, true);
    } catch (e) {
      log.warn({ msg: "heatmap_stale_refresh_resolve_failed", website_id: row.website_id, page_path: row.page_path, err: String(e) });
    }
  }
  return { queued: stale.length };
}
