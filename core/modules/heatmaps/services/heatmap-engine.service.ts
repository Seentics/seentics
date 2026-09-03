import { createHash } from "node:crypto";
import { env } from "../../../config";
import type { EventBus } from "../../../infrastructure/events";
import { batchUpsertPoints } from "../repositories/heatmap.repository";
import { getCachedSnapshotSha256, getLayoutSnapshot, upsertLayoutSnapshot, upsertLayoutHtmlSnapshot } from "../lib/layout-db";
import { deviceTypeFromUA } from "../lib/device";
import { extractPath, normalizeHeatmapPagePath } from "../lib/paths";
import { heatmapScreenshotKey, heatmapHtmlSnapshotKey, layoutPathSlot } from "../lib/keys";
import { validateScreenshotTargetUrl } from "../../../platform/lib/origin";
import { putJpeg, putHtml } from "../../../platform/lib/s3";
import { captureAndStoreScreenshot } from "../lib/playwright-screenshots";
import type { HeatmapIngestEvent, HeatmapPointRow, ScreenshotJob } from "../../../platform/lib/types";
import { applyBatchOnceSql } from "../../../infrastructure/idempotency";
import type { HeatmapIngest } from "../interfaces";
import {
  trackerRowsToHeatmapEvents,
  type HeatmapTrackerEvent,
} from "./tracker-mapping";
import type { TrackerWebsites } from "../../websites/interfaces";
import { log as baseLog } from "../../../platform/lib/logger";
import { isJpeg } from "./shared";

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

/**
 * Turn tracker events into storable cells.
 *
 * The two event types share `x_percent`/`y_percent` but not their scale: a click is
 * stored at 10000× (so the heatmap does not band at 1% granularity) and a scroll depth
 * at 100×. Readers must divide by the matching factor — see `HeatmapPointOut`.
 *
 * Exported only so `tests/point-scaling.test.ts` can pin those two factors. They are a
 * wire contract the dashboard divides by, written down nowhere the compiler can check,
 * so a change here needs to fail a test rather than a rendered heatmap.
 */
export function eventsToPoints(events: HeatmapIngestEvent[]): HeatmapPointRow[] {
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

function eventsToScreenshotJobs(websiteId: string, events: HeatmapIngestEvent[]): ScreenshotJob[] {
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

/**
 * The tracker ingest path for heatmap data.
 *
 * Buffers points and screenshots and drains them on a timer, so `/collect` never
 * waits on Postgres or S3. That is also why the domain events it publishes are
 * published from the *flush*, not from `processEvents`: enqueuing is not a fact
 * about stored data, and a consumer reacting to an enqueue would sometimes be
 * reacting to rows a later failure dropped.
 */
export class HeatmapEngine implements HeatmapIngest {
  /**
   * Buffered points, each tagged with the ingest batch it arrived in.
   *
   * The tag is what makes the additive upsert replay-safe. This engine re-batches on its
   * own timer, so one ingest batch's points can span several flushes and one flush can
   * span several batches — a marker keyed on the flush would be meaningless. Grouping by
   * `batchId` at flush time means each write covers whole batches and can be skipped as a
   * unit on redelivery.
   */
  private pointBuf: (HeatmapPointRow & { batchId: string })[] = [];
  private shotBuf: ScreenshotJob[] = [];
  private pgTimer: ReturnType<typeof setInterval>;
  private bucket: string;
  /** Paths that have already had a Playwright capture triggered this lifecycle — prevents spam. */
  private playwrightTriggered = new Set<string>();

  /**
   * `null` when the engine was created lazily by `getHeatmapEngine()` rather than
   * through `initHeatmapEngine(bus)`. The composed application always calls the
   * latter from `initHeatmapsModule().start`, so in a running process the bus is
   * present; a bus-less engine is what a test or a stray early ingest gets, and
   * publishing is best-effort there rather than a failure.
   */
  constructor(
    private readonly eventBus: EventBus | null = null,
    /**
     * Resolves the website before a Playwright capture, so the SSRF guard can check
     * the target URL against the site's registered domain.
     *
     * Injected rather than imported from `platform/lib/website-for-tracker`, which is
     * where this lookup used to live — shared code holding raw SQL against the
     * websites module's table. `null` on a lazily-created engine, in which case an
     * auto-capture is skipped rather than performed unguarded.
     */
    private readonly websites: TrackerWebsites | null = null,
  ) {
    this.bucket = env().s3.bucket;
    // Both points and screenshots are flushed by the same timer so screenshots
    // are never left stranded in the buffer between processEvents calls.
    this.pgTimer = setInterval(() => {
      void this.flushPoints();
      void this.flushScreenshots();
    }, pgBatchMs);
  }

  /**
   * The site id behind a website UUID, via the injected websites port.
   *
   * Replaces `lib/website-site.ts`, which was a fourth in-process cache of the
   * `websites` table — inside heatmaps, keyed differently from the other three, and
   * invalidated by nothing. `TrackerWebsites.resolve` already caches and already
   * returns `website_id`.
   */
  private async siteIdFor(websiteId: string): Promise<string | null> {
    if (!this.websites) return null;
    const row = await this.websites.resolve(websiteId);
    return row?.id ?? null;
  }

  async shutdown(): Promise<void> {
    clearInterval(this.pgTimer);
    await this.flushPoints();
    await this.flushScreenshots();
  }

  private async flushPoints(): Promise<void> {
    if (this.pointBuf.length === 0) return;
    // Drain the full buffer so a single timer tick clears large spikes.
    const drained = this.pointBuf.splice(0);

    // Grouped by originating batch, not sliced by size: the marker guards a whole batch,
    // so a batch must not be split across two guarded writes.
    const byBatch = new Map<string, HeatmapPointRow[]>();
    for (const { batchId, ...row } of drained) {
      const group = byBatch.get(batchId);
      if (group) group.push(row);
      else byBatch.set(batchId, [row]);
    }

    const settled = await Promise.all(
      [...byBatch].map(([batchId, chunk]) =>
        applyBatchOnceSql(batchId, "heatmaps", (tx) => batchUpsertPoints(tx, chunk))
          .then(({ applied }) => (applied ? chunk : null))
          .catch((e: unknown) => {
            log.error({ msg: "heatmap_pg_batch_failed", n: chunk.length, err: String(e) });
            // Returning null rather than rethrowing keeps sibling batches alive and keeps
            // the failed rows out of the event below.
            return null;
          }),
      ),
    );
    await this.announceCollected(settled);
  }

  /**
   * Announce the points that were actually written, grouped by website.
   *
   * Grouped because a flush interleaves every site sending traffic in the same
   * 400ms window, and a consumer counting a site's activity needs its own number.
   */
  private async announceCollected(settled: (HeatmapPointRow[] | null)[]): Promise<void> {
    if (!this.eventBus) return;
    const byWebsite = new Map<string, number>();
    for (const chunk of settled) {
      if (!chunk) continue;
      for (const row of chunk) {
        byWebsite.set(row.websiteId, (byWebsite.get(row.websiteId) ?? 0) + 1);
      }
    }
    const occurredAt = new Date();
    for (const [websiteId, pointCount] of byWebsite) {
      await this.eventBus.publish("heatmap.data_collected", {
        websiteId,
        pointCount,
        occurredAt,
      });
    }
  }

  private enqueuePoints(batchId: string, rows: HeatmapPointRow[]): void {
    let dropped = 0;
    for (const row of rows) {
      if (this.pointBuf.length >= pgQueueCap) {
        dropped++;
        continue;
      }
      this.pointBuf.push({ ...row, batchId });
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
    if (this.shotBuf.length === 0) return;
    // Small concurrency (3) so one slow S3 upload doesn't serialize the whole drain.
    const workers = Array.from({ length: Math.min(3, this.shotBuf.length) }, async () => {
      for (let job = this.shotBuf.shift(); job; job = this.shotBuf.shift()) {
        try {
          await this.ingestOneScreenshot(job);
        } catch (e) {
          log.error({ msg: "heatmap_screenshot_ingest_failed", url: job.url, err: String(e) });
        }
      }
    });
    await Promise.all(workers);
  }

  private triggerPlaywrightCapture(websiteId: string, norm: string, url: string): void {
    const key = `${websiteId}:${norm}`;
    if (this.playwrightTriggered.has(key)) return;
    this.playwrightTriggered.add(key);
    if (!this.websites) {
      // No resolver means no way to validate the target domain. Skipping is the only
      // safe option: capturing unguarded would be an SSRF.
      log.warn({ msg: "heatmap_playwright_auto_skipped_no_resolver", norm });
      return;
    }
    this.websites
      .resolve(websiteId)
      .then((website) => {
        // SSRF guard: only capture URLs on the website's registered domain — never
        // IP literals, localhost, or internal hosts. Skip silently otherwise.
        if (!website || !validateScreenshotTargetUrl(url, website.url)) return;
        return captureAndStoreScreenshot(url, this.bucket, websiteId, norm, { force: true })
          .then(r => {
            if (r?.stored) log.info({ msg: "heatmap_playwright_auto_captured", url, norm });
          });
      })
      .catch(err => log.warn({ msg: "heatmap_playwright_auto_failed", url, norm, err: String(err) }));
  }

  private async ingestOneScreenshot(j: ScreenshotJob): Promise<void> {
    if (!j.websiteId || !j.heatmapLayoutEnabled || j.jpeg.length < 400 || !isJpeg(j.jpeg)) {
      log.info({ msg: "heatmap_tracker_screenshot_skipped", url: j.url, website_id: j.websiteId, layout_enabled: j.heatmapLayoutEnabled, jpeg_bytes: j.jpeg.length });
      return;
    }

    const norm = normalizeHeatmapPagePath(extractPath(j.url));
    log.info({ msg: "heatmap_tracker_screenshot_received", url: j.url, norm, website_id: j.websiteId, jpeg_bytes: j.jpeg.length });

    // Use the real URL from the tracker event to automatically capture a Playwright
    // screenshot in the background. html2canvas quality is limited; Playwright gives
    // a full, accurate page screenshot. Runs once per path per server lifecycle.
    this.triggerPlaywrightCapture(j.websiteId, norm, j.url);
    const sum = createHash("sha256").update(j.jpeg).digest("hex");

    const cachedSha256 = getCachedSnapshotSha256(j.websiteId, norm);
    if (cachedSha256 === sum) return;

    // Cache miss — fall back to DB to avoid re-uploading on cold cache or restart.
    if (cachedSha256 === null) {
      const existing = await getLayoutSnapshot(j.websiteId, norm);
      if (existing?.content_sha256 === sum) return;
    }

    const key = heatmapScreenshotKey(j.websiteId, layoutPathSlot(j.websiteId, norm));
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

    await this.eventBus?.publish("heatmap.screenshot_captured", {
      websiteId: j.websiteId,
      pagePath: norm,
      s3Key: key,
      source: "tracker",
      occurredAt: new Date(),
    });
  }

  private async ingestOneDomSnapshot(ev: HeatmapIngestEvent): Promise<void> {
    if (!ev.websiteId || !ev.websiteId || !ev.heatmapLayoutEnabled) return;

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

    const key = heatmapHtmlSnapshotKey(ev.websiteId, layoutPathSlot(ev.websiteId, norm));
    await putHtml(this.bucket, key, html);
    await upsertLayoutHtmlSnapshot(ev.websiteId, norm, key, sum, dW, dH);
    log.info({ msg: "heatmap_dom_snapshot_stored", url: ev.url, norm, website_id: ev.websiteId, s3_key: key });
  }

  /** Ingest tracker-shaped rows; each must include `websiteId` (UUID). Screenshots resolve `website_id` via DB from that UUID. */
  async processEvents(batchId: string, raw: readonly HeatmapTrackerEvent[]): Promise<void> {
    // Projection and type-filtering happen here, not in ingest: the column naming and the
    // set of heatmap event types are both this module's knowledge.
    const events = trackerRowsToHeatmapEvents(raw);
    if (events.length === 0) return;
    this.enqueuePoints(batchId, eventsToPoints(events));

    // Process DOM snapshots inline (not queued — they're rare, one per page per session).
    const domSnapshots = events.filter((e) => e.type === "heatmap_dom_snapshot" && e.heatmapLayoutEnabled);
    for (const ev of domSnapshots) {
      this.ingestOneDomSnapshot(ev).catch((err) =>
        log.error({ msg: "heatmap_dom_snapshot_failed", url: ev.url, err: String(err) }),
      );
    }

    // Only process screenshots where layout capture is enabled — skip websiteId resolution otherwise.
    const shots = events.filter((e) => e.type === "heatmap_screenshot" && e.heatmapLayoutEnabled);
    if (shots.length > 0) {
      // Resolve all screenshot site IDs in parallel instead of serially.
      const sids = await Promise.all(
        shots.map((ev) =>
          ev.websiteId
            ? Promise.resolve(ev.websiteId)
            : ev.websiteId
              ? this.siteIdFor(ev.websiteId)
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

/**
 * The process-wide engine.
 *
 * Still a singleton because its callers — `services/ingest/queues.ts`,
 * `routes/internal.ts` and the shutdown hook — are module-level and have nothing
 * to inject through. Creates a bus-less engine if nothing initialized one first,
 * so ingest keeps working whether or not events are wired.
 */
export function getHeatmapEngine(): HeatmapEngine {
  if (!_engine) _engine = new HeatmapEngine();
  return _engine;
}

/**
 * Create the engine with an event bus. Called by `initHeatmapsModule().start` before
 * anything can ingest; returns the same instance `getHeatmapEngine()` will hand out.
 *
 * Replaces an already-created engine rather than merging into it, because the only
 * legitimate caller runs at startup — calling it later would strand whatever the
 * previous engine had buffered.
 */
export function initHeatmapEngine(
  eventBus: EventBus,
  websites: TrackerWebsites,
): HeatmapEngine {
  _engine = new HeatmapEngine(eventBus, websites);
  return _engine;
}
