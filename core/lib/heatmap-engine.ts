import { createHash } from "node:crypto";
import { env } from "../config";
import { batchUpsertPoints } from "./heatmap-db";
import { getCachedSnapshotSha256, getLayoutSnapshot, upsertLayoutSnapshot, upsertLayoutHtmlSnapshot } from "./layout-db";
import { deviceTypeFromUA } from "./device";
import { extractPath, normalizeHeatmapPagePath } from "./paths";
import { heatmapScreenshotKey, heatmapHtmlSnapshotKey, layoutPathSlot } from "./keys";
import { putJpeg, putHtml } from "./s3";
import { getSiteIdByWebsiteUuid } from "./website-site";
import { captureAndStoreScreenshot } from "./playwright-screenshots";
import type { HeatmapIngestEvent, HeatmapPointRow, ScreenshotJob } from "./types";
import { log as baseLog } from "./logger";

const log = baseLog.child({ category: "heatmap" });

const pgQueueCap = 50_000;
const pgBatchMs = 400;
const shotQueueCap = 512;
const maxScreenshotBytes = 4 << 20;

function toFloat(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function stringVal(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function viewportCap(m: Record<string, unknown> | undefined, key: string): number | null {
  if (!m) return null;
  const v = m[key];
  const f =
    typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : null;
  if (f == null || !Number.isFinite(f)) return null;
  const i = Math.round(f);
  if (i < 100 || i > 10_000) return null; // realistic CSS viewport range
  return i;
}

function isJpeg(b: Uint8Array): boolean {
  return b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
}

function decodeScreenshotImage(data: Record<string, unknown> | undefined): Uint8Array | null {
  if (!data) return null;
  let imgStr = stringVal(data.image).trim();
  if (!imgStr) return null;
  const i = imgStr.indexOf("base64,");
  if (i >= 0) imgStr = imgStr.slice(i + 7);
  let buf: Buffer;
  try {
    buf = Buffer.from(imgStr, "base64");
  } catch {
    return null;
  }
  if (buf.length < 400 || buf.length > maxScreenshotBytes || !isJpeg(buf)) return null;
  return buf;
}

function eventsToPoints(events: HeatmapIngestEvent[]): HeatmapPointRow[] {
  const points: HeatmapPointRow[] = [];
  for (const ev of events) {
    const ua = ev.clientUa ?? "";
    const device = deviceTypeFromUA(ua);
    const data = ev.data ?? {};
    const pagePath = normalizeHeatmapPagePath(extractPath(ev.url ?? ""));

    if (ev.type === "heatmap_click") {
      const nx = Math.min(1, Math.max(0, toFloat(data.nx)));
      const ny = Math.min(1, Math.max(0, toFloat(data.ny)));
      points.push({
        websiteId: ev.websiteId,
        pagePath,
        eventType: "click",
        deviceType: device,
        xPercent: Math.round(nx * 10000),
        yPercent: Math.round(ny * 10000),
        targetSelector: stringVal(data.target),
        capVw: viewportCap(data, "vw"),
        capVh: viewportCap(data, "vh"),
      });
    } else if (ev.type === "heatmap_scroll") {
      const depth = Math.min(1, Math.max(0, toFloat(data.depth)));
      points.push({
        websiteId: ev.websiteId,
        pagePath,
        eventType: "scroll",
        deviceType: device,
        xPercent: 0,
        yPercent: Math.round(depth * 100),
        targetSelector: "",
        capVw: viewportCap(data, "vw"),
        capVh: viewportCap(data, "vh"),
      });
    }
  }
  return points;
}

function eventsToScreenshotJobs(siteId: string, events: HeatmapIngestEvent[]): ScreenshotJob[] {
  const jobs: ScreenshotJob[] = [];
  for (const ev of events) {
    if (ev.type !== "heatmap_screenshot") continue;
    const raw = decodeScreenshotImage(ev.data);
    if (!raw) continue;
    const dm = ev.data ?? {};
    let dw = Math.trunc(ev.docW ?? 0);
    let dh = Math.trunc(ev.docH ?? 0);
    const dwData = toInt(dm.doc_w);
    const dhData = toInt(dm.doc_h);
    if (dwData > 0) dw = dwData;
    if (dhData > 0) dh = dhData;
    jobs.push({
      siteId,
      websiteId: ev.websiteId,
      heatmapLayoutEnabled: ev.heatmapLayoutEnabled ?? false,
      url: ev.url ?? "",
      jpeg: raw,
      docW: dw,
      docH: dh,
    });
  }
  return jobs;
}

function toInt(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export class HeatmapEngine {
  private pointBuf: HeatmapPointRow[] = [];
  private shotBuf: ScreenshotJob[] = [];
  private pgTimer: ReturnType<typeof setInterval>;
  private bucket: string;
  /** Paths that have already had a Playwright capture triggered this lifecycle — prevents spam. */
  private playwrightTriggered = new Set<string>();

  constructor() {
    this.bucket = env().s3.bucket;
    // Both points and screenshots are flushed by the same timer so screenshots
    // are never left stranded in the buffer between processEvents calls.
    this.pgTimer = setInterval(() => {
      void this.flushPoints();
      void this.flushScreenshots();
    }, pgBatchMs);
  }

  async shutdown(): Promise<void> {
    clearInterval(this.pgTimer);
    await this.flushPoints();
    await this.flushScreenshots();
  }

  private async flushPoints(): Promise<void> {
    if (this.pointBuf.length === 0) return;
    // Drain the full buffer so a single timer tick clears large spikes.
    const batch = this.pointBuf.splice(0);
    const CHUNK = 500;
    const chunks: HeatmapPointRow[][] = [];
    for (let i = 0; i < batch.length; i += CHUNK) chunks.push(batch.slice(i, i + CHUNK));
    await Promise.all(
      chunks.map((chunk) =>
        batchUpsertPoints(chunk).catch((e: unknown) =>
          log.error({ msg: "heatmap_pg_batch_failed", n: chunk.length, err: String(e) }),
        ),
      ),
    );
  }

  private enqueuePoints(rows: HeatmapPointRow[]): void {
    let dropped = 0;
    for (const row of rows) {
      if (this.pointBuf.length >= pgQueueCap) {
        dropped++;
        continue;
      }
      this.pointBuf.push(row);
    }
    if (dropped > 0) {
      log.warn({ msg: "heatmap_point_buffer_full_drop", dropped, cap: pgQueueCap });
    }
  }

  private enqueueShots(jobs: ScreenshotJob[]): void {
    for (const j of jobs) {
      if (this.shotBuf.length >= shotQueueCap) {
        log.warn({ msg: "heatmap_screenshot_buffer_full_drop", cap: shotQueueCap });
        break;
      }
      this.shotBuf.push(j);
    }
  }

  private async flushScreenshots(): Promise<void> {
    while (this.shotBuf.length > 0) {
      const job = this.shotBuf.shift()!;
      try {
        await this.ingestOneScreenshot(job);
      } catch (e) {
        log.error({ msg: "heatmap_screenshot_ingest_failed", url: job.url, err: String(e) });
      }
    }
  }

  private triggerPlaywrightCapture(websiteId: string, siteId: string, norm: string, url: string): void {
    const key = `${websiteId}:${norm}`;
    if (this.playwrightTriggered.has(key)) return;
    try {
      const u = new URL(url);
      if (u.protocol !== "http:" && u.protocol !== "https:") return;
    } catch {
      return;
    }
    this.playwrightTriggered.add(key);
    captureAndStoreScreenshot(url, this.bucket, siteId, norm, websiteId, { force: true })
      .then(r => {
        if (r?.stored) log.info({ msg: "heatmap_playwright_auto_captured", url, norm });
      })
      .catch(err => log.warn({ msg: "heatmap_playwright_auto_failed", url, norm, err: String(err) }));
  }

  private async ingestOneScreenshot(j: ScreenshotJob): Promise<void> {
    if (!j.siteId || !j.websiteId || !j.heatmapLayoutEnabled || j.jpeg.length < 400 || !isJpeg(j.jpeg)) {
      log.info({ msg: "heatmap_tracker_screenshot_skipped", url: j.url, site_id: j.siteId, website_id: j.websiteId, layout_enabled: j.heatmapLayoutEnabled, jpeg_bytes: j.jpeg.length });
      return;
    }

    const norm = normalizeHeatmapPagePath(extractPath(j.url));
    log.info({ msg: "heatmap_tracker_screenshot_received", url: j.url, norm, website_id: j.websiteId, jpeg_bytes: j.jpeg.length });

    // Use the real URL from the tracker event to automatically capture a Playwright
    // screenshot in the background. html2canvas quality is limited; Playwright gives
    // a full, accurate page screenshot. Runs once per path per server lifecycle.
    this.triggerPlaywrightCapture(j.websiteId, j.siteId, norm, j.url);
    const sum = createHash("sha256").update(j.jpeg).digest("hex");

    const cachedSha256 = getCachedSnapshotSha256(j.websiteId, norm);
    if (cachedSha256 === sum) return;

    // Cache miss — fall back to DB to avoid re-uploading on cold cache or restart.
    if (cachedSha256 === null) {
      const existing = await getLayoutSnapshot(j.websiteId, norm);
      if (existing?.content_sha256 === sum) return;
    }

    const key = heatmapScreenshotKey(j.siteId, layoutPathSlot(j.siteId, norm));
    await putJpeg(this.bucket, key, j.jpeg);

    let dW = j.docW;
    let dH = j.docH;
    if (dW < 200) {
      log.warn({ msg: "heatmap_screenshot_missing_doc_w", url: j.url, fallback: 1280 });
      dW = 1280;
    }
    if (dH < 200) {
      log.warn({ msg: "heatmap_screenshot_missing_doc_h", url: j.url, fallback: 800 });
      dH = 800;
    }

    await upsertLayoutSnapshot(j.websiteId, norm, key, sum, dW, dH);
    log.info({ msg: "heatmap_tracker_screenshot_stored", url: j.url, norm, website_id: j.websiteId, s3_key: key, doc_w: dW, doc_h: dH });
  }

  private async ingestOneDomSnapshot(ev: HeatmapIngestEvent): Promise<void> {
    if (!ev.siteId || !ev.websiteId || !ev.heatmapLayoutEnabled) return;

    const html = typeof ev.data?.html === "string" ? ev.data.html : null;
    if (!html || html.length < 100) return;

    const norm = normalizeHeatmapPagePath(extractPath(ev.url ?? ""));
    log.info({ msg: "heatmap_dom_snapshot_received", url: ev.url, norm, website_id: ev.websiteId, html_bytes: html.length });

    const sum = createHash("sha256").update(html).digest("hex");
    const existing = await getLayoutSnapshot(ev.websiteId, norm);
    // Skip if the HTML content is identical to what we already have
    if (existing?.html_s3_key && existing.content_sha256 === sum) return;

    let dW = Math.trunc(ev.docW ?? 0);
    let dH = Math.trunc(ev.docH ?? 0);
    if (dW < 200) dW = 1280;
    if (dH < 200) dH = 800;

    const key = heatmapHtmlSnapshotKey(ev.siteId, layoutPathSlot(ev.siteId, norm));
    await putHtml(this.bucket, key, html);
    await upsertLayoutHtmlSnapshot(ev.websiteId, norm, key, sum, dW, dH);
    log.info({ msg: "heatmap_dom_snapshot_stored", url: ev.url, norm, website_id: ev.websiteId, s3_key: key });
  }

  /** Ingest tracker-shaped rows; each must include `websiteId` (UUID). Screenshots resolve `site_id` via DB from that UUID. */
  async processEvents(events: HeatmapIngestEvent[]): Promise<void> {
    if (events.length === 0) return;
    this.enqueuePoints(eventsToPoints(events));

    // Process DOM snapshots inline (not queued — they're rare, one per page per session).
    const domSnapshots = events.filter((e) => e.type === "heatmap_dom_snapshot" && e.heatmapLayoutEnabled);
    for (const ev of domSnapshots) {
      this.ingestOneDomSnapshot(ev).catch((err) =>
        log.error({ msg: "heatmap_dom_snapshot_failed", url: ev.url, err: String(err) }),
      );
    }

    // Only process screenshots where layout capture is enabled — skip siteId resolution otherwise.
    const shots = events.filter((e) => e.type === "heatmap_screenshot" && e.heatmapLayoutEnabled);
    if (shots.length > 0) {
      // Resolve all screenshot site IDs in parallel instead of serially.
      const sids = await Promise.all(
        shots.map((ev) =>
          ev.siteId
            ? Promise.resolve(ev.siteId)
            : ev.websiteId
              ? getSiteIdByWebsiteUuid(ev.websiteId)
              : Promise.resolve(null),
        ),
      );
      for (let i = 0; i < shots.length; i++) {
        const sid = sids[i];
        if (sid) this.enqueueShots(eventsToScreenshotJobs(sid, [shots[i]!]));
      }
    }
    // Points and screenshots are drained by the timer — no blocking flush here.
  }
}

let _engine: HeatmapEngine | null = null;
export function getHeatmapEngine(): HeatmapEngine {
  if (!_engine) _engine = new HeatmapEngine();
  return _engine;
}
