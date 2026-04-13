import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { assertOwnerOrMember } from "../services/access.service";
import * as heatmapSvc from "../services/heatmaps.service";
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

  const pagePath = c.req.query("page_path") ?? "";
  if (!pagePath) return c.json({ error: "page_path is required" }, 400);
  let eventType = c.req.query("event_type") ?? "click";
  if (!eventType) eventType = "click";

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

  const pagePath = c.req.query("page_path") ?? "";
  if (!pagePath) return c.json({ error: "page_path is required" }, 400);

  const out = await heatmapSvc.getHeatmapLayoutSnapshot(websiteId, pagePath, {
    lenientResolve: true,
  });
  return c.json(out);
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

  await heatmapSvc.bulkDeleteHeatmapPages(websiteId, pagePaths, { lenientResolve: true });
  return c.body(null, 204);
});
