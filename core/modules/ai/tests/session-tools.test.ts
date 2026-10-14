import { describe, expect, it } from "bun:test";
import type { FrustratedSessionRow, SessionAnalysisReads, SessionAnalysisView } from "../../recordings/interfaces";
import { ToolRegistry } from "../tools/registry";
import { sessionTools } from "../tools/session-reads";

const SITE = "11111111-1111-4111-8111-111111111111";
const ctx = { websiteId: SITE, userId: "u1" };

const row: FrustratedSessionRow = {
  sessionId: "sess_abc",
  startedAt: "2026-10-13T09:00:00.000Z",
  score: 76,
  counts: { error_click: 1, rage_click: 1 },
  device: "Desktop",
  browser: "Chrome",
  country: "DE",
  entryPage: "https://shop.test/orders/884213?token=x",
  durationSeconds: 40,
  pagesViewed: 3,
  summary: null,
  outcome: null,
};

const view: SessionAnalysisView = {
  sessionId: "sess_abc",
  status: "ready",
  score: 76,
  counts: { rage_click: 1 },
  signals: [{ type: "rage_click", atMs: 34_281, page: "/cart", label: 'button "Apply"', count: 5 }],
  timeline: {
    durationMs: 40_001,
    pages: [{ path: "/", atMs: 0, dwellMs: 24_329 }, { path: "/cart", atMs: 24_329, dwellMs: 15_672 }],
    clicks: [],
    errors: [{ atMs: 32_421, page: "/cart", message: "TypeError" }],
    errorCount: 1,
    failedRequests: 0,
    fieldsTouched: 0,
    goal: { reached: false },
  },
  computedAt: "2026-10-13T10:00:00.000Z",
  startedAt: "2026-10-13T09:00:00.000Z",
  meta: { device: "Desktop", browser: "Chrome", os: "macOS", country: "DE", entryPage: "/", pagesViewed: 2, durationSeconds: 40 },
  summary: { text: "Struggled with Apply on /cart.", intent: "Use a coupon", outcome: "abandoned", moments: [{ atMs: 34_281, label: "Rage clicks" }] },
  summarySource: "ai",
  summaryStatus: "ready",
};

function port(calls: unknown[] = [], over: Partial<SessionAnalysisReads> = {}): SessionAnalysisReads {
  return {
    listFrustrated: async (site, opts) => { calls.push(["list", site, opts]); return [row]; },
    getAnalysis: async (site, id, opts) => { calls.push(["get", site, id, opts]); return { ...view, sessionId: id }; },
    ...over,
  };
}

describe("list_frustrated_sessions", () => {
  it("reads the bound website with defaults, compacts rows, and links each replay", async () => {
    const calls: unknown[] = [];
    const registry = new ToolRegistry(sessionTools(port(calls)));
    const res = await registry.run("list_frustrated_sessions", {}, ctx);
    expect(calls).toEqual([["list", SITE, { days: 7, signal: undefined, limit: 10 }]]);
    expect(res.ok).toBe(true);
    const payload = (res as { data: { data: { sessions: unknown[] }; display: { kind: string; items: Array<{ href: string; label: string; sublabel: string }> } } }).data;
    expect(payload.data.sessions[0]).toMatchObject({ session_id: "sess_abc", frustration_score: 76, signals: "error_click 1, rage_click 1", entry_page: "/orders/:id" });
    expect(payload.display.kind).toBe("links");
    expect(payload.display.items[0]).toEqual({
      label: "Score 76 · error_click 1, rage_click 1",
      sublabel: "Desktop · DE · /orders/:id",
      href: `/websites/${SITE}/replays/sess_abc`,
    });
  });

  it("passes a signal filter through and rejects an unknown one", async () => {
    const calls: unknown[] = [];
    const registry = new ToolRegistry(sessionTools(port(calls)));
    await registry.run("list_frustrated_sessions", { days: 30, signal: "dead_click", limit: 5 }, ctx);
    expect(calls[0]).toEqual(["list", SITE, { days: 30, signal: "dead_click", limit: 5 }]);
    expect((await registry.run("list_frustrated_sessions", { signal: "sad_click" }, ctx)).ok).toBe(false);
  });

  it("turns a failed read into a message the model can relay", async () => {
    const registry = new ToolRegistry(sessionTools(port([], { listFrustrated: async () => { throw new Error("db timeout"); } })));
    expect(await registry.run("list_frustrated_sessions", {}, ctx)).toEqual({ ok: false, error: "db timeout" });
  });
});

describe("get_session_summary", () => {
  it("asks for a summary of the session on the bound website and returns it with timestamps", async () => {
    const calls: unknown[] = [];
    const res = await new ToolRegistry(sessionTools(port(calls))).run("get_session_summary", { sessionId: "sess_abc" }, ctx);
    expect(calls).toEqual([["get", SITE, "sess_abc", { summarize: true }]]);
    const payload = (res as { data: { data: Record<string, unknown>; display: { items: Array<{ href: string }> } } }).data;
    expect(payload.data).toMatchObject({
      session_id: "sess_abc",
      outcome: "abandoned",
      moments: ["0:34 Rage clicks"],
      duration: "0:40",
      pages: ["0:00 /", "0:24 /cart"],
      frustration_moments: ['0:34 rage_click on /cart · button "Apply" x5'],
      errors: ["0:32 /cart: TypeError"],
    });
    expect(payload.display.items[0]!.href).toBe(`/websites/${SITE}/replays/sess_abc`);
  });

  it("refuses something that is not a session id before reading anything", async () => {
    const calls: unknown[] = [];
    const res = await new ToolRegistry(sessionTools(port(calls))).run("get_session_summary", { sessionId: "x' OR 1=1 --" }, ctx);
    expect(res).toEqual({ ok: false, error: "Not a session id. Call list_frustrated_sessions to find one." });
    expect(calls).toEqual([]);
  });

  it("says so for an unknown session, and for one not uploaded yet", async () => {
    const missing = port([], { getAnalysis: async () => ({ ...view, status: "not_found" }) });
    expect((await new ToolRegistry(sessionTools(missing)).run("get_session_summary", { sessionId: "nope" }, ctx)).ok).toBe(false);
    const pending = port([], { getAnalysis: async () => ({ ...view, status: "pending" }) });
    const res = await new ToolRegistry(sessionTools(pending)).run("get_session_summary", { sessionId: "new" }, ctx);
    expect(JSON.stringify(res)).toContain("not been uploaded yet");
  });

  it("reports why there is no summary rather than inventing one", async () => {
    const unconfigured = port([], { getAnalysis: async () => ({ ...view, summary: null, summarySource: null, summaryStatus: "unavailable" }) });
    const res = await new ToolRegistry(sessionTools(unconfigured)).run("get_session_summary", { sessionId: "s" }, ctx);
    expect((res as { data: { data: Record<string, unknown> } }).data.data).toMatchObject({ summary_status: "unavailable" });
  });
});
