import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { authMiddleware, requireUser, type AuthVars } from "../../platform/middleware/auth";
import { parseJson, parseQuery } from "../../platform/validation";
import type { WebsiteQuery } from "../websites/interfaces";
import type {
  CaptureScreenshotRequest,
  HeatmapMutations,
  HeatmapQuery,
  HeatmapScreenshotCapture,
} from "./interfaces";
// Imported from the schema module rather than a barrel: these schemas carry
// defaults, and their inferred output widens when re-exported, which silently
// costs the handlers their parameter types.
import {
  heatmapBulkDeleteSchema,
  heatmapDataQuerySchema,
  heatmapSnapshotQuerySchema,
} from "./validators/heatmap.schema";

/** Defaults for a capture whose options arrived absent or unparseable. */
const DEFAULT_VIEWPORT_WIDTH = 1920;
const DEFAULT_VIEWPORT_HEIGHT = 1080;
const DEFAULT_JPEG_QUALITY = 85;

/** Batch ceiling. Each entry launches a browser, sequentially. */
const MAX_BATCH_SCREENSHOTS = 50;

/**
 * HTTP surface for heatmaps, mounted at `/api/v1/heatmaps`.
 *
 * A factory rather than a module-level singleton, so dependencies arrive at
 * composition time instead of being reached for through imports — which is what
 * lets these routes run against stubs in a test.
 */
export function createHeatmapRoutes(deps: {
  heatmaps: HeatmapQuery & HeatmapMutations;
  screenshots: HeatmapScreenshotCapture;
  websites: WebsiteQuery;
}) {
  const { heatmaps, screenshots, websites } = deps;
  const r = new Hono<{ Variables: AuthVars }>();

  r.use(authMiddleware);

  /**
   * Authenticate and confirm the caller may touch this website's heatmaps.
   *
   * Returns a `Response` to short-circuit with, or `null` to proceed — the shape
   * that keeps each handler to two lines instead of a nested try/catch.
   *
   * Answers 403 for an unknown website as well as a forbidden one, so the endpoint
   * cannot be used to enumerate which site ids exist. It also answers 403 rather
   * than 401 for a missing user, matching what this surface has always returned.
   */
  async function denyUnlessPermitted(
    c: Context<{ Variables: AuthVars }>,
    websiteRef: string,
  ): Promise<Response | null> {
    const userId = requireUser(c);
    if (!userId) return c.json({ error: "forbidden" }, 403);

    const role = await websites.getRole(websiteRef, userId);
    if (!role) return c.json({ error: "forbidden" }, 403 as ContentfulStatusCode);

    return null;
  }

  /**
   * Read a JSON body without a schema.
   *
   * The screenshot endpoints coerce every field with a fallback instead of
   * rejecting, so they parse the envelope by hand rather than through a validator.
   */
  async function readJsonBody(
    c: Context<{ Variables: AuthVars }>,
  ): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; res: Response }> {
    try {
      return { ok: true, body: (await c.req.json()) as Record<string, unknown> };
    } catch {
      return { ok: false, res: c.json({ error: "invalid json" }, 400) };
    }
  }

  /** Numeric field with a fallback for absent, non-numeric, or infinite values. */
  function numberOr(value: unknown, fallback: number): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function stringOrEmpty(value: unknown): string {
    return typeof value === "string" ? value : "";
  }

  // GET /:website_id/pages — every page with heatmap data, busiest first.
  r.get("/:website_id/pages", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    const out = await heatmaps.listPages(websiteRef);
    return c.json(out);
  });

  // GET /:website_id/data — click or scroll points for one page.
  r.get("/:website_id/data", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    const q = parseQuery(c, heatmapDataQuerySchema);
    if (!q.ok) return q.res;

    const out = await heatmaps.getPoints(websiteRef, q.data.page_path, q.data.event_type || "click");
    return c.json(out);
  });

  // GET /:website_id/layout-snapshot — the background the overlay draws on.
  r.get("/:website_id/layout-snapshot", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    const q = parseQuery(c, heatmapSnapshotQuerySchema);
    if (!q.ok) return q.res;

    const out = await heatmaps.getLayoutSnapshot(websiteRef, q.data.page_path);
    return c.json(out);
  });

  /**
   * POST /:website_id/save-screenshot
   *
   * The dashboard's own html2canvas render. Every rejection is a 400 carrying the
   * service's message, because each one tells the user something actionable
   * ("not a valid JPEG", "size out of range").
   */
  r.post("/:website_id/save-screenshot", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    const parsed = await readJsonBody(c);
    if (!parsed.ok) return parsed.res;

    const pagePath = stringOrEmpty(parsed.body.page_path);
    const image = stringOrEmpty(parsed.body.image);
    const docWidth = Number(parsed.body.doc_width ?? 0);
    const docHeight = Number(parsed.body.doc_height ?? 0);

    if (!pagePath || !image) {
      return c.json({ error: "page_path and image required" }, 400);
    }

    try {
      await heatmaps.saveDashboardScreenshot(websiteRef, pagePath, image, docWidth, docHeight);
      return c.json({ ok: true });
    } catch (e) {
      return c.json({ error: String(e) }, 400);
    }
  });

  // DELETE /:website_id/bulk-delete — 204, no body.
  r.delete("/:website_id/bulk-delete", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

    const parsed = await parseJson(c, heatmapBulkDeleteSchema);
    if (!parsed.ok) return parsed.res;

    await heatmaps.bulkDeletePages(websiteRef, parsed.data.pagePaths);
    return c.body(null, 204);
  });

  /**
   * POST /:website_id/playwright-screenshot
   * Capture a webpage screenshot using Playwright and store in S3/MinIO.
   *
   * Request body:
   * {
   *   "page_url": "https://example.com/page",
   *   "page_path": "/page",
   *   "viewport_width": 1920,
   *   "viewport_height": 1080,
   *   "wait_for_selector": "#main-content",
   *   "jpeg_quality": 85
   * }
   */
  r.post("/:website_id/playwright-screenshot", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

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
      // 400 rather than 502 for an upstream page that would not load: from the
      // caller's side the actionable fact is that the URL they supplied failed.
      return c.json(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        400,
      );
    }
  });

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
  r.post("/:website_id/playwright-batch-screenshots", async (c) => {
    const websiteRef = c.req.param("website_id");
    const denied = await denyUnlessPermitted(c, websiteRef);
    if (denied) return denied;

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
  });

  return r;
}
