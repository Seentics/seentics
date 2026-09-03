import type { Context } from "hono";
import type { AuthVars } from "../../platform/middleware/auth";
import type { HeatmapScreenshotCapture } from "./interfaces";
import { ScreenshotTargetNotAllowedError } from "./services/screenshot.service";
import type { CaptureScreenshotRequest } from "./interfaces";
import { numberOr, readJsonBody, stringOrEmpty } from "./lib/request-body";

/**
 * The Playwright capture endpoints, mounted by `createHeatmapRoutes`.
 *
 * Split from the rest of the surface because they are a different kind of endpoint: the
 * others read and delete rows this service owns, while these two make the server fetch a
 * third-party page with a real browser. That difference is why they carry their own
 * viewport defaults, their own batch ceiling, and the only handler in the module that
 * has to distinguish a *refused* target from an unreachable one.
 *
 * Registered onto the caller's router rather than returning one of their own, so they sit
 * behind the same `authMiddleware` and the same `guarded` access check as everything
 * else — a second router would be a second place for that check to be forgotten.
 */

/** Defaults for a capture whose options arrived absent or unparseable. */
const DEFAULT_VIEWPORT_WIDTH = 1920;
const DEFAULT_VIEWPORT_HEIGHT = 1080;
const DEFAULT_JPEG_QUALITY = 85;

/** Batch ceiling. Each entry launches a browser, sequentially. */
const MAX_BATCH_SCREENSHOTS = 50;

/** The access-checked handler wrapper these routes are registered through. */
type Guarded = (
  handle: (c: Context<{ Variables: AuthVars }>, websiteRef: string) => Promise<Response>,
) => (c: Context<{ Variables: AuthVars }>) => Promise<Response>;

type CaptureRouter = {
  post(path: string, handler: (c: Context<{ Variables: AuthVars }>) => Promise<Response>): unknown;
};

export function registerCaptureRoutes(
  r: CaptureRouter,
  screenshots: HeatmapScreenshotCapture,
  guarded: Guarded,
): void {
  r.post("/:website_id/playwright-screenshot", guarded(async (c, websiteRef) => {

    const parsed = await readJsonBody(c);
    if (!parsed.ok) return parsed.res;
    const body = parsed.body;

    const pageUrl = stringOrEmpty(body.page_url);
    const pagePath = stringOrEmpty(body.page_path);
    const waitForSelector =
      typeof body.wait_for_selector === "string" ? body.wait_for_selector : undefined;

    if (!pageUrl || !pagePath) {
      return c.json({ error: "page_url and page_path are required" }, 400);
    }

    try {
      const result = await screenshots.capture(websiteRef, {
        pageUrl,
        pagePath,
        viewportWidth: numberOr(body.viewport_width ?? DEFAULT_VIEWPORT_WIDTH, DEFAULT_VIEWPORT_WIDTH),
        viewportHeight: numberOr(
          body.viewport_height ?? DEFAULT_VIEWPORT_HEIGHT,
          DEFAULT_VIEWPORT_HEIGHT,
        ),
        waitForSelector,
        jpegQuality: numberOr(body.jpeg_quality ?? DEFAULT_JPEG_QUALITY, DEFAULT_JPEG_QUALITY),
        force: body.force === true,
        checkOnly: body.check_only === true,
      });

      return c.json({
        ok: true,
        data: result,
      });
    } catch (error) {
      // A refused target is not a broken one: 403 says the URL is off-limits, 400 says
      // it would not load. Both are the caller's fault, but only one is fixable by
      // retrying a different page.
      if (error instanceof ScreenshotTargetNotAllowedError) {
        return c.json({ error: "page_url not allowed" }, 403);
      }
      // 400 rather than 502 for an upstream page that would not load: from the
      // caller's side the actionable fact is that the URL they supplied failed.
      return c.json(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        400,
      );
    }
  }));

  /**
   * POST /:website_id/playwright-batch-screenshots
   * Capture screenshots for multiple pages in batch.
   * Processes sequentially to avoid resource exhaustion.
   *
   * Request body:
   * {
   *   "screenshots": [
   *     {
   *       "page_url": "https://example.com/page1",
   *       "page_path": "/page1",
   *       "viewport_width": 1920,
   *       "viewport_height": 1080
   *     },
   *     ...
   *   ]
   * }
   */
  r.post("/:website_id/playwright-batch-screenshots", guarded(async (c, websiteRef) => {

    const parsed = await readJsonBody(c);
    if (!parsed.ok) return parsed.res;

    const screenshotsList = Array.isArray(parsed.body.screenshots) ? parsed.body.screenshots : [];

    if (screenshotsList.length === 0) {
      return c.json({ error: "screenshots array is required and must not be empty" }, 400);
    }

    if (screenshotsList.length > MAX_BATCH_SCREENSHOTS) {
      return c.json({ error: `maximum ${MAX_BATCH_SCREENSHOTS} screenshots per batch` }, 400);
    }

    try {
      const requests: CaptureScreenshotRequest[] = screenshotsList.map((item: unknown) => {
        const itemObj = item as Record<string, unknown>;
        return {
          pageUrl: stringOrEmpty(itemObj.page_url),
          pagePath: stringOrEmpty(itemObj.page_path),
          viewportWidth: numberOr(itemObj.viewport_width, DEFAULT_VIEWPORT_WIDTH),
          viewportHeight: numberOr(itemObj.viewport_height, DEFAULT_VIEWPORT_HEIGHT),
          waitForSelector:
            typeof itemObj.wait_for_selector === "string" ? itemObj.wait_for_selector : undefined,
          jpegQuality: numberOr(itemObj.jpeg_quality, DEFAULT_JPEG_QUALITY),
        };
      });

      const results = await screenshots.captureBatch(websiteRef, requests);

      const succeeded = results.filter((x) => x.success).length;
      const failed = results.filter((x) => !x.success).length;

      return c.json({
        ok: true,
        summary: { total: results.length, succeeded, failed },
        results,
      });
    } catch (error) {
      return c.json(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        400,
      );
    }
  }));
}
