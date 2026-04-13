import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { authMiddleware, requireUser, type AuthVars } from "../middleware/auth";
import * as fn from "../services/funnels.service";

const r = new Hono<{ Variables: AuthVars }>();

r.get("/active", async (c) => {
  const wid = c.req.query("website_id") ?? c.req.query("websiteId");
  if (!wid) return c.json({ error: "website_id required" }, 400);
  const origin = c.req.header("Origin") ?? c.req.header("Referer") ?? "";
  const funnels = await fn.activeForTracker(wid, origin);
  return c.json({ data: funnels });
});

const auth = new Hono<{ Variables: AuthVars }>();
auth.use("*", authMiddleware);

auth.get("/:website_id/funnels", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  try {
    return c.json(await fn.list(uid, c.req.param("website_id")));
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }
});

auth.post("/:website_id/funnels", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  const b = await c.req.json<Record<string, unknown>>();
  try {
    return c.json(await fn.create(uid, c.req.param("website_id"), b as Parameters<typeof fn.create>[2]), 201);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }
});

auth.delete("/:website_id/funnels/bulk-delete", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  const b = await c.req.json<{ ids?: string[] }>();
  try {
    await fn.bulkDelete(uid, c.req.param("website_id"), b.ids ?? []);
    return c.body(null, 204);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }
});

auth.get("/:website_id/funnels/:funnel_id", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  try {
    const out = await fn.get(uid, c.req.param("website_id"), c.req.param("funnel_id"));
    if (!out) return c.json({ error: "not found" }, 404);
    return c.json(out);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }
});

auth.put("/:website_id/funnels/:funnel_id", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  const b = await c.req.json<Record<string, unknown>>();
  try {
    const out = await fn.update(uid, c.req.param("website_id"), c.req.param("funnel_id"), b as Parameters<typeof fn.update>[3]);
    if (!out) return c.json({ error: "not found" }, 404);
    return c.json(out);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }
});

auth.delete("/:website_id/funnels/:funnel_id", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  try {
    await fn.remove(uid, c.req.param("website_id"), c.req.param("funnel_id"));
    return c.body(null, 204);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }
});

auth.get("/:website_id/funnels/:funnel_id/stats", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  try {
    const out = await fn.stats(uid, c.req.param("website_id"), c.req.param("funnel_id"));
    if (!out) return c.json({ error: "not found" }, 404);
    return c.json(out);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }
});

export const funnelPublicRoutes = r;
export const funnelAuthRoutes = auth;
