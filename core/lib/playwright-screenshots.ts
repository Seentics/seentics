import { createHash } from "node:crypto";
import type { Page } from "playwright";
import { createScreenshotPage, closeBrowser } from "./playwright-browser";
import { putJpeg } from "./s3";
import { heatmapScreenshotKey, layoutPathSlot } from "./keys";
import { getScreenshotCache } from "./heatmap-screenshot-cache";

export interface ScreenshotOptions {
  /**
   * Page URL to capture. Must be a valid, accessible URL.
   */
  url: string;

  /**
   * Viewport width in pixels. Defaults to 1920.
   */
  viewportWidth?: number;

  /**
   * Viewport height in pixels. Defaults to 1080.
   */
  viewportHeight?: number;

  /**
   * Maximum time to wait for page load in milliseconds. Defaults to 30000.
   */
  timeoutMs?: number;

  /**
   * Whether to wait for network idle before capturing. Defaults to true.
   */
  waitForNetworkIdle?: boolean;

  /**
   * Additional CSS selector to wait for before capturing (optional).
   * Useful for waiting for specific content to render.
   */
  waitForSelector?: string;

  /**
   * Quality of JPEG output (0-100). Defaults to 85.
   */
  jpegQuality?: number;
}

interface CaptureResult {
  buffer: Buffer;
  width: number;
  height: number;
  hash: string;
}

/**
 * Capture a screenshot of a webpage using Playwright and Chromium.
 * Returns the raw JPEG buffer and metadata.
 *
 * @throws Error if the page cannot be loaded or screenshot fails
 */
/**
 * In Docker, `localhost` inside the container refers to the container itself,
 * not the host machine. Rewrite localhost URLs to host.docker.internal so
 * Playwright can reach sites running on the developer's machine.
 * Only applied when the PLAYWRIGHT_REWRITE_LOCALHOST env var is set to "true"
 * (set automatically by docker-compose in dev; never set in production).
 */
function rewriteLocalhostForDocker(url: string): string {
  if (process.env.PLAYWRIGHT_REWRITE_LOCALHOST !== "true") return url;
  try {
    const u = new URL(url);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
      u.hostname = "host.docker.internal";
      return u.toString();
    }
  } catch { /* ignore */ }
  return url;
}

export async function captureWebPageScreenshot(options: ScreenshotOptions): Promise<CaptureResult> {
  let page: Page | null = null;

  try {
    // Validate URL
    try {
      new URL(options.url);
    } catch {
      throw new Error(`Invalid URL: ${options.url}`);
    }

    const resolvedUrl = rewriteLocalhostForDocker(options.url);

    page = await createScreenshotPage();

    const timeoutMs = options.timeoutMs ?? 30000;
    const waitForNetworkIdle = options.waitForNetworkIdle ?? true;
    const jpegQuality = Math.max(1, Math.min(100, options.jpegQuality ?? 85));

    // Navigate to page with timeout
    const navigationOpts = {
      waitUntil: waitForNetworkIdle ? ("networkidle" as const) : ("load" as const),
      timeout: timeoutMs,
    };

    try {
      await page.goto(resolvedUrl, navigationOpts);
    } catch (error) {
      throw new Error(
        `Failed to navigate to URL: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Detect auth/login redirects — if the final URL path differs significantly from the
    // requested one (e.g. redirected to /login or /auth/...), the page is protected and
    // Playwright can't capture it. Throwing here prevents storing a login-page screenshot
    // under the original path key.
    try {
      const requestedPath = new URL(options.url).pathname.replace(/\/$/, '') || '/';
      const finalPath = new URL(page.url()).pathname.replace(/\/$/, '') || '/';
      const looksLikeAuthRedirect =
        finalPath !== requestedPath &&
        /\/(login|signin|sign-in|auth|sso|oauth|account\/login)/i.test(finalPath);
      if (looksLikeAuthRedirect) {
        throw new Error(`Auth redirect detected: requested ${requestedPath}, landed on ${finalPath}`);
      }
    } catch (e) {
      if ((e as Error).message.startsWith('Auth redirect')) throw e;
      // URL parse error — ignore and proceed
    }

    // Wait for optional selector
    if (options.waitForSelector) {
      try {
        await page.waitForSelector(options.waitForSelector, { timeout: timeoutMs });
      } catch {
        throw new Error(`Timeout waiting for selector: ${options.waitForSelector}`);
      }
    }

    // Get viewport dimensions for metadata
    const viewportSize = page.viewportSize();
    const width = viewportSize?.width ?? options.viewportWidth ?? 1920;
    const height = viewportSize?.height ?? options.viewportHeight ?? 1080;

    // Capture screenshot
    let screenshotBuffer: Buffer;
    try {
      screenshotBuffer = await page.screenshot({
        type: "jpeg",
        quality: jpegQuality,
        fullPage: false, // Use viewport size only
      });
    } catch (error) {
      throw new Error(
        `Screenshot capture failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!Buffer.isBuffer(screenshotBuffer)) {
      throw new Error("Failed to capture screenshot - invalid buffer");
    }

    // Validate JPEG signature
    if (screenshotBuffer[0] !== 0xff || screenshotBuffer[1] !== 0xd8 || screenshotBuffer[2] !== 0xff) {
      throw new Error("Screenshot is not a valid JPEG");
    }

    // Calculate hash
    const hash = createHash("sha256").update(screenshotBuffer).digest("hex");

    return {
      buffer: screenshotBuffer,
      width,
      height,
      hash,
    };
  } finally {
    // Always cleanup page
    if (page) {
      try {
        await page.close();
      } catch (error) {
        console.error("Error closing page:", error);
      }
    }
  }
}

export interface StoreScreenshotOptions extends Partial<ScreenshotOptions> {
  /**
   * Force capture and storage even if a screenshot already exists.
   * If false (default), skips capture if an identical screenshot exists.
   * Useful for periodic updates of page screenshots.
   */
  force?: boolean;

  /**
   * Get existing screenshot metadata without re-capturing.
   * If true, returns existing screenshot info or null if none exists.
   */
  checkOnly?: boolean;
}

/**
 * Capture a webpage screenshot and store it in S3/MinIO.
 * This is the high-level API combining screenshot capture and storage.
 *
 * Features:
 * - Smart check-first: skips Playwright launch if screenshot already exists (avoid heavy browser)
 * - Consistent with tracker flow: integrates with existing heatmap infrastructure
 * - Optional force refresh: can bypass existence check if needed
 * - Check-only mode: verify if screenshot exists without capturing
 *
 * @param url The webpage URL to capture
 * @param s3Bucket S3 bucket name
 * @param siteId Website/site ID for S3 key generation
 * @param pagePath Normalized page path for S3 key generation
 * @param websiteUuid Website UUID for DB lookups
 * @param options Additional screenshot capture options (including force/checkOnly)
 *
 * @returns Object containing S3 key, hash, and image dimensions, or null if skipped/not found
 */
export async function captureAndStoreScreenshot(
  url: string,
  s3Bucket: string,
  siteId: string,
  pagePath: string,
  websiteUuid: string,
  options?: StoreScreenshotOptions,
): Promise<{
  s3Key: string;
  hash: string;
  width: number;
  height: number;
  sizeBytes: number;
  stored: boolean; // true if newly stored, false if already existed
} | null> {
  // Lazy-load getLayoutSnapshot to avoid circular dependency issues
  const { getLayoutSnapshot } = await import("./layout-db");

  const force = options?.force ?? false;
  const checkOnly = options?.checkOnly ?? false;

  try {
    const cache = getScreenshotCache();

    // FIRST: Check in-memory cache (ultra-fast, no DB call)
    const cachedScreenshot = cache.get(websiteUuid, pagePath);
    if (cachedScreenshot && (checkOnly || !force)) {
      // Found in cache - return immediately without DB call
      return {
        s3Key: cachedScreenshot.s3Key,
        hash: cachedScreenshot.hash,
        width: cachedScreenshot.docWidth,
        height: cachedScreenshot.docHeight,
        sizeBytes: 0,
        stored: false,
      };
    }

    // SECOND: Check database if cache miss
    // This avoids launching Playwright if we already have the screenshot!
    const existing = await getLayoutSnapshot(websiteUuid, pagePath);

    // If screenshot exists and we're not forcing re-capture
    if (existing?.s3_key && existing?.content_sha256) {
      if (checkOnly || !force) {
        // Cache the result for next time
        cache.set(websiteUuid, pagePath, {
          s3Key: existing.s3_key,
          hash: existing.content_sha256,
          docWidth: existing.doc_width,
          docHeight: existing.doc_height,
        });

        // Return existing metadata WITHOUT launching Playwright
        // This is the key optimization: skip heavy browser process
        return {
          s3Key: existing.s3_key,
          hash: existing.content_sha256,
          width: existing.doc_width,
          height: existing.doc_height,
          sizeBytes: 0, // Unknown for existing screenshot
          stored: false,
        };
      }
    }

    // If check-only mode and no existing screenshot
    if (checkOnly) {
      return null;
    }

    // THIRD: Only if no existing screenshot (or force=true), launch Playwright
    // This is where the heavy browser work happens
    const result = await captureWebPageScreenshot({
      url,
      ...options,
    });

    // Store in S3
    const s3Key = heatmapScreenshotKey(siteId, layoutPathSlot(siteId, pagePath));
    await putJpeg(s3Bucket, s3Key, result.buffer);

    // Cache the newly stored screenshot
    cache.set(websiteUuid, pagePath, {
      s3Key,
      hash: result.hash,
      docWidth: result.width,
      docHeight: result.height,
    });

    return {
      s3Key,
      hash: result.hash,
      width: result.width,
      height: result.height,
      sizeBytes: result.buffer.length,
      stored: true,
    };
  } catch (error) {
    // If DB check fails, still try to capture
    if (checkOnly) return null;

    const result = await captureWebPageScreenshot({
      url,
      ...options,
    });

    const s3Key = heatmapScreenshotKey(siteId, layoutPathSlot(siteId, pagePath));
    await putJpeg(s3Bucket, s3Key, result.buffer);

    // Cache the newly stored screenshot
    const cache = getScreenshotCache();
    cache.set(websiteUuid, pagePath, {
      s3Key,
      hash: result.hash,
      docWidth: result.width,
      docHeight: result.height,
    });

    return {
      s3Key,
      hash: result.hash,
      width: result.width,
      height: result.height,
      sizeBytes: result.buffer.length,
      stored: true,
    };
  }
}

/**
 * Clean shutdown of browser resources.
 * Should be called during application shutdown.
 */
export async function shutdownPlaywrightBrowser(): Promise<void> {
  await closeBrowser();
}
