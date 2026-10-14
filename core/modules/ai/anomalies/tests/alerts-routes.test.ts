import { describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import { AnomalyExplainer } from "../explain";
import { AnomalyService } from "../service";
import { MemoryAnomalyRepository, fakeErrors, fakeTraffic } from "./fakes";

mock.module("../../../../platform/middleware/auth", () => ({
  authMiddleware: async (c: any, next: any) => {
    const user = c.req.header("x-test-user");
    if (!user) return c.json({ error: "Authorization required" }, 401);
    c.set("userId", user);
    return next();
  },
  requireUser: (c: any) => c.get("userId") || null,
}));

const { createAiRoutes } = await import("../../routes");

const SITE = "11111111-1111-4111-8111-111111111111";
const ROLES: Record<string, string> = { owner: "owner", admin: "admin", member: "member", viewer: "viewer" };

function app() {
  const repo = new MemoryAnomalyRepository();
  const alerts = new AnomalyService({
    repo,
    traffic: fakeTraffic(() => ({ pageviews: 0, visitors: 0 })),
    errors: fakeErrors(),
    describeSite: async () => null,
    send: null,
    explainer: new AnomalyExplainer({ llm: null, model: null }),
    now: () => new Date("2026-10-14T14:15:00Z"),
  });
  const websites = { getRole: async (id: string, user: string) => (id === SITE ? (ROLES[user] ?? null) : null) };
  return { repo, http: new Hono().route("/ai", createAiRoutes({ configured: false, alerts, websites } as any)) };
}

const as = (user: string, init: RequestInit = {}) => ({ ...init, headers: { "x-test-user": user, "Content-Type": "application/json", ...(init.headers ?? {}) } });

describe("GET /ai/alerts/:website_id", () => {
  it("lists the site's anomalies with its settings and whether the caller can change them", async () => {
    const { repo, http } = app();
    await repo.open(SITE, {
      type: "tracking_outage", subject: "", verdict: "anomalous", severity: "critical", metric: "pageviews", observed: 0, expected: 600, score: -20,
      window: { start: new Date("2026-10-14T12:00:00Z"), end: new Date("2026-10-14T14:00:00Z") },
      title: "Tracking may be down: no pageviews for 2 hours", summary: "s", path: "settings/tracking", facts: {},
    }, new Date("2026-10-14T14:15:00Z"));

    const res = await http.request(`/ai/alerts/${SITE}`, as("viewer"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.canManage).toBe(false);
    expect(body.data.settings).toEqual({ enabled: true, sensitivity: "normal" });
    expect(body.data.alerts).toHaveLength(1);
    expect(body.data.alerts[0]).toMatchObject({ type: "tracking_outage", status: "open", severity: "critical", path: "settings/tracking", changePct: -100 });
    expect(body.data.alerts[0].askPrompt).toContain("Is tracking broken?");

    expect(((await (await http.request(`/ai/alerts/${SITE}`, as("owner"))).json()) as any).data.canManage).toBe(true);
  });

  it("refuses strangers, bad ids and anonymous callers", async () => {
    const { http } = app();
    expect((await http.request(`/ai/alerts/${SITE}`, as("stranger"))).status).toBe(403);
    expect((await http.request("/ai/alerts/not-a-uuid", as("owner"))).status).toBe(400);
    expect((await http.request(`/ai/alerts/${SITE}`)).status).toBe(401);
  });
});

describe("/ai/alerts/:website_id/settings", () => {
  it("lets owners and admins change them, and nobody else", async () => {
    const { repo, http } = app();
    const put = (user: string, body: unknown) => http.request(`/ai/alerts/${SITE}/settings`, as(user, { method: "PUT", body: JSON.stringify(body) }));

    expect((await put("member", { enabled: false })).status).toBe(403);
    expect((await put("viewer", { sensitivity: "high" })).status).toBe(403);

    const res = await put("admin", { sensitivity: "high" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { enabled: true, sensitivity: "high", canManage: true } });
    expect(repo.settings.get(SITE)).toEqual({ enabled: true, sensitivity: "high" });

    expect((await put("owner", { enabled: false })).status).toBe(200);
    const read = await http.request(`/ai/alerts/${SITE}/settings`, as("member"));
    expect(await read.json()).toEqual({ data: { enabled: false, sensitivity: "high", canManage: false } });
  });

  it("rejects an invalid body", async () => {
    const { http } = app();
    const put = (body: unknown) => http.request(`/ai/alerts/${SITE}/settings`, as("owner", { method: "PUT", body: JSON.stringify(body) }));
    expect((await put({ sensitivity: "extreme" })).status).toBe(400);
    expect((await put({})).status).toBe(400);
    expect((await put({ enabled: "yes" })).status).toBe(400);
    expect((await put({ enabled: true, other: 1 })).status).toBe(400);
  });
});
