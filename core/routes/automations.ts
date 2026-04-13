import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { authMiddleware, requireUser, type AuthVars } from "../middleware/auth";
import * as au from "../services/automations.service";

const r = new Hono<{ Variables: AuthVars }>();
r.use("*", authMiddleware);

r.get("/:website_id/automations", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  try {
    return c.json(await au.list(uid, c.req.param("website_id")));
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }
});

r.post("/:website_id/automations", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  const b = await c.req.json<Record<string, unknown>>();
  try {
    return c.json(await au.create(uid, c.req.param("website_id"), b as Parameters<typeof au.create>[2]), 201);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }
});

r.delete("/:website_id/automations/bulk-delete", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  const b = await c.req.json<{ ids?: string[] }>();
  try {
    await au.bulkDelete(uid, c.req.param("website_id"), b.ids ?? []);
    return c.body(null, 204);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }
});

r.get("/:website_id/automations/:id", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  try {
    const out = await au.get(uid, c.req.param("website_id"), c.req.param("id"));
    if (!out) return c.json({ error: "not found" }, 404);
    return c.json(out);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }
});

r.put("/:website_id/automations/:id", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  const b = await c.req.json<Record<string, unknown>>();
  try {
    const out = await au.update(uid, c.req.param("website_id"), c.req.param("id"), b as Parameters<typeof au.update>[3]);
    if (!out) return c.json({ error: "not found" }, 404);
    return c.json(out);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }
});

r.delete("/:website_id/automations/:id", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  try {
    await au.remove(uid, c.req.param("website_id"), c.req.param("id"));
    return c.body(null, 204);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }
});

r.get("/:website_id/automations/:id/executions", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  try {
    const out = await au.executions(uid, c.req.param("website_id"), c.req.param("id"));
    if (!out) return c.json({ error: "not found" }, 404);
    return c.json(out);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }
});

export const automationRoutes = r;
