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
const { buildReport } = await import("../recommendations/impact");

const SITE = "11111111-1111-4111-8111-111111111111";
const REC = "33333333-3333-4333-8333-333333333333";
const ROLES: Record<string, string> = { viewer: "viewer", member: "member", owner: "owner" };

const row = {
  id: REC, websiteId: SITE, source: "insight", sourceRef: null, dedupeKey: "secret-key", title: "Recover mobile conversions",
  rationale: "Mobile fell.", prompt: "Draft an automation.", target: { kind: "site", ref: null, label: "Mobile visitors", device: "mobile" },
  metric: { name: "conversion_rate", windowDays: 14 }, status: "open", baseline: null, appliedAt: null, appliedBy: null,
  appliedVia: null, resource: null, queryId: null, impact: null, lastSeenAt: "", createdAt: "", updatedAt: "",
};
const view = (r: any) => ({ ...r, report: buildReport(r, new Date()) });

function app() {
  const calls: unknown[] = [];
  const recommendations = {
    list: async (websiteId: string, opts: unknown) => { calls.push(["list", websiteId, opts]); return [view(row)]; },
    get: async (_w: string, id: string) => (id === REC ? view(row) : null),
    dismiss: async (_w: string, id: string) => { calls.push(["dismiss", id]); return view({ ...row, status: "dismissed" }); },
    markDone: async (_w: string, id: string, userId: string) => { calls.push(["done", id, userId]); return view({ ...row, status: "applied", appliedVia: "manual", appliedAt: new Date().toISOString() }); },
  };
  const applied: unknown[] = [];
  const routes = createAiRoutes({
    configured: false,
    websites: { getRole: async (_w: string, user: string) => ROLES[user] ?? null } as any,
    recommendations: recommendations as any,
    applier: { apply: async (input: unknown) => { applied.push(input); return { ok: true, created: { resource: "funnel", id: "f1" } }; } },
  } as any);
  return { http: new Hono().route("/ai", routes), calls, applied };
}

const req = (user: string | null, method = "GET"): RequestInit => ({ method, headers: user ? { "x-test-user": user } : ({} as Record<string, string>) });

describe("recommendation routes", () => {
  it("lists for any role, without internal bookkeeping", async () => {
    const { http, calls } = app();
    const res = await http.request(`/ai/recommendations/${SITE}?status=open,measured`, req("viewer"));
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data[0].title).toBe("Recover mobile conversions");
    expect(body.data[0].report.status).toBe("not_applied");
    expect(body.data[0].dedupeKey).toBeUndefined();
    expect(calls[0]).toEqual(["list", SITE, { statuses: ["open", "measured"], limit: 50 }]);
  });

  it("refuses an unknown status, a bad site id and a stranger", async () => {
    const { http } = app();
    expect((await http.request(`/ai/recommendations/${SITE}?status=bogus`, req("viewer"))).status).toBe(400);
    expect((await http.request(`/ai/recommendations/not-a-uuid`, req("viewer"))).status).toBe(400);
    expect((await http.request(`/ai/recommendations/${SITE}`, req("stranger"))).status).toBe(403);
    expect((await http.request(`/ai/recommendations/${SITE}`, req(null))).status).toBe(401);
  });

  it("lets a member dismiss or mark done, and not a viewer", async () => {
    const { http, calls } = app();
    expect((await http.request(`/ai/recommendations/${SITE}/${REC}/dismiss`, req("viewer", "POST"))).status).toBe(403);
    expect((await http.request(`/ai/recommendations/${SITE}/${REC}/done`, req("viewer", "POST"))).status).toBe(403);
    expect(calls).toHaveLength(0);
    expect((await http.request(`/ai/recommendations/${SITE}/${REC}/dismiss`, req("member", "POST"))).status).toBe(200);
    const done = await http.request(`/ai/recommendations/${SITE}/${REC}/done`, req("owner", "POST"));
    expect(((await done.json()) as any).data.appliedVia).toBe("manual");
    expect(calls).toEqual([["dismiss", REC], ["done", REC, "owner"]]);
  });

  it("answers 404 for an unknown recommendation", async () => {
    const { http } = app();
    expect((await http.request(`/ai/recommendations/${SITE}/44444444-4444-4444-8444-444444444444`, req("viewer"))).status).toBe(404);
  });
});

describe("POST /ai/confirm", () => {
  it("needs member or above: a viewer cannot create what the assistant drafted", async () => {
    const { http, applied } = app();
    const viewer = await http.request(`/ai/confirm/${SITE}/q1`, req("viewer", "POST"));
    expect(viewer.status).toBe(403);
    expect(applied).toHaveLength(0);
    const member = await http.request(`/ai/confirm/${SITE}/q1`, req("member", "POST"));
    expect(member.status).toBe(200);
    expect(applied).toHaveLength(1);
  });
});

describe("POST /ai/chat carries the recommendation id", () => {
  it("passes a uuid through to the agent and drops anything else", async () => {
    const asked: any[] = [];
    const routes = createAiRoutes({
      configured: true,
      websites: { getRole: async () => "member" } as any,
      agent: { ask: async (input: unknown) => { asked.push(input); return { answer: "ok" }; } },
    } as any);
    const http = new Hono().route("/ai", routes);
    const post = (body: unknown) => http.request(`/ai/chat/${SITE}`, {
      method: "POST", headers: { "x-test-user": "member", "content-type": "application/json" }, body: JSON.stringify(body),
    });
    await post({ prompt: "Draft it", recommendation_id: REC });
    await post({ prompt: "Draft it", recommendation_id: "x' OR 1=1" });
    expect(asked[0].recommendationId).toBe(REC);
    expect(asked[1].recommendationId).toBeUndefined();
  });
});
