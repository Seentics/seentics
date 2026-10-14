import { describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";

mock.module("../../../platform/middleware/auth", () => ({
  authMiddleware: async (c: any, next: any) => {
    const user = c.req.header("x-test-user");
    if (!user) return c.json({ error: "Authorization required" }, 401);
    c.set("userId", user);
    return next();
  },
  requireUser: (c: any) => c.get("userId") || null,
}));

const { createAiRoutes } = await import("../routes");

const SITE = "11111111-1111-4111-8111-111111111111";
const QUERY = "22222222-2222-4222-8222-222222222222";

function app(role: string | null, result: unknown) {
  const seen: any[] = [];
  const routes = createAiRoutes({
    configured: true,
    websites: { getRole: async () => role },
    applier: { apply: async (input: any) => { seen.push(input); return result; } },
  } as any);
  return { seen, app: new Hono().route("/ai", routes) };
}

const confirm = (a: Hono) =>
  a.request(`/ai/confirm/${SITE}/${QUERY}`, { method: "POST", headers: { "x-test-user": "u1" } });

describe("POST /ai/confirm", () => {
  it("refuses a viewer before the applier is asked", async () => {
    const { app: a, seen } = app("viewer", { ok: true });
    expect((await confirm(a)).status).toBe(403);
    expect(seen).toHaveLength(0);
  });

  it("hands the applier the caller's role, and returns what was done", async () => {
    const { app: a, seen } = app("admin", { ok: true, created: { resource: "site_settings", id: SITE }, operation: "update" });
    const res = await confirm(a);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, created: { resource: "site_settings", id: SITE }, operation: "update" });
    expect(seen[0]).toMatchObject({ userId: "u1", websiteId: SITE, queryId: QUERY, role: "admin" });
    expect(typeof seen[0].can).toBe("function");
  });

  it("maps refusals to statuses the card can explain", async () => {
    for (const [code, status] of [["stale", 409], ["gone", 404], ["forbidden", 403], [undefined, 400]] as const) {
      const { app: a } = app("member", { ok: false, error: "nope", ...(code ? { code } : {}) });
      const res = await confirm(a);
      expect(res.status).toBe(status);
      expect((await res.json()).error).toBe("nope");
    }
  });
});
