import { createHash } from "node:crypto";
import { env } from "../config";
import { batchUpsertPoints } from "./heatmap-db";
import { getLayoutSnapshot, upsertLayoutSnapshot } from "./layout-db";
import { deviceTypeFromUA } from "./device";
import { extractPath, normalizeHeatmapPagePath } from "./paths";
import { heatmapScreenshotKey, layoutPathSlot } from "./keys";
import { putJpeg } from "./s3";
import { getSiteIdByWebsiteUuid, getWebsiteBySiteId } from "./website-site";
import type { HeatmapIngestEvent, HeatmapPointRow, ScreenshotJob } from "./types";
import { log as baseLog } from "./logger";

const log = baseLog.child({ category: "heatmap" });

const pgQueueCap = 50_000;
const pgBatchSize = 128;
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
    const pagePath = extractPath(ev.url ?? "");

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
    jobs.push({ siteId, url: ev.url ?? "", jpeg: raw, docW: dw, docH: dh });
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

  constructor() {
    this.bucket = env().s3.bucket;
    this.pgTimer = setInterval(() => void this.flushPoints(), pgBatchMs);
  }

  async shutdown(): Promise<void> {
    clearInterval(this.pgTimer);
    await this.flushPoints();
    await this.flushScreenshots();
  }

  private async flushPoints(): Promise<void> {
    if (this.pointBuf.length === 0) return;
    const batch = this.pointBuf.splice(0, pgBatchSize);
    try {
      await batchUpsertPoints(batch);
    } catch (e) {
      log.error({ msg: "heatmap_pg_batch_failed", n: batch.length, err: String(e) });
    }
  }

  private enqueuePoints(rows: HeatmapPointRow[]): void {
    for (const row of rows) {
      if (this.pointBuf.length >= pgQueueCap) {
        log.warn({ msg: "heatmap_point_buffer_full_drop", cap: pgQueueCap });
        break;
      }
      this.pointBuf.push(row);
    }
    if (this.pointBuf.length >= pgBatchSize) void this.flushPoints();
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

  private async ingestOneScreenshot(j: ScreenshotJob): Promise<void> {
    if (!j.siteId || j.jpeg.length < 400 || !isJpeg(j.jpeg)) return;
    const wsite = await getWebsiteBySiteId(j.siteId);
    if (!wsite || !wsite.heatmapLayoutEnabled) return;

    const norm = normalizeHeatmapPagePath(extractPath(j.url));
    const sum = createHash("sha256").update(j.jpeg).digest("hex");

    const existing = await getLayoutSnapshot(wsite.id, norm);
    if (existing && existing.content_sha256 === sum) return;

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

    await upsertLayoutSnapshot(wsite.id, norm, key, sum, dW, dH);
  }

  /** Ingest tracker-shaped rows; each must include `websiteId` (UUID). Screenshots resolve `site_id` via DB from that UUID. */
  async processEvents(events: HeatmapIngestEvent[]): Promise<void> {
    if (events.length === 0) return;
    this.enqueuePoints(eventsToPoints(events));

    const shots = events.filter((e) => e.type === "heatmap_screenshot");
    for (const ev of shots) {
      const sid = ev.siteId ?? (ev.websiteId ? await getSiteIdByWebsiteUuid(ev.websiteId) : null);
      if (sid) this.enqueueShots(eventsToScreenshotJobs(sid, [ev]));
    }

    while (this.pointBuf.length > 0) await this.flushPoints();
    await this.flushScreenshots();
  }
}

let _engine: HeatmapEngine | null = null;
export function getHeatmapEngine(): HeatmapEngine {
  if (!_engine) _engine = new HeatmapEngine();
  return _engine;
}
