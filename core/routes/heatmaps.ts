import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { assertOwnerOrMember } from "../services/access.service";
import * as heatmapSvc from "../services/heatmaps.service";
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
