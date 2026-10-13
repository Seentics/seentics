import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";

mock.module("../../../platform/middleware/auth", () => ({
  authMiddleware: async (c: any, next: any) => { c.set("userId", c.req.header("x-test-user") ?? ""); return next(); },
  requireUser: (c: any) => c.get("userId") || null,
}));

const { createIntegrationRoutes } = await import("../routes");

const SITE = "11111111-1111-4111-8111-111111111111";
const roles: Record<string, string | null> = { owner: "owner", viewer: "viewer", stranger: null };
const calls: string[] = [];
let result: any = { ok: true, value: { provider: "hubspot" } };

function app() {
  const routes = createIntegrationRoutes({
    websites: { getRole: async (_s: string, u: string) => roles[u] ?? null } as any,
    queries: { list: async () => [{ id: "hubspot" }] as any, deliveries: async (_w, limit) => { calls.push(`deliveries:${limit}`); return []; } },
    mutations: {
      connect: async (_w, p, i) => { calls.push(`connect:${p}:${JSON.stringify(i)}`); return result; },
      update: async (_w, p, i) => { calls.push(`update:${p}:${JSON.stringify(i)}`); return result; },
      disconnect: async (_w, p) => { calls.push(`disconnect:${p}`); return p === "hubspot"; },
      sendTest: async (_w, p) => { calls.push(`test:${p}`); return result; },
    },
  });
  return new Hono().route("/integrations", routes);
}

// A website of its own per test file keeps the per-website call limiter from carrying over.
let site = SITE;
const req = (method: string, path: string, user = "owner", body?: unknown) =>
  app().request(`/integrations/${site}${path}`, { method, headers: { "x-test-user": user, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

beforeEach(() => { calls.length = 0; result = { ok: true, value: { provider: "hubspot" } }; site = crypto.randomUUID(); });

describe("integration routes", () => {
  it("requires a session and membership", async () => {
    expect((await req("GET", "", "")).status).toBe(401);
    expect((await req("GET", "", "stranger")).status).toBe(403);
  });

  it("lets viewers read but not connect, change, test or disconnect", async () => {
    expect((await req("GET", "", "viewer")).status).toBe(200);
    expect((await req("GET", "/deliveries", "viewer")).status).toBe(200);
    expect((await req("PUT", "/hubspot", "viewer", { credentials: { access_token: "x" } })).status).toBe(403);
    expect((await req("PATCH", "/hubspot", "viewer", { enabled: false })).status).toBe(403);
    expect((await req("POST", "/hubspot/test", "viewer")).status).toBe(403);
    expect((await req("DELETE", "/hubspot", "viewer")).status).toBe(403);
    expect(calls).toEqual(["deliveries:25"]);
  });

  it("connects a provider", async () => {
    const res = await req("PUT", "/hubspot", "owner", { credentials: { access_token: "t" }, config: {} });
    expect(res.status).toBe(200);
    expect(calls[0]).toBe('connect:hubspot:{"credentials":{"access_token":"t"},"config":{}}');
    expect((await req("PUT", "/hubspot", "owner", {})).status).toBe(400);
  });

  it("maps failures to clear statuses and messages", async () => {
    for (const [code, status] of [["invalid", 400], ["rejected", 422], ["unavailable", 502], ["not_found", 404], ["no_key", 503]] as const) {
      result = { ok: false, code, message: `because ${code}` };
      const res = await req("PUT", "/hubspot", "owner", { credentials: { a: 1 } });
      expect(res.status, code).toBe(status);
      expect(await res.json()).toEqual({ error: code, message: `because ${code}` });
    }
  });

  it("updates, tests and disconnects", async () => {
    expect((await req("PATCH", "/hubspot", "owner", { enabled: false })).status).toBe(200);
    expect((await req("PATCH", "/hubspot", "owner", {})).status).toBe(400);
    expect((await req("POST", "/hubspot/test", "owner")).status).toBe(200);
    expect((await req("DELETE", "/hubspot", "owner")).status).toBe(200);
    expect((await req("DELETE", "/mailchimp", "owner")).status).toBe(404);
  });

  it("validates the deliveries limit", async () => {
    expect((await req("GET", "/deliveries?limit=5")).status).toBe(200);
    expect(calls).toContain("deliveries:5");
    expect((await req("GET", "/deliveries?limit=9999")).status).toBe(400);
  });

  it("rate-limits calls that reach a third party, per website", async () => {
    let limited = 0;
    for (let i = 0; i < 14; i++) if ((await req("POST", "/hubspot/test", "owner")).status === 429) limited++;
    expect(limited).toBe(4);
  });
});
