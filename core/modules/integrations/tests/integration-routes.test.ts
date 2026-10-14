import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";

mock.module("../../../platform/middleware/auth", () => ({
  authMiddleware: async (c: any, next: any) => { c.set("userId", c.req.header("x-test-user") ?? ""); return next(); },
  requireUser: (c: any) => c.get("userId") || null,
}));

const { createIntegrationRoutes } = await import("../routes");

const SITE = "11111111-1111-4111-8111-111111111111";
const CONN = "22222222-2222-4222-8222-222222222222";
const roles: Record<string, string | null> = { owner: "owner", viewer: "viewer", stranger: null };
const calls: string[] = [];
let result: any = { ok: true, value: { id: CONN } };

function app() {
  const routes = createIntegrationRoutes({
    websites: { getRole: async (_s: string, u: string) => roles[u] ?? null } as any,
    queries: {
      list: async () => ({ providers: [{ id: "hubspot" }], connections: [] }) as any,
      deliveries: async (_w, q) => { calls.push(`deliveries:${JSON.stringify(q)}`); return []; },
    },
    mutations: {
      connect: async (_w, i) => { calls.push(`connect:${JSON.stringify(i)}`); return result; },
      update: async (_w, id, i) => { calls.push(`update:${id}:${JSON.stringify(i)}`); return result; },
      disconnect: async (_w, id) => { calls.push(`disconnect:${id}`); return id === CONN; },
      sendTest: async (_w, id) => { calls.push(`test:${id}`); return result; },
      retryDelivery: async (_w, id) => { calls.push(`retry:${id}`); return result; },
    },
  });
  return new Hono().route("/integrations", routes);
}

// A website of its own per test keeps the per-website call limiter from carrying over.
let site = SITE;
const req = (method: string, path: string, user = "owner", body?: unknown) =>
  app().request(`/integrations/${site}${path}`, { method, headers: { "x-test-user": user, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

beforeEach(() => { calls.length = 0; result = { ok: true, value: { id: CONN } }; site = crypto.randomUUID(); });

describe("integration routes", () => {
  it("requires a session and membership", async () => {
    expect((await req("GET", "", "")).status).toBe(401);
    expect((await req("GET", "", "stranger")).status).toBe(403);
  });

  it("lists providers and destinations together", async () => {
    const res = await req("GET", "", "viewer");
    expect(await res.json()).toEqual({ data: { providers: [{ id: "hubspot" }], connections: [] } });
  });

  it("lets viewers read but not connect, change, test, retry or disconnect", async () => {
    expect((await req("GET", "/deliveries", "viewer")).status).toBe(200);
    expect((await req("POST", "/connections", "viewer", { provider: "hubspot", credentials: { access_token: "x" } })).status).toBe(403);
    expect((await req("PATCH", `/connections/${CONN}`, "viewer", { enabled: false })).status).toBe(403);
    expect((await req("POST", `/connections/${CONN}/test`, "viewer")).status).toBe(403);
    expect((await req("DELETE", `/connections/${CONN}`, "viewer")).status).toBe(403);
    expect((await req("POST", `/deliveries/${CONN}/retry`, "viewer")).status).toBe(403);
    expect(calls).toEqual(['deliveries:{"limit":25}']);
  });

  it("creates a destination and answers 201", async () => {
    const res = await req("POST", "/connections", "owner", { provider: "hubspot", name: "CRM", credentials: { access_token: "t" } });
    expect(res.status).toBe(201);
    expect(calls[0]).toBe('connect:{"provider":"hubspot","name":"CRM","credentials":{"access_token":"t"},"config":{}}');
    expect((await req("POST", "/connections", "owner", { credentials: {} })).status).toBe(400);
    expect((await req("POST", "/connections", "owner", { provider: "nope", credentials: {} })).status).toBe(400);
  });

  it("maps failures to clear statuses and messages", async () => {
    for (const [code, status] of [["invalid", 400], ["rejected", 422], ["unavailable", 502], ["not_found", 404], ["no_key", 503], ["connection_limit", 409]] as const) {
      result = { ok: false, code, message: `because ${code}` };
      const res = await req("POST", "/connections", "owner", { provider: "hubspot", credentials: { a: 1 } });
      expect(res.status, code).toBe(status);
      expect(await res.json()).toEqual({ error: code, message: `because ${code}` });
    }
  });

  it("updates, tests and disconnects a destination by id", async () => {
    expect((await req("PATCH", `/connections/${CONN}`, "owner", { enabled: false })).status).toBe(200);
    expect((await req("PATCH", `/connections/${CONN}`, "owner", {})).status).toBe(400);
    expect((await req("POST", `/connections/${CONN}/test`, "owner")).status).toBe(200);
    expect((await req("DELETE", `/connections/${CONN}`, "owner")).status).toBe(200);
    expect((await req("DELETE", "/connections/33333333-3333-4333-8333-333333333333", "owner")).status).toBe(404);
  });

  it("does not run a mutation for an id that is not a uuid", async () => {
    expect((await req("PATCH", "/connections/hubspot", "owner", { enabled: false })).status).toBe(404);
    expect((await req("DELETE", "/connections/hubspot", "owner")).status).toBe(404);
    expect((await req("POST", "/connections/hubspot/test", "owner")).status).toBe(404);
    expect((await req("POST", "/deliveries/nope/retry", "owner")).status).toBe(404);
    expect(calls).toEqual([]);
  });

  it("retries a delivery", async () => {
    expect((await req("POST", `/deliveries/${CONN}/retry`, "owner")).status).toBe(200);
    expect(calls).toEqual([`retry:${CONN}`]);
  });

  it("validates and passes the deliveries filters", async () => {
    expect((await req("GET", "/deliveries?limit=5&status=failed&connection_id=" + CONN)).status).toBe(200);
    expect(calls).toContain(`deliveries:{"limit":5,"status":"failed","connectionId":"${CONN}"}`);
    expect((await req("GET", "/deliveries?limit=9999")).status).toBe(400);
    expect((await req("GET", "/deliveries?status=weird")).status).toBe(400);
  });

  it("rate-limits calls that reach a third party, per website", async () => {
    let limited = 0;
    for (let i = 0; i < 14; i++) if ((await req("POST", `/connections/${CONN}/test`, "owner")).status === 429) limited++;
    expect(limited).toBe(4);
  });
});
