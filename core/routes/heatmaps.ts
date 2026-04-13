import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { env } from "../config";
import { assertOwnerOrMember } from "../lib/access";
import { getHeatmapData, listPages, deleteHeatmaps } from "../lib/heatmap-db";
import { getLayoutSnapshot } from "../lib/layout-db";
import { presignGet } from "../lib/s3";
import { normalizeHeatmapPagePath } from "../lib/paths";
import { resolveWebsiteIdsLenient } from "../lib/website-resolve";
import type { AuthVars } from "../middleware/auth";
import { authMiddleware, requireUser } from "../middleware/auth";
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

  const { uuidStr } = await resolveWebsiteIdsLenient(websiteId);
  const pages = await listPages(uuidStr);
  const out = pages.map((p) => ({
    page_path: p.page_path,
    click_count: p.click_count,
    scroll_count: p.scroll_count,
    avg_scroll: p.avg_scroll,
    last_seen: p.last_seen.toISOString(),
  }));
  return c.json({ pages: out });
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

  const pagePath = c.req.query("page_path") ?? "";
  if (!pagePath) return c.json({ error: "page_path is required" }, 400);
  let eventType = c.req.query("event_type") ?? "click";
  if (!eventType) eventType = "click";

  const { uuidStr } = await resolveWebsiteIdsLenient(websiteId);
  const norm = normalizeHeatmapPagePath(pagePath);
  const points = await getHeatmapData(uuidStr, norm, eventType);
  return c.json({ page_path: norm, points });
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

  const pagePath = c.req.query("page_path") ?? "";
  if (!pagePath) return c.json({ error: "page_path is required" }, 400);

  const { uuidStr } = await resolveWebsiteIdsLenient(websiteId);
  const norm = normalizeHeatmapPagePath(pagePath);
  const row = await getLayoutSnapshot(uuidStr, norm);
  if (!row?.s3_key) {
    return c.json({ layout: null });
  }

  const expMs = env().presignTtlMs;
  const url = await presignGet(env().s3.bucket, row.s3_key, expMs);
  const deadline = new Date(Date.now() + expMs).toISOString();
  return c.json({
    layout: {
      image_url: url,
      image_url_expires_at: deadline,
      doc_width: row.doc_width,
      doc_height: row.doc_height,
    },
  });
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

  const body = await c.req.json<{ pagePaths?: string[] }>();
  const pagePaths = body.pagePaths;
  if (!pagePaths?.length) return c.json({ error: "pagePaths required" }, 400);

  const { uuidStr } = await resolveWebsiteIdsLenient(websiteId);
  await deleteHeatmaps(uuidStr, pagePaths);
  return c.body(null, 204);
});
