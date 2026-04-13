import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { authMiddleware, requireUser, type AuthVars } from "../middleware/auth";
import * as ws from "../services/websites.service";

const r = new Hono<{ Variables: AuthVars }>();
r.use("*", authMiddleware);

r.get("/", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  return c.json(await ws.listForUser(uid));
});

r.post("/", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  const b = await c.req.json<{ name?: string; url?: string }>();
  if (!b?.name || !b?.url) return c.json({ error: "name and url required" }, 400);
  try {
    return c.json(await ws.createForUser(uid, { name: b.name, url: b.url }), 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "create failed";
    return c.json({ error: msg }, 400);
  }
});

r.get("/:id", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  try {
    const out = await ws.getForUser(uid, c.req.param("id"));
    if (!out) return c.json({ error: "not found" }, 404);
    return c.json(out);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }
});

r.put("/:id", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  try {
    const patch = await c.req.json<Record<string, unknown>>();
    const out = await ws.updateForUser(uid, c.req.param("id"), patch as Parameters<typeof ws.updateForUser>[2]);
    if (!out) return c.json({ error: "not found" }, 404);
    return c.json(out);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }
});

r.delete("/:id", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  try {
    await ws.deleteForUser(uid, c.req.param("id"));
    return c.body(null, 204);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }
});

r.get("/:id/goals", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  try {
    return c.json(await ws.listGoals(uid, c.req.param("id")));
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }
});

r.post("/:id/goals", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  const b = await c.req.json<{ name?: string; type?: string; identifier?: string; selector?: string }>();
  if (!b?.name || !b?.type || !b?.identifier) return c.json({ error: "invalid body" }, 400);
  try {
    return c.json(await ws.createGoal(uid, c.req.param("id"), b as { name: string; type: string; identifier: string; selector?: string }), 201);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }
});

r.patch("/:id/goals/:goal_id", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  const b = await c.req.json<Record<string, unknown>>();
  try {
    const out = await ws.updateGoal(uid, c.req.param("id"), c.req.param("goal_id"), b as Parameters<typeof ws.updateGoal>[3]);
    if (!out) return c.json({ error: "not found" }, 404);
    return c.json(out);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }
});

r.delete("/:id/goals/:goal_id", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  try {
    await ws.deleteGoal(uid, c.req.param("id"), c.req.param("goal_id"));
    return c.body(null, 204);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }
});

r.get("/:id/my-role", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  try {
    return c.json(await ws.getMyRole(uid, c.req.param("id")));
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }
});

r.get("/:id/members", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  try {
    return c.json(await ws.listMembers(uid, c.req.param("id")));
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }
});

r.post("/:id/members", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  const b = await c.req.json<{ email?: string; role?: string }>();
  if (!b?.email) return c.json({ error: "email required" }, 400);
  try {
    return c.json(await ws.addMember(uid, c.req.param("id"), { email: b.email, role: b.role }), 201);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "failed";
    return c.json({ error: msg }, 400);
  }
});

r.delete("/:id/members/:user_id", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  try {
    await ws.removeMember(uid, c.req.param("id"), c.req.param("user_id"));
    return c.body(null, 204);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }
});

r.put("/:id/members/:user_id/role", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  const b = await c.req.json<{ role?: string }>();
  if (!b?.role) return c.json({ error: "role required" }, 400);
  try {
    await ws.updateMemberRole(uid, c.req.param("id"), c.req.param("user_id"), b.role);
    return c.body(null, 204);
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }
});

r.get("/:id/invitations", (c) => c.json({ data: [] }));
r.post("/:id/invitations", (c) => c.json({ data: { ok: true } }));
r.delete("/:id/invitations/:invitation_id", (c) => c.body(null, 204));

r.post("/:id/share", async (c) => {
  const uid = requireUser(c);
  if (!uid) return c.json({ error: "unauthorized" }, 401);
  const b = await c.req.json<{ enabled?: boolean }>().catch(() => ({ enabled: true }));
  try {
    return c.json(await ws.toggleShare(uid, c.req.param("id"), !!b.enabled));
  } catch (e) {
    const st = (e as Error & { status?: number }).status;
    return c.json({ error: "forbidden" }, (st ?? 403) as ContentfulStatusCode);
  }
});

r.get("/:siteId/privacy", (c) =>
  c.json({
    data: {
      site_id: c.req.param("siteId"),
      settings: {},
    },
  }),
);
r.put("/:siteId/privacy", (c) => c.json({ data: { ok: true } }));

r.get("/:websiteId/api-keys", (c) => c.json({ data: [] }));
r.post("/:websiteId/api-keys", (c) => c.json({ error: "not implemented" }, 501));
r.delete("/:websiteId/api-keys/:keyId", (c) => c.body(null, 204));

export const websiteRoutes = r;
