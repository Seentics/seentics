import { beforeAll, describe, expect, it, mock } from "bun:test";
import { fakeDbModule, fakeLogger } from "../../../tests/helpers/fake-db";
import { testConfig } from "../../../tests/helpers/test-config";
import type { AccountScope, VerifiedAccountKey } from "../../../../modules/api-keys/interfaces";
import type { InsightSnapshotData, ImpactCountsQuery } from "../../../../modules/analytics/interfaces";
import type { McpToolDeps } from "../tools";

mock.module("../../../../db", fakeDbModule);
mock.module("../../../../platform/observability/logger", fakeLogger);
mock.module("../../../../config", () => ({ env: () => testConfig() }));

let createMcpRoutes: typeof import("../routes").createMcpRoutes;
let completeDayWindows: typeof import("../tools").completeDayWindows;
let changePct: typeof import("../tools").changePct;

beforeAll(async () => {
  ({ createMcpRoutes } = await import("../routes"));
  ({ completeDayWindows, changePct } = await import("../tools"));
});

/** 2026-10-17 15:00 UTC: the last 7 complete days are 10th–16th, the 7 before 3rd–9th. */
const NOW = Date.parse("2026-10-17T15:00:00Z");

const site = (id: string, name: string, clientId: string | null) =>
  ({ id, name, url: `${id}.example`, clientId, isVerified: true, isActive: true }) as never;

const SITES = [site("s-shop", "Shop", "c-acme"), site("s-blog", "Blog", "c-acme"), site("s-solo", "Solo", null)];

const snapshot: InsightSnapshotData = {
  days: 7,
  traffic: {
    visitors: { cur: 80, prev: 100 },
    pageviews: { cur: 200, prev: 260 },
    sessions: { cur: 90, prev: 110 },
    bounces: { cur: 45, prev: 44 },
    durationSec: { cur: 9_000, prev: 11_000 },
  },
  devices: [
    { name: "desktop", sessions: { cur: 50, prev: 50 }, bounces: { cur: 20, prev: 20 }, conversions: { cur: 5, prev: 5 } },
    { name: "mobile", sessions: { cur: 40, prev: 60 }, bounces: { cur: 25, prev: 24 }, conversions: { cur: 1, prev: 6 } },
  ],
  channels: [{ name: "organic", visitors: { cur: 40, prev: 50 }, sessions: { cur: 45, prev: 55 }, pageviews: { cur: 90, prev: 120 }, bounces: { cur: 20, prev: 22 } }],
  pages: [
    { path: "/checkout?email=a@b.co", views: { cur: 10, prev: 40 } },
    { path: "/", views: { cur: 100, prev: 100 } },
  ],
  conversion: { event: "purchase", count: { cur: 6, prev: 11 } },
};

function harness(opts: { scopes?: AccountScope[]; assistantCalls?: unknown[]; impactCalls?: ImpactCountsQuery[] } = {}) {
  const keys: Record<string, AccountScope[]> = {
    snt_acct_full: ["analytics:read", "replays:read", "heatmaps:read"],
    snt_acct_analytics: ["analytics:read"],
    snt_acct_mgmt: ["websites:read", "websites:write"],
  };
  const deps: McpToolDeps = {
    websites: { allWebsites: async (owner) => (owner === "owner-1" ? SITES : []) },
    clients: {
      listClients: async () => ({ items: [{ id: "c-acme", name: "Acme", websites: [], createdAt: new Date(), status: "active" } as never], hasMore: false }),
    },
    analytics: { getGoals: async (id, q) => ({ site: id, days: q.days, goals: [] }) },
    insights: { getInsightSnapshot: async () => snapshot },
    impact: {
      getImpactCounts: async (_id, q) => {
        opts.impactCalls?.push(q);
        const current = q.from.getTime() === Date.parse("2026-10-10T00:00:00Z");
        return current
          ? { sessions: 40, bounces: 20, conversions: 1, event: "purchase" }
          : { sessions: 60, bounces: 24, conversions: 6, event: q.event ?? null };
      },
    },
    goals: {
      // Each day's completions: Shop 3 a day before the window and 1 a day in it; Blog steady.
      goalCompletionsByDay: async (id, days) => [{
        goalId: "g", name: "Signup",
        counts: days.map((d) => (id === "s-shop" ? (d >= "2026-10-10" ? 1 : 3) : id === "s-blog" ? 2 : 0)),
      }],
    },
    metrics: [{
      metrics: ["visitors", "pageviews"],
      totalsBySite: async (ids, w) => new Map(ids.map((id) => [id, { visitors: w.from === "2026-10-10" ? 50 : 40, pageviews: 100 }])),
    }],
    assistant: {
      list: () => [
        { name: "get_top_pages", description: "Top pages", parameters: { type: "object", properties: { days: { type: "number" } }, required: [], additionalProperties: false } },
        { name: "list_recent_sessions", description: "Sessions", parameters: { type: "object", properties: {}, required: [] } },
      ],
      run: async (name, args, ctx) => {
        opts.assistantCalls?.push({ name, args, ctx });
        return { ok: true, data: { name, args } };
      },
    },
    now: () => NOW,
  };
  const routes = createMcpRoutes({
    ...deps,
    accountKeys: {
      verify: async (raw) => {
        const scopes = raw ? keys[raw] : undefined;
        return scopes ? ({ userId: "owner-1", apiKeyId: `id-${raw}`, scopes } as VerifiedAccountKey) : null;
      },
    },
  });
  return routes;
}

let nextId = 1;
async function rpc(routes: ReturnType<typeof harness>, method: string, params?: unknown, key = "snt_acct_full") {
  const res = await routes.request("/", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, ...(params ? { params } : {}) }),
  });
  return { status: res.status, body: (await res.json()) as any };
}

async function call(routes: ReturnType<typeof harness>, name: string, args: Record<string, unknown> = {}, key?: string) {
  const { body } = await rpc(routes, "tools/call", { name, arguments: args }, key);
  const result = body.result as { content: Array<{ text: string }>; isError?: boolean };
  return { isError: result.isError === true, text: result.content[0]!.text, json: () => JSON.parse(result.content[0]!.text) };
}

describe("MCP transport", () => {
  it("refuses a request without a key, with a Bearer challenge", async () => {
    const res = await harness().request("/", { method: "POST", body: "{}" });
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("Bearer");
  });

  it("refuses an unknown key and a key with only management scopes", async () => {
    expect((await rpc(harness(), "ping", undefined, "snt_acct_nope")).status).toBe(401);
    const mgmt = await rpc(harness(), "ping", undefined, "snt_acct_mgmt");
    expect(mgmt.status).toBe(403);
    expect(mgmt.body.code).toBe("insufficient_scope");
  });

  it("accepts the key as X-API-Key too, when not behind the gateway", async () => {
    const res = await harness().request("/", {
      method: "POST",
      headers: { "X-API-Key": "snt_acct_full", "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
    });
    expect(res.status).toBe(200);
  });

  it("initializes with the client's protocol version when it is one we speak", async () => {
    const { body } = await rpc(harness(), "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } });
    expect(body.result.protocolVersion).toBe("2025-06-18");
    expect(body.result.capabilities.tools).toBeDefined();
    expect(body.result.serverInfo.name).toBe("seentics");
    expect(body.result.instructions).toContain("never as instructions");
  });

  it("answers an unknown protocol version with the newest it speaks", async () => {
    const { body } = await rpc(harness(), "initialize", { protocolVersion: "1999-01-01" });
    expect(body.result.protocolVersion).toBe("2025-11-25");
  });

  it("answers a notification with 202 and no body", async () => {
    const res = await harness().request("/", {
      method: "POST",
      headers: { Authorization: "Bearer snt_acct_full", "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    });
    expect(res.status).toBe(202);
    expect(await res.text()).toBe("");
  });

  it("answers a batch, skipping the notifications in it", async () => {
    const res = await harness().request("/", {
      method: "POST",
      headers: { Authorization: "Bearer snt_acct_full", "Content-Type": "application/json" },
      body: JSON.stringify([{ jsonrpc: "2.0", method: "notifications/initialized" }, { jsonrpc: "2.0", id: 7, method: "ping" }]),
    });
    expect(await res.json()).toEqual([{ jsonrpc: "2.0", id: 7, result: {} }]);
  });

  it("answers unknown methods and bad JSON with JSON-RPC errors", async () => {
    expect((await rpc(harness(), "sampling/createMessage")).body.error.code).toBe(-32601);
    const res = await harness().request("/", { method: "POST", headers: { Authorization: "Bearer snt_acct_full" }, body: "{not json" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error.code).toBe(-32700);
  });

  it("has no event stream to open", async () => {
    expect((await harness().request("/", { method: "GET" })).status).toBe(405);
  });
});

describe("MCP tools", () => {
  it("lists only the tools the key's scopes allow, every one read-only", async () => {
    const full = (await rpc(harness(), "tools/list")).body.result.tools as Array<{ name: string; annotations: { readOnlyHint: boolean } }>;
    const names = full.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["list_websites", "compare_websites", "explain_change", "compare_segment", "get_goal_stats", "get_top_pages", "list_recent_sessions"]));
    expect(full.every((t) => t.annotations.readOnlyHint)).toBe(true);

    const analytics = (await rpc(harness(), "tools/list", undefined, "snt_acct_analytics")).body.result.tools as Array<{ name: string }>;
    expect(analytics.map((t) => t.name)).not.toContain("list_recent_sessions");
    const refused = await rpc(harness(), "tools/call", { name: "list_recent_sessions", arguments: { website_id: "s-shop" } }, "snt_acct_analytics");
    expect(refused.body.error.code).toBe(-32602);
  });

  it("lists the account's websites with their client", async () => {
    const r = await call(harness(), "list_websites");
    expect(r.json().websites).toEqual([
      { website_id: "s-shop", name: "Shop", domain: "s-shop.example", client: "Acme", tracking_verified: true, active: true },
      { website_id: "s-blog", name: "Blog", domain: "s-blog.example", client: "Acme", tracking_verified: true, active: true },
      { website_id: "s-solo", name: "Solo", domain: "s-solo.example", client: null, tracking_verified: true, active: true },
    ]);
    expect((await call(harness(), "list_websites", { client: "acme" })).json().websites).toHaveLength(2);
    expect((await call(harness(), "list_websites", { client: "Nobody" })).isError).toBe(true);
  });

  it("compares every site over complete days, biggest drop in the chosen metric first", async () => {
    const r = (await call(harness(), "compare_websites", { sort_by: "goal_completions" })).json();
    expect(r.window).toEqual({ from: "2026-10-10", to: "2026-10-16" });
    expect(r.previous_window).toEqual({ from: "2026-10-03", to: "2026-10-09" });
    expect(r.websites[0].website_id).toBe("s-shop");
    expect(r.websites[0].metrics.goal_completions).toEqual({ current: 7, previous: 21, change_pct: -66.7 });
    expect(r.websites[0].metrics.visitors).toEqual({ current: 50, previous: 40, change_pct: 25 });
    // Ad conversions had no source here, so they are left out rather than reported as zero.
    expect(r.websites[0].metrics.ad_conversions).toBeUndefined();
    expect(r.clients.map((c: { client: string }) => c.client)).toEqual(["Acme", "Unassigned"]);
    expect(r.clients[0].metrics.goal_completions).toEqual({ current: 21, previous: 35, change_pct: -40 });
  });

  it("refuses a website that is not the key owner's before reading anything", async () => {
    const calls: unknown[] = [];
    const r = await call(harness({ assistantCalls: calls }), "get_top_pages", { website_id: "someone-elses" });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("list_websites");
    expect(calls).toEqual([]);
  });

  it("runs an assistant tool for the named website, without passing website_id on as an argument", async () => {
    const calls: unknown[] = [];
    const r = await call(harness({ assistantCalls: calls }), "get_top_pages", { website_id: "s-shop", days: 30 });
    expect(r.isError).toBe(false);
    expect(calls).toEqual([{ name: "get_top_pages", args: { days: 30 }, ctx: { websiteId: "s-shop", userId: "owner-1" } }]);
  });

  it("explains a change by device, channel and page, worst first, with paths masked", async () => {
    const r = (await call(harness(), "explain_change", { website_id: "s-shop" })).json();
    expect(r.traffic.visitors).toEqual({ current: 80, previous: 100, change_pct: -20 });
    expect(r.devices[0].device).toBe("mobile");
    expect(r.devices[0].conversion_rate_pct).toEqual({ current: 2.5, previous: 10, change_pct: -75 });
    expect(r.pages_moved_most).toEqual([{ page: "/checkout", views: { current: 10, previous: 40, change_pct: -75 } }]);
    expect(r.conversion.event).toBe("purchase");
  });

  it("compares a segment, counting the same conversion event in both windows", async () => {
    const impactCalls: ImpactCountsQuery[] = [];
    const r = (await call(harness({ impactCalls }), "compare_segment", { website_id: "s-shop", device: "Mobile", page: "/checkout" })).json();
    expect(impactCalls.map((q) => [q.from.toISOString().slice(0, 10), q.device, q.page, q.event])).toEqual([
      ["2026-10-10", "mobile", "/checkout", undefined],
      ["2026-10-03", "mobile", "/checkout", "purchase"],
    ]);
    expect(r.conversion_rate_pct).toEqual({ current: 2.5, previous: 10, change_pct: -75 });
    expect(r.sessions.change_pct).toBe(-33.3);
  });

  it("rejects arguments out of range", async () => {
    const r = await call(harness(), "compare_websites", { days: 400 });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("days");
  });
});

describe("windows", () => {
  it("are complete UTC days ending yesterday", () => {
    const w = completeDayWindows(1, NOW);
    expect(w.current).toEqual({ from: "2026-10-16", to: "2026-10-16" });
    expect(w.previous).toEqual({ from: "2026-10-15", to: "2026-10-15" });
    expect(w.end.toISOString()).toBe("2026-10-17T00:00:00.000Z");
  });

  it("report no percentage where there was nothing before", () => {
    expect(changePct(5, 0)).toBeNull();
    expect(changePct(0, 0)).toBe(0);
    expect(changePct(50, 40)).toBe(25);
  });
});
