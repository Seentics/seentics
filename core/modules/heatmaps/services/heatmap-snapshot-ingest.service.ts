import { createHash } from "node:crypto";
import {
  getCachedSnapshotSha256,
  getLayoutSnapshot,
  markLayoutSnapshotChecked,
  upsertLayoutSnapshot,
  upsertLayoutHtmlSnapshot,
} from "../lib/layout-db";
import {
  layoutVersionBudget,
  pruneLayoutVersions,
  upsertLayoutVersion,
} from "../repositories/heatmap-versions.repository";
import { extractPath, heatmapPagePathForEvent, normalizeHeatmapPagePath } from "../lib/paths";
import { heatmapScreenshotKey, heatmapHtmlSnapshotKey, layoutPathSlot } from "../lib/keys";
import { snapshotDeviceBucket, snapshotDeviceBucketForWidth, type SnapshotDeviceBucket } from "../lib/device";
import { validateScreenshotTargetUrl } from "../../../platform/http/origin";
import { deleteS3Objects, putJpeg, putHtml } from "../../../platform/storage/s3";
import { takeRateToken } from "../../../platform/cache/token-bucket";
import { captureAndStoreScreenshot } from "../lib/playwright-screenshots";
import type { HeatmapIngestEvent, ScreenshotJob } from "../interfaces";
import type { TrackerWebsites } from "../../websites/interfaces";
import type { StylesheetDiscovery } from "../../recordings/interfaces";
import { log as baseLog } from "../../../platform/observability/logger";
import { isJpeg } from "./heatmap-data-normalization.service";
import { STALE_MS } from "./heatmap-layout-snapshot.service";

const log = baseLog.child({ category: "heatmap" });

/** Below this a "JPEG" cannot contain a real page. */
const MIN_JPEG_BYTES = 400;
/** Below this a document dimension is a client bug; render at a sane default instead. */
const MIN_DOC_PX = 200;
const FALLBACK_DOC_W = 1280;
const FALLBACK_DOC_H = 800;
/** Below this an HTML snapshot cannot be a real page. */
const MIN_HTML_BYTES = 100;
/** A stored background this much taller than an incoming one is the more complete picture. */
const TALLER_SNAPSHOT_RATIO = 1.5;

/**
 * Bounds on what anonymous DOM snapshots can make this service store.
 *
 * Snapshots arrive through `/collect`, which is unauthenticated, and a snapshot carrying
 * `page_version` used to mint a new storage object and version row for every fingerprint it
 * named — forever, and replacing the page's background each time. Legitimate version tracking
 * sees a handful of fingerprints per page (a redesign, an A/B arm, a logged-in variant), so
 * these sit well above that and far below what a script inventing fingerprints would reach.
 */
export type SnapshotIngestLimits = {
  /** Versions kept per page and device; the least recently seen beyond it are pruned. */
  maxVersionsPerPage: number;
  /** New fingerprints one site may start recording per rolling day. */
  maxNewVersionsPerDay: number;
  /** DOM snapshot writes (objects actually uploaded) per site per minute. */
  domWritesPerMinute: number;
  /** Playwright re-captures one site's ingest may trigger per hour. */
  autoCapturesPerHour: number;
};

export const DEFAULT_SNAPSHOT_INGEST_LIMITS: SnapshotIngestLimits = {
  maxVersionsPerPage: 25,
  maxNewVersionsPerDay: 200,
  domWritesPerMinute: 60,
  autoCapturesPerHour: 30,
};

/**
 * How many paths the Playwright trigger remembers, and for how long.
 *
 * The set used to be unbounded and keyed on paths taken straight from tracker URLs, so any
 * client could grow it without limit. Oldest-first eviction keeps it a fixed size; the TTL
 * means a page is re-captured at most daily rather than once per process lifetime, which also
 * picks up a redesign on a long-running instance.
 */
const PLAYWRIGHT_TRIGGERED_MAX = 10_000;
const PLAYWRIGHT_TRIGGERED_TTL_MS = 24 * 60 * 60_000;

/**
 * What a stored DOM snapshot may do when the dashboard renders it.
 *
 * The snapshot is page content any visitor's browser could have posted for the site, and
 * the dashboard runs its scripts (the tracker's measurement and click-mapping script has
 * to run). This lets them draw and talk to the dashboard over `postMessage`, and nothing
 * else: no fetch, XHR, WebSocket or beacon, no form submission, no frames, no plugins.
 *
 * It travels inside the document because the iframe `csp` attribute that used to carry
 * it is CSP Embedded Enforcement: Chromium then refuses to load any response that does
 * not opt in with `Allow-CSP-From` or a matching CSP header, and a presigned object-store
 * URL can send neither — so every HTML snapshot rendered blank and no click was drawn.
 *
 * No `base-uri`: the tracker adds a `<base href>` so the page's relative stylesheets and
 * images resolve against the site, and the snapshot is unreadable without it.
 */
const SNAPSHOT_CSP = "connect-src 'none'; form-action 'none'; frame-src 'none'; object-src 'none'";

/**
 * The snapshot with `SNAPSHOT_CSP` as its very first element, after the doctype.
 *
 * First, because a meta policy only governs what the parser meets after it — placed later,
 * a script ahead of it would run unrestricted. The parser moves a `<meta>` that comes
 * before `<html>` into `<head>`, so this needs no knowledge of the document's structure.
 */
export function withSnapshotPolicy(html: string): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${SNAPSHOT_CSP}">`;
  const doctype = /^\s*<!doctype[^>]*>/i.exec(html);
  if (!doctype) return meta + html;
  return doctype[0] + meta + html.slice(doctype[0].length);
}

/**
 * The page-background half of heatmap ingest.
 *
 * A heatmap is points drawn over a picture of the page, and this is where the picture
 * comes from: the tracker's own html2canvas JPEG, its DOM snapshot, and the higher-quality
 * Playwright re-capture triggered off the back of them.
 *
 * Split from `HeatmapIngestService` because the two halves share nothing but a bucket name. The
 * engine buffers points and drains them on a timer against Postgres; this talks to object
 * storage and the layout tables, one item at a time, and is where every deduplication
 * decision lives. Keeping them together meant the engine could not be exercised without
 * S3, and the storage paths could not be exercised without starting a timer.
 *
 * Deduplication is layered on purpose — an in-process cache, then the stored row, then
 * the upload — because the tracker re-sends the same page image on every session and the
 * upload is the expensive part.
 */
export class SnapshotIngestService {
  /**
   * `websiteId:path` → when its Playwright capture was triggered. Prevents re-capture spam.
   * Bounded — see `PLAYWRIGHT_TRIGGERED_MAX`. A `Map` iterates in insertion order, so the
   * first key is always the oldest and eviction is O(1).
   */
  private readonly playwrightTriggered = new Map<string, number>();

  constructor(
    private readonly bucket: string,
    /**
     * `null` on a bus-less engine — see `heatmapIngestService`. Publishing is best-effort
     * there rather than a failure.
     */
    /**
     * Resolves the website so the SSRF guard can check a capture target against the
     * site's registered domain. `null` means auto-capture is skipped rather than
     * performed unguarded.
     */
    private readonly websites: TrackerWebsites | null,
    /**
     * The recordings module's stylesheet archive. A snapshot links the site's stylesheets
     * by URL, and hashed CSS files vanish on the site's next deploy; this keeps a copy.
     * `null`: nothing is archived.
     */
    private readonly stylesheets: StylesheetDiscovery | null = null,
    private readonly limits: SnapshotIngestLimits = DEFAULT_SNAPSHOT_INGEST_LIMITS,
  ) {}

  /**
   * Store one tracker-supplied page image.
   *
   * Three chances to avoid the upload, cheapest first: the in-process hash cache, then
   * the stored row's hash on a cold cache or after a restart, then the write itself.
   */
  async storeScreenshot(job: ScreenshotJob): Promise<void> {
    if (
      !job.websiteId ||
      !job.heatmapLayoutEnabled ||
      job.jpeg.length < MIN_JPEG_BYTES ||
      !isJpeg(job.jpeg)
    ) {
      log.info({
        msg: "heatmap_tracker_screenshot_skipped",
        url: job.url,
        website_id: job.websiteId,
        layout_enabled: job.heatmapLayoutEnabled,
        jpeg_bytes: job.jpeg.length,
      });
      return;
    }

    const norm = normalizeHeatmapPagePath(extractPath(job.url));
    log.info({
      msg: "heatmap_tracker_screenshot_received",
      url: job.url,
      norm,
      website_id: job.websiteId,
      jpeg_bytes: job.jpeg.length,
    });

    // The tracker's html2canvas image is a stand-in; Playwright renders the real page.
    // Once per path per lifecycle, off the back of the first image that arrives for it.
    this.triggerPlaywrightCapture(job.websiteId, norm, job.url);

    const sum = createHash("sha256").update(job.jpeg).digest("hex");

    // This job carries no user agent — it is the tracker's own html2canvas render,
    // queued from the page. The document width is the next best signal for which
    // layout was captured, and for a page that does not scroll horizontally it is
    // the viewport width.
    const device = snapshotDeviceBucketForWidth(job.docW);

    const cachedSha256 = getCachedSnapshotSha256(job.websiteId, norm, device);
    if (cachedSha256 === sum) return;
    if (cachedSha256 === null) {
      const existing = await getLayoutSnapshot(job.websiteId, norm, device);
      if (existing?.content_sha256 === sum && existing.device_type === device) return;
    }

    const key = heatmapScreenshotKey(job.websiteId, layoutPathSlot(job.websiteId, norm, device));
    await putJpeg(this.bucket, key, job.jpeg);

    const { w: docW, h: docH } = plausibleDocSize(job.docW, job.docH, job.url);
    await upsertLayoutSnapshot(job.websiteId, norm, device, key, sum, docW, docH);
    log.info({
      msg: "heatmap_tracker_screenshot_stored",
      url: job.url,
      norm,
      website_id: job.websiteId,
      s3_key: key,
      doc_w: docW,
      doc_h: docH,
      device,
    });

  }

  /** Store one tracker DOM snapshot, skipping an unchanged one. */
  async storeDomSnapshot(ev: HeatmapIngestEvent): Promise<void> {
    const html = typeof ev.data?.html === "string" ? ev.data.html : null;

    // Logged rather than returned silently, mirroring `storeScreenshot`. A DOM snapshot
    // is the only background a page behind a login can ever get, and when one is dropped
    // here the dashboard just says "No screenshot yet" forever with nothing to explain
    // it. `layout_enabled: false` is the usual answer and was invisible.
    if (!ev.websiteId || !ev.heatmapLayoutEnabled || !html || html.length < MIN_HTML_BYTES) {
      log.info({
        msg: "heatmap_dom_snapshot_skipped",
        url: ev.url,
        website_id: ev.websiteId,
        layout_enabled: ev.heatmapLayoutEnabled,
        html_bytes: html?.length ?? 0,
      });
      return;
    }

    const norm = heatmapPagePathForEvent(ev.url ?? "", ev.data);
    log.info({
      msg: "heatmap_dom_snapshot_received",
      url: ev.url,
      norm,
      website_id: ev.websiteId,
      html_bytes: html.length,
    });

    // Same bucketing the points get (`point-mapping` calls `deviceTypeFromUA` on this
    // exact field), so a background and the clicks drawn on it always agree on layout.
    const device = snapshotDeviceBucket(ev.clientUa);

    const sum = createHash("sha256").update(html).digest("hex");
    const existing = await getLayoutSnapshot(ev.websiteId, norm, device);
    // Three conditions: a row carrying the same hash but no HTML key is a JPEG-only
    // snapshot and still needs the HTML written, and a row from a *different* bucket
    // is not this bucket's background however identical its bytes are.
    if (existing?.html_s3_key && existing.content_sha256 === sum && existing.device_type === device) {
      await markLayoutSnapshotChecked(ev.websiteId, norm, device);
      return;
    }

    const { w: docW, h: docH } = plausibleDocSize(ev.docW ?? 0, ev.docH ?? 0, ev.url ?? "", false);

    // A page that grows as it is read (a feed, a "load more" grid) is snapshotted again
    // by the tracker once it has grown. The next visitor's load-time snapshot of the same
    // page is a fraction of that height; letting it replace the fuller one put every
    // click below its bottom edge again. A recent, much taller background is kept; once
    // it is stale any capture may replace it, so a redesign still comes through.
    if (
      existing?.html_s3_key &&
      existing.device_type === device &&
      existing.doc_height > docH * TALLER_SNAPSHOT_RATIO &&
      !!existing.updated_at &&
      Date.now() - new Date(existing.updated_at).getTime() < STALE_MS
    ) {
      log.info({
        msg: "heatmap_dom_snapshot_kept_taller",
        norm,
        website_id: ev.websiteId,
        stored_height: existing.doc_height,
        incoming_height: docH,
      });
      await markLayoutSnapshotChecked(ev.websiteId, norm, device);
      return;
    }

    const pageVersion = typeof ev.data?.page_version === "string"
      ? ev.data.page_version.slice(0, 160)
      : "";

    // Everything past here uploads an object. Unchanged snapshots returned above, so this
    // counts real writes only.
    if (!takeRateToken(`heatmap-dom-snapshot:${ev.websiteId}`, this.limits.domWritesPerMinute, 60_000).allowed) {
      log.warn({ msg: "heatmap_dom_snapshot_rate_limited", norm, website_id: ev.websiteId });
      return;
    }
    let newVersion = false;
    if (pageVersion) {
      const budget = await layoutVersionBudget(ev.websiteId, norm, device, pageVersion);
      newVersion = !budget.known;
      // A fingerprint already on record may still be refreshed; only a new one is budgeted.
      // Refused outright — no object, no row, and the current background is left alone.
      if (newVersion && budget.newToday >= this.limits.maxNewVersionsPerDay) {
        log.warn({
          msg: "heatmap_dom_snapshot_version_cap",
          norm,
          website_id: ev.websiteId,
          new_today: budget.newToday,
        });
        return;
      }
    }

    const baseSlot = layoutPathSlot(ev.websiteId, norm, device);
    // Content-addressed suffix makes old variants immutable in object storage.
    const key = heatmapHtmlSnapshotKey(
      ev.websiteId,
      pageVersion ? `${baseSlot}_${sum.slice(0, 16)}` : baseSlot,
    );
    await putHtml(this.bucket, key, withSnapshotPolicy(html));
    // The path only: a query string is where tokens and emails turn up.
    const sourcePath = extractPath(ev.url ?? "").slice(0, 2048);
    await upsertLayoutHtmlSnapshot(ev.websiteId, norm, device, key, sum, docW, docH, pageVersion, sourcePath);
    if (pageVersion) {
      await upsertLayoutVersion(ev.websiteId, norm, device, pageVersion, key, sum, docW, docH);
      if (newVersion) await this.pruneVersions(ev.websiteId, norm, device);
    }
    // After the snapshot is stored, and never allowed to fail it: discovery is best-effort.
    if (this.stylesheets) {
      await this.stylesheets.discoverFromHtml(ev.websiteId, html, ev.url ?? "").catch((err) =>
        log.warn({ msg: "heatmap_stylesheet_discovery_failed", website_id: ev.websiteId, err: String(err) }),
      );
    }
    log.info({
      msg: "heatmap_dom_snapshot_stored",
      url: ev.url,
      norm,
      website_id: ev.websiteId,
      s3_key: key,
      device,
    });
  }

  /**
   * Hold a page to `maxVersionsPerPage`, oldest-seen out first, objects with them.
   *
   * Only after a *new* version is recorded, since that is the only write that can push a
   * page over. Best-effort: a failure leaves an extra version behind, never fails the
   * snapshot that was just stored.
   */
  private async pruneVersions(websiteId: string, norm: string, device: SnapshotDeviceBucket): Promise<void> {
    try {
      const orphaned = await pruneLayoutVersions(websiteId, norm, device, this.limits.maxVersionsPerPage);
      if (orphaned.length > 0) {
        await deleteS3Objects(this.bucket, orphaned);
        log.info({ msg: "heatmap_page_versions_pruned", website_id: websiteId, norm, n: orphaned.length });
      }
    } catch (err) {
      log.warn({ msg: "heatmap_page_versions_prune_failed", website_id: websiteId, norm, err: String(err) });
    }
  }

  /**
   * Ask Playwright for a proper capture of a page, once per path per day.
   *
   * Fire-and-forget: this runs off an ingest flush, and no visitor's data should wait on
   * a browser launch. The target is checked against the website's registered domain
   * first — this is an unattended path fed by a URL from a public endpoint, so an
   * unguarded capture here would be an SSRF with no user to attribute it to.
   */
  private triggerPlaywrightCapture(websiteId: string, norm: string, url: string): void {
    const key = `${websiteId}:${norm}`;
    const now = Date.now();
    const triggeredAt = this.playwrightTriggered.get(key);
    if (triggeredAt !== undefined && now - triggeredAt < PLAYWRIGHT_TRIGGERED_TTL_MS) return;
    // Re-inserted rather than updated, so an expired entry moves to the back of the order.
    this.playwrightTriggered.delete(key);
    if (this.playwrightTriggered.size >= PLAYWRIGHT_TRIGGERED_MAX) {
      this.playwrightTriggered.delete(this.playwrightTriggered.keys().next().value!);
    }
    this.playwrightTriggered.set(key, now);

    if (!this.websites) {
      // No resolver means no way to validate the domain, and capturing unguarded would
      // be the SSRF this check exists to prevent.
      log.warn({ msg: "heatmap_playwright_auto_skipped_no_resolver", norm });
      return;
    }

    this.websites
      .resolve(websiteId)
      .then((website) => {
        if (!website || !validateScreenshotTargetUrl(url, website.url)) return;
        // Per site as well as per path: distinct paths are the client's to invent, and each
        // one is a browser render.
        if (!takeRateToken(`heatmap-auto-capture:${websiteId}`, this.limits.autoCapturesPerHour, 60 * 60_000).allowed) {
          log.warn({ msg: "heatmap_playwright_auto_rate_limited", website_id: websiteId, norm });
          return;
        }
        return captureAndStoreScreenshot(url, this.bucket, websiteId, norm, { force: true }).then(
          (r) => {
            if (r?.stored) log.info({ msg: "heatmap_playwright_auto_captured", url, norm });
          },
        );
      })
      .catch((err) =>
        log.warn({ msg: "heatmap_playwright_auto_failed", url, norm, err: String(err) }),
      );
  }
}

/**
 * Document dimensions, with fallbacks for a client that reported nonsense.
 *
 * The numbers matter: heatmap points are fractions of the document, so a zero here would
 * put every point at the origin. `warn` is off for DOM snapshots, where an absent
 * dimension is routine rather than a symptom.
 */
function plausibleDocSize(
  docW: number,
  docH: number,
  url: string,
  warn = true,
): { w: number; h: number } {
  // `!Number.isFinite` is not redundant with the `< MIN` check below: that comparison is
  // *false* for NaN, so without this the fallback is skipped for the one input class that
  // cannot be stored at all. The tracker schema rejects a non-finite `doc_w` today, so
  // this half is defence in depth — but `storeDashboardScreenshot` shares this shape and
  // is reachable with NaN from `/save-screenshot`, so the two stay consistent.
  let w = Math.trunc(docW);
  let h = Math.trunc(docH);
  if (!Number.isFinite(w) || w < MIN_DOC_PX) {
    if (warn) log.warn({ msg: "heatmap_screenshot_missing_doc_w", url, fallback: FALLBACK_DOC_W });
    w = FALLBACK_DOC_W;
  }
  if (!Number.isFinite(h) || h < MIN_DOC_PX) {
    if (warn) log.warn({ msg: "heatmap_screenshot_missing_doc_h", url, fallback: FALLBACK_DOC_H });
    h = FALLBACK_DOC_H;
  }
  return { w, h };
}
