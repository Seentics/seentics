import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { assertOwnerOrMember } from "../services/access.service";
import * as heatmapSvc from "../services/heatmaps.service";
import * as playwrightSvc from "../services/heatmap-playwright.service";
import type { AuthVars } from "../middleware/auth";
import { authMiddleware, requireUser } from "../middleware/auth";
import { parseJson, parseQuery } from "../validators/validation";
import {
  heatmapBulkDeleteSchema,
  heatmapDataQuerySchema,
  heatmapSnapshotQuerySchema,
} from "../validators/heatmaps";

export const heatmapRoutes = new Hono<{ Variables: AuthVars }>();

heatmapRoutes.use(authMiddleware);

heatmapRoutes.get("/:website_id/pages", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "forbidden" }, 403);
  const websiteId = c.req.param("website_id");
  try {
    await assertOwnerOrMember(uid, websiteId);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }

  const out = await heatmapSvc.listHeatmapPages(websiteId, { lenientResolve: true });
  return c.json(out);
});

heatmapRoutes.get("/:website_id/data", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "forbidden" }, 403);
  const websiteId = c.req.param("website_id");
  try {
    await assertOwnerOrMember(uid, websiteId);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }

  const q = parseQuery(c, heatmapDataQuerySchema);
  if (!q.ok) return q.res;
  const pagePath = q.data.page_path;
  const eventType = q.data.event_type || "click";

  const out = await heatmapSvc.getHeatmapPoints(websiteId, pagePath, eventType, {
    lenientResolve: true,
  });
  return c.json(out);
});

heatmapRoutes.get("/:website_id/layout-snapshot", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "forbidden" }, 403);
  const websiteId = c.req.param("website_id");
  try {
    await assertOwnerOrMember(uid, websiteId);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }

  const q = parseQuery(c, heatmapSnapshotQuerySchema);
  if (!q.ok) return q.res;
  const pagePath = q.data.page_path;

  const out = await heatmapSvc.getHeatmapLayoutSnapshot(websiteId, pagePath, {
    lenientResolve: true,
  });
  return c.json(out);
});

heatmapRoutes.post("/:website_id/save-screenshot", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "forbidden" }, 403);
  const websiteId = c.req.param("website_id");
  try {
    await assertOwnerOrMember(uid, websiteId);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }

  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }
  const pagePath = typeof body.page_path === "string" ? body.page_path : "";
  const image = typeof body.image === "string" ? body.image : "";
  const docWidth = Number(body.doc_width ?? 0);
  const docHeight = Number(body.doc_height ?? 0);

  if (!pagePath || !image) {
    return c.json({ error: "page_path and image required" }, 400);
  }

  try {
    await heatmapSvc.saveDashboardScreenshot(websiteId, pagePath, image, docWidth, docHeight, {
      lenientResolve: true,
    });
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: String(e) }, 400);
  }
});

heatmapRoutes.delete("/:website_id/bulk-delete", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "forbidden" }, 403);
  const websiteId = c.req.param("website_id");
  try {
    await assertOwnerOrMember(uid, websiteId);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }

  const parsed = await parseJson(c, heatmapBulkDeleteSchema);
  if (!parsed.ok) return parsed.res;
  const pagePaths = parsed.data.pagePaths;

  await heatmapSvc.bulkDeleteHeatmapPages(websiteId, pagePaths, { lenientResolve: true });
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
heatmapRoutes.post("/:website_id/playwright-screenshot", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "forbidden" }, 403);
  const websiteId = c.req.param("website_id");

  try {
    await assertOwnerOrMember(uid, websiteId);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }

  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }

  const pageUrl = typeof body.page_url === "string" ? body.page_url : "";
  const pagePath = typeof body.page_path === "string" ? body.page_path : "";
  const viewportWidth = Number(body.viewport_width ?? 1920);
  const viewportHeight = Number(body.viewport_height ?? 1080);
  const waitForSelector =
    typeof body.wait_for_selector === "string" ? body.wait_for_selector : undefined;
  const jpegQuality = Number(body.jpeg_quality ?? 85);

  if (!pageUrl || !pagePath) {
    return c.json({ error: "page_url and page_path are required" }, 400);
  }

  try {
    const force = body.force === true;
    const checkOnly = body.check_only === true;

    const result = await playwrightSvc.captureHeatmapScreenshot(
      websiteId,
      {
        pageUrl,
        pagePath,
        viewportWidth: Number.isFinite(viewportWidth) ? viewportWidth : 1920,
        viewportHeight: Number.isFinite(viewportHeight) ? viewportHeight : 1080,
        waitForSelector,
        jpegQuality: Number.isFinite(jpegQuality) ? jpegQuality : 85,
        force,
        checkOnly,
      },
      { lenientResolve: true },
    );

    return c.json({
      ok: true,
      data: result,
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
heatmapRoutes.post("/:website_id/playwright-batch-screenshots", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "forbidden" }, 403);
  const websiteId = c.req.param("website_id");

  try {
    await assertOwnerOrMember(uid, websiteId);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }

  let body: Record<string, unknown>;
  try {
    body = (await c.req.json()) as Record<string, unknown>;
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }

  const screenshotsList = Array.isArray(body.screenshots) ? body.screenshots : [];

  if (screenshotsList.length === 0) {
    return c.json({ error: "screenshots array is required and must not be empty" }, 400);
  }

  if (screenshotsList.length > 50) {
    return c.json({ error: "maximum 50 screenshots per batch" }, 400);
  }

  try {
    const requests = screenshotsList.map((item: unknown) => {
      const itemObj = item as Record<string, unknown>;
      return {
        pageUrl: typeof itemObj.page_url === "string" ? itemObj.page_url : "",
        pagePath: typeof itemObj.page_path === "string" ? itemObj.page_path : "",
        viewportWidth: Number.isFinite(Number(itemObj.viewport_width))
          ? Number(itemObj.viewport_width)
          : 1920,
        viewportHeight: Number.isFinite(Number(itemObj.viewport_height))
          ? Number(itemObj.viewport_height)
          : 1080,
        waitForSelector:
          typeof itemObj.wait_for_selector === "string" ? itemObj.wait_for_selector : undefined,
        jpegQuality: Number.isFinite(Number(itemObj.jpeg_quality))
          ? Number(itemObj.jpeg_quality)
          : 85,
      };
    });

    const results = await playwrightSvc.batchCaptureHeatmapScreenshots(
      websiteId,
      requests,
      { lenientResolve: true },
    );

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

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
