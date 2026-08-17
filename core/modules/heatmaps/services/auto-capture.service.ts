import { extractPath, normalizeHeatmapPagePath } from "../lib/paths";
import { log as baseLog } from "../../../platform/lib/logger";
import { listRecentPageviewUrls } from "../repositories/pageview-url.repository";
import type {
  CaptureScreenshotRequest,
  CaptureScreenshotResult,
  ResolvedWebsite,
} from "../interfaces";
import { pageUrlOnSite } from "./shared";

const log = baseLog.child({ category: "heatmap_screenshot" });

/**
 * The capture step, as a function of already-resolved identifiers.
 *
 * Declared here — by the consumer — rather than imported from the screenshot
 * service, so this file depends on the shape it needs instead of on that class.
 * It also keeps the "resolve once" rule enforceable: there is no overload here
 * that takes a loose website reference, so nothing in this path can re-resolve.
 */
export type CaptureForResolved = (
  resolved: ResolvedWebsite,
  request: CaptureScreenshotRequest,
) => Promise<CaptureScreenshotResult>;

/**
 * Background screenshot capture for pages the dashboard asked for but has no
 * snapshot of.
 *
 * Fire-and-forget by design: the dashboard renders points without a backdrop and
 * picks the image up on a later poll. Making the request wait on a headless
 * browser would turn a fast endpoint into a ten-second one for the single request
 * unlucky enough to be first.
 *
 * The in-flight set is the load-bearing part. A dashboard polling a page with no
 * snapshot would otherwise launch a browser per poll, and Playwright under
 * concurrency exhausts the container's memory long before it exhausts the queue.
 */
export class HeatmapAutoCapture {
  /** `websiteUuid:normalizedPath` of captures currently running. */
  private readonly inFlight = new Set<string>();

  constructor(private readonly capture: CaptureForResolved) {}

  /**
   * Queue a capture and return immediately.
   *
   * `force` bypasses content-hash deduplication, which is what a stale refresh
   * needs — the point there is precisely to replace an image that still matches
   * its old hash-check shortcut.
   */
  schedule(resolved: ResolvedWebsite, normalizedPath: string, force = false): void {
    void this.run(resolved, normalizedPath, force);
  }

  private async run(
    resolved: ResolvedWebsite,
    norm: string,
    force: boolean,
  ): Promise<void> {
    const captureKey = `${resolved.websiteUuid}:${norm}`;
    if (this.inFlight.has(captureKey)) {
      log.info({
        msg: "heatmap_autocapture_skipped_in_flight",
        website_uuid: resolved.websiteUuid,
        norm,
      });
      return;
    }
    this.inFlight.add(captureKey);
    log.info({ msg: "heatmap_autocapture_start", website_uuid: resolved.websiteUuid, norm });

    try {
      const pageUrl = await this.resolvePageUrl(resolved, norm);
      if (!pageUrl) {
        log.warn({
          msg: "heatmap_autocapture_no_matching_url",
          website_uuid: resolved.websiteUuid,
          norm,
        });
        return;
      }

      log.info({
        msg: "heatmap_autocapture_playwright_start",
        website_uuid: resolved.websiteUuid,
        norm,
        page_url: pageUrl,
      });
      try {
        const result = await this.capture(resolved, { pageUrl, pagePath: norm, force });
        log.info({
          msg: "heatmap_autocapture_playwright_done",
          website_uuid: resolved.websiteUuid,
          norm,
          stored: result.stored,
          s3_key: result.s3Key,
        });
      } catch (captureErr) {
        // A page that will not load is normal — expired links, auth walls, pages
        // that 404 since the visit. Warn and move on; the next poll retries.
        log.warn({
          msg: "heatmap_autocapture_playwright_failed",
          website_uuid: resolved.websiteUuid,
          norm,
          page_url: pageUrl,
          err: String(captureErr),
        });
      }
    } catch (err) {
      log.error({
        msg: "heatmap_autocapture_error",
        website_uuid: resolved.websiteUuid,
        norm,
        err: String(err),
      });
    } finally {
      this.inFlight.delete(captureKey);
    }
  }

  /**
   * Find a concrete URL to screenshot for a normalized path.
   *
   * The website's registered domain is preferred: it is already resolved, it is
   * the domain the tracker validates against, and it needs no query. Scanning real
   * pageview URLs is the fallback for sites whose stored `url` is blank — it costs
   * a query into `analytics_events` and only finds pages someone actually visited.
   */
  private async resolvePageUrl(
    resolved: ResolvedWebsite,
    norm: string,
  ): Promise<string | undefined> {
    const fromSite = pageUrlOnSite(resolved.siteUrl, norm);
    if (fromSite) {
      log.info({
        msg: "heatmap_autocapture_url_from_website",
        website_uuid: resolved.websiteUuid,
        norm,
        page_url: fromSite,
      });
      return fromSite;
    }

    const pages = await listRecentPageviewUrls(resolved.siteId);
    log.info({
      msg: "heatmap_autocapture_events_query",
      website_uuid: resolved.websiteUuid,
      norm,
      rows_found: pages.length,
      sample: pages.slice(0, 3),
    });
    return pages.find((p) => normalizeHeatmapPagePath(extractPath(p)) === norm);
  }
}
