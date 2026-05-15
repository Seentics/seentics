import { env } from "../config";
import { getWebsiteBySiteId } from "../lib/website-site";
import { upsertLayoutSnapshot } from "../lib/layout-db";
import { normalizeHeatmapPagePath } from "../lib/paths";
import { resolveWebsiteIds, resolveWebsiteIdsLenient } from "../lib/website-resolve";
import { captureAndStoreScreenshot } from "../lib/playwright-screenshots";

export interface CaptureScreenshotRequest {
  /**
   * Target page URL to screenshot
   */
  pageUrl: string;

  /**
   * Heatmap page path (usually the pathname of the target URL)
   */
  pagePath: string;

  /**
   * Viewport width for screenshot (defaults to 1920)
   */
  viewportWidth?: number;

  /**
   * Viewport height for screenshot (defaults to 1080)
   */
  viewportHeight?: number;

  /**
   * Wait for specific CSS selector before capturing (optional)
   */
  waitForSelector?: string;

  /**
   * JPEG quality 1-100 (defaults to 85)
   */
  jpegQuality?: number;

  /**
   * Force capture and storage even if identical screenshot exists.
   * If false (default), uses existing screenshot if hash matches.
   * (Deduplication: same as tracker heatmap_screenshot flow)
   */
  force?: boolean;

  /**
   * Check if screenshot exists without capturing (defaults to false)
   */
  checkOnly?: boolean;
}

/**
 * Capture a screenshot of a webpage and store layout snapshot in database.
 * This service integrates Playwright with the existing heatmap infrastructure.
 *
 * Features:
 * - Smart deduplication: skips capture/storage if identical screenshot already exists
 * - Check-only mode: verify existence without capturing
 * - Force refresh: bypass deduplication if needed
 *
 * @param websiteParam Website identifier (URL, UUID, or site ID)
 * @param request Screenshot capture request details
 * @param opts Resolution options for website lookup
 *
 * @throws Error if website not found, URL invalid, or capture fails
 */
export async function captureHeatmapScreenshot(
  websiteParam: string,
  request: CaptureScreenshotRequest,
  opts: { lenientResolve: boolean },
): Promise<{
  success: boolean;
  s3Key?: string;
  imageHash?: string;
  imageWidth?: number;
  imageHeight?: number;
  sizeBytes?: number;
  stored: boolean; // true if newly captured, false if reused existing
  message?: string;
}> {
  // Resolve website
  const { uuidStr, siteId } = opts.lenientResolve
    ? await resolveWebsiteIdsLenient(websiteParam)
    : await resolveWebsiteIds(websiteParam);

  // Verify website exists
  const website = await getWebsiteBySiteId(siteId);
  if (!website) {
    throw new Error("Website not found");
  }

  // Normalize page path
  const normalizedPagePath = normalizeHeatmapPagePath(request.pagePath);

  // Get config
  const config = env();

  // Capture and store screenshot (with smart deduplication)
  const result = await captureAndStoreScreenshot(
    request.pageUrl,
    config.s3.bucket,
    siteId,
    normalizedPagePath,
    uuidStr,
    {
      viewportWidth: request.viewportWidth,
      viewportHeight: request.viewportHeight,
      waitForSelector: request.waitForSelector,
      jpegQuality: request.jpegQuality,
      force: request.force,
      checkOnly: request.checkOnly,
      waitForNetworkIdle: true,
      timeoutMs: 30000,
    },
  );

  // If result is null (check-only mode with no existing screenshot)
  if (!result) {
    return {
      success: true,
      stored: false,
      message: "No existing screenshot found",
    };
  }

  // Upsert layout snapshot in database (idempotent)
  if (result.s3Key) {
    await upsertLayoutSnapshot(
      website.id,
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
 * Batch capture screenshots for multiple pages.
 * Processes sequentially to avoid overwhelming the browser.
 *
 * Features:
 * - Smart deduplication: reuses identical existing screenshots
 * - Sequential processing: prevents browser pool exhaustion
 * - Per-request error isolation: one failure doesn't break the batch
 * - Progress tracking: see which pages are captured vs reused
 *
 * @param websiteParam Website identifier
 * @param requests Array of screenshot requests
 * @param opts Resolution options
 *
 * @returns Array of results (one per request)
 */
export async function batchCaptureHeatmapScreenshots(
  websiteParam: string,
  requests: CaptureScreenshotRequest[],
  opts: { lenientResolve: boolean },
): Promise<
  Array<{
    pagePath: string;
    success: boolean;
    s3Key?: string;
    stored?: boolean; // true if newly captured, false if reused
    message?: string;
    error?: string;
  }>
> {
  const results = [];

  for (const request of requests) {
    try {
      const result = await captureHeatmapScreenshot(websiteParam, request, opts);
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
