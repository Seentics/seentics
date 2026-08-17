import { env } from "../../../config";
import type { EventBus } from "../../../infrastructure/events";
import { upsertLayoutSnapshot } from "../lib/layout-db";
import { normalizeHeatmapPagePath } from "../lib/paths";
import { captureAndStoreScreenshot } from "../lib/playwright-screenshots";
import { getWebsiteBySiteId } from "../lib/website-site";
import { resolveWebsiteIds, resolveWebsiteIdsLenient } from "../../../platform/lib/website-resolve";
import type {
  BatchCaptureScreenshotResult,
  CaptureScreenshotRequest,
  CaptureScreenshotResult,
  HeatmapScreenshotCapture,
  HeatmapSettings,
  ResolvedWebsite,
} from "../interfaces";

/** Hard ceiling on one page load. Playwright's own default would hang the request. */
const CAPTURE_TIMEOUT_MS = 30_000;

/**
 * Capture a page with Playwright and record the result as the page's layout
 * snapshot.
 *
 * Takes already-resolved identifiers: `siteId` namespaces the S3 object, the
 * website UUID keys the snapshot row, and the two are not interchangeable. The
 * caller is responsible for having established that the website exists — this
 * function would otherwise happily write a snapshot row under a dangling id.
 *
 * Deduplication lives in `captureAndStoreScreenshot`: a matching content hash
 * skips the browser launch entirely, which is why `force` exists and why
 * `stored: false` is a success rather than a failure.
 */
async function captureAndUpsert(
  resolved: ResolvedWebsite,
  request: CaptureScreenshotRequest,
): Promise<CaptureScreenshotResult> {
  const normalizedPagePath = normalizeHeatmapPagePath(request.pagePath);
  const config = env();

  const result = await captureAndStoreScreenshot(
    request.pageUrl,
    config.s3.bucket,
    resolved.siteId,
    normalizedPagePath,
    resolved.websiteUuid,
    {
      viewportWidth: request.viewportWidth,
      viewportHeight: request.viewportHeight,
      waitForSelector: request.waitForSelector,
      jpegQuality: request.jpegQuality,
      force: request.force,
      checkOnly: request.checkOnly,
      timeoutMs: CAPTURE_TIMEOUT_MS,
    },
  );

  // `null` means check-only mode found nothing — a legitimate answer, not an error.
  if (!result) {
    return {
      success: true,
      stored: false,
      message: "No existing screenshot found",
    };
  }

  // Idempotent: re-running a capture for the same page rewrites the same row.
  if (result.s3Key) {
    await upsertLayoutSnapshot(
      resolved.websiteUuid,
      normalizedPagePath,
      result.s3Key,
      result.hash,
      result.width,
      result.height,
    );
  }

  return {
    success: true,
    s3Key: result.s3Key,
    imageHash: result.hash,
    imageWidth: result.width,
    imageHeight: result.height,
    sizeBytes: result.sizeBytes,
    stored: result.stored,
    message: result.stored
      ? "Screenshot captured and stored"
      : "Using existing identical screenshot (deduplication)",
  };
}

/**
 * On-demand page capture for the dashboard.
 *
 * Resolves the website reference once, through the `HeatmapSettings` port, and
 * hands resolved identifiers down. The functions this replaced each called
 * `resolveWebsiteIdsLenient` and then looked the same website up a *second* time
 * via `getWebsiteBySiteId` purely to obtain the UUID they had already resolved.
 */
export class HeatmapScreenshotService implements HeatmapScreenshotCapture {
  constructor(
    private readonly settings: HeatmapSettings,
    private readonly eventBus: EventBus,
  ) {
    // Bound up front so it can be handed to `HeatmapAutoCapture` as a plain
    // function without the caller having to remember to bind it.
    this.captureForResolved = this.captureForResolved.bind(this);
  }

  async capture(
    websiteRef: string,
    request: CaptureScreenshotRequest,
  ): Promise<CaptureScreenshotResult> {
    const target = await this.settings.getCaptureTarget(websiteRef);
    // Message preserved verbatim — the route returns it to the client as-is.
    if (!target) throw new Error("Website not found");
    return this.captureForResolved(target, request);
  }

  /**
   * The capture entry point for callers that already resolved the website —
   * `HeatmapAutoCapture` in particular, which is invoked from a request that has
   * done the resolution work.
   */
  async captureForResolved(
    resolved: ResolvedWebsite,
    request: CaptureScreenshotRequest,
  ): Promise<CaptureScreenshotResult> {
    const result = await captureAndUpsert(resolved, request);

    // Announced only when an image was actually written. A deduplicated or
    // check-only call changed nothing, and an event saying otherwise would make
    // any consumer counting captures wrong.
    if (result.stored && result.s3Key) {
      await this.eventBus.publish("heatmap.screenshot_captured", {
        websiteId: resolved.websiteUuid,
        siteId: resolved.siteId,
        pagePath: normalizeHeatmapPagePath(request.pagePath),
        s3Key: result.s3Key,
        source: "playwright",
        occurredAt: new Date(),
      });
    }

    return result;
  }

  /**
   * Capture several pages for one website, resolving it once for the whole batch.
   *
   * Sequential: the batch endpoint accepts up to 50 pages and a parallel run
   * exhausts the browser pool. Per-request errors are returned rather than thrown
   * so one unreachable page does not discard the other results.
   */
  async captureBatch(
    websiteRef: string,
    requests: CaptureScreenshotRequest[],
  ): Promise<BatchCaptureScreenshotResult[]> {
    const target = await this.settings.getCaptureTarget(websiteRef);
    if (!target) throw new Error("Website not found");

    const results: BatchCaptureScreenshotResult[] = [];
    for (const request of requests) {
      try {
        const result = await this.captureForResolved(target, request);
        results.push({
          pagePath: request.pagePath,
          success: true,
          s3Key: result.s3Key,
          stored: result.stored,
          message: result.message,
        });
      } catch (error) {
        results.push({
          pagePath: request.pagePath,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return results;
  }
}

/**
 * Capture entry point for the tracker ingest path.
 *
 * Kept as a free function using `lib/website-resolve` because its caller —
 * `routes/tracker.ts` — is a module-level Hono app with no composition root to
 * inject `HeatmapSettings` from. `ReplayEngine` resolves the same way for the same
 * reason. It publishes no event for the same reason: no bus reaches here.
 *
 * The existence check stays after resolution rather than replacing it: lenient
 * resolution returns the reference for both identifiers when the website is
 * unknown, and writing a snapshot row under that would create rows nothing can
 * ever read.
 */
export async function captureHeatmapScreenshot(
  websiteRef: string,
  request: CaptureScreenshotRequest,
  opts: { lenientResolve: boolean },
): Promise<CaptureScreenshotResult> {
  const { uuidStr, siteId } = opts.lenientResolve
    ? await resolveWebsiteIdsLenient(websiteRef)
    : await resolveWebsiteIds(websiteRef);

  const website = await getWebsiteBySiteId(siteId);
  if (!website) {
    throw new Error("Website not found");
  }

  return captureAndUpsert({ siteId, websiteUuid: uuidStr, siteUrl: "" }, request);
}

export type { CaptureScreenshotRequest, CaptureScreenshotResult };
