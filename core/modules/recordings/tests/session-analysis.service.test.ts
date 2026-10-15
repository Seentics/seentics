import { beforeEach, describe, expect, it } from "bun:test";
// Registers the shared infrastructure stubs (logger, config, storage). Must come first.
import "./support/stubs";
import type { SessionSummarizer, SessionSummaryInput, SessionSummaryResult } from "../interfaces";
import type {
  AnalysisWrite,
  SessionAnalysisStore,
  SessionWithAnalysis,
  StoredAnalysis,
  SummaryWrite,
} from "../repositories/session-analysis.repository";
import {
  readSessionAnalysisConfig,
  SessionAnalysisService,
  SUMMARY_BREAKER_THRESHOLD,
  type SessionAnalysisConfig,
} from "../services/session-analysis.service";

/**
 * When an analysis is computed and when a summary is paid for.
 *
 * The rules under test are the cost controls: a recording is read once and the result
 * stored; a summary is written once per analysis, at most once per cooldown, within a daily
 * allowance, and never without a model.
 */

const SITE = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-10-14T12:00:00.000Z");
const HOUR = 3_600_000;

/** A recording with one rage cluster, as storage holds it. */
function recording(): unknown[] {
  const t = NOW.getTime() - 2 * HOUR;
  const node = {
    type: 0, id: 1, childNodes: [{ type: 2, id: 2, tagName: "html", attributes: {}, childNodes: [
      { type: 2, id: 3, tagName: "button", attributes: {}, childNodes: [{ type: 3, id: 4, textContent: "Pay" }] },
    ] }],
  };
  const rr = (at: number, type: number, data: Record<string, unknown>) => ({ type: "rrweb", ts: t + at, url: "https://x.test/cart", data: { type, timestamp: t + at, data } });
  return [
    rr(0, 4, { href: "https://x.test/cart" }),
    rr(1, 2, { node }),
    ...[0, 100, 200].map((d) => rr(1000 + d, 3, { source: 2, type: 2, id: 3, x: 10, y: 10 })),
    rr(9000, 3, { source: 1, positions: [] }),
  ];
}

class FakeStore implements SessionAnalysisStore {
  sessions = new Map<string, SessionWithAnalysis>();
  saved: AnalysisWrite[] = [];
  summaries: SummaryWrite[] = [];
  claims = 0;
  used = 0;
  pending: Array<{ websiteId: string; sessionId: string }> = [];
  candidates: Array<{ websiteId: string; sessionId: string }> = [];
  lastPendingQuery: { since: Date; idleBeforeMs: number; limit: number } | null = null;

  add(id: string, over: Partial<SessionWithAnalysis> = {}) {
    this.sessions.set(id, {
      websiteId: SITE, sessionId: id, startedAt: new Date(NOW.getTime() - 2 * HOUR), endMs: NOW.getTime() - HOUR,
      browser: "Chrome", device: "Desktop", os: "macOS", country: "DE", entryPage: "https://x.test/cart",
      pagesViewed: 1, durationSeconds: 9, analysis: null, ...over,
    });
  }
  async getSession(_w: string, id: string) { return this.sessions.get(id) ?? null; }
  async saveAnalysis(row: AnalysisWrite) {
    this.saved.push(row);
    const computedAt = new Date(NOW);
    const prev = this.sessions.get(row.sessionId)!;
    prev.analysis = {
      ...(prev.analysis ?? { summary: null, summarySource: null, summaryModel: null, summaryGeneratedAt: null, summaryAnalysisAt: null, summaryAttemptedAt: null }),
      status: row.status, score: row.score, counts: row.counts, signals: row.signals, timeline: row.timeline,
      analyzedThroughMs: row.analyzedThroughMs, computedAt,
    } as StoredAnalysis;
    return computedAt;
  }
  async claimSummary(_w: string, id: string, notSince: Date) {
    const a = this.sessions.get(id)?.analysis;
    if (!a) return false;
    if (a.summaryAttemptedAt && a.summaryAttemptedAt >= notSince) return false;
    a.summaryAttemptedAt = new Date(NOW);
    this.claims += 1;
    return true;
  }
  async saveSummary(_w: string, id: string, w: SummaryWrite) {
    this.summaries.push(w);
    const a = this.sessions.get(id)!.analysis!;
    Object.assign(a, { summary: w.summary, summarySource: w.source, summaryModel: w.model, summaryGeneratedAt: new Date(NOW), summaryAnalysisAt: w.analysisAt });
  }
  async countSummariesSince() { return this.used; }
  async listPending(q: { since: Date; idleBeforeMs: number; limit: number }) { this.lastPendingQuery = q; return this.pending.slice(0, q.limit); }
  async listFrustrated() { return []; }
  async listSummaryCandidates() { return this.candidates; }
}

class FakeSummarizer implements SessionSummarizer {
  calls: SessionSummaryInput[] = [];
  mode: "ai" | "down" | "throw" = "ai";
  modelConfigured = true;
  worth = true;
  template() { return { text: "Template.", intent: "Unclear", outcome: "succeeded" as const, moments: [] }; }
  worthModel() { return this.worth; }
  async summarize(input: SessionSummaryInput): Promise<SessionSummaryResult> {
    this.calls.push(input);
    if (this.mode === "throw") throw new Error("boom");
    const summary = { text: "The visitor rage-clicked Pay on /cart.", intent: "Pay", outcome: "struggled" as const, moments: [{ atMs: 1000, label: "Rage clicks" }] };
    return this.mode === "ai"
      ? { summary, source: "ai", model: "claude-haiku-5-5", inputTokens: 900, outputTokens: 120, costUsd: 0.00015 }
      : { summary, source: "rules", model: null, inputTokens: 0, outputTokens: 0, costUsd: 0 };
  }
}

let store: FakeStore;
let summarizer: FakeSummarizer;
let loads: string[];
let wired: SessionSummarizer | null;
let config: SessionAnalysisConfig;

function service() {
  return new SessionAnalysisService({
    store,
    load: async (_w, id) => { loads.push(id); return { rows: recording(), chunks: 1, truncated: false }; },
    summarizer: () => wired,
    config,
    now: () => NOW,
  });
}

beforeEach(() => {
  store = new FakeStore();
  summarizer = new FakeSummarizer();
  wired = summarizer;
  loads = [];
  config = { ...readSessionAnalysisConfig({}), summaryCooldownMs: 10 * 60_000, dailySummaryCap: 5 };
});

describe("getAnalysis", () => {
  it("analyses an unanalysed session once, stores it, and serves the stored result after", async () => {
    store.add("s1");
    const first = await service().getAnalysis(SITE, "s1", { summarize: false });
    expect(first).toMatchObject({ status: "ready", counts: { rage_click: 1 }, summaryStatus: "not_requested" });
    expect(first.score).toBeGreaterThan(0);
    await service().getAnalysis(SITE, "s1", { summarize: false });
    expect(loads).toEqual(["s1"]);
    expect(store.saved).toHaveLength(1);
    expect(store.saved[0]!.analyzedThroughMs).toBe(NOW.getTime() - HOUR);
  });

  it("answers not_found for an unknown session without reading storage", async () => {
    expect((await service().getAnalysis(SITE, "nope")).status).toBe("not_found");
    expect(loads).toEqual([]);
  });

  it("does not store an empty analysis for a live session whose bytes have not arrived", async () => {
    store.add("live", { endMs: NOW.getTime() - 60_000 });
    const svc = new SessionAnalysisService({ store, load: async () => null, summarizer: () => wired, config, now: () => NOW });
    expect((await svc.getAnalysis(SITE, "live")).status).toBe("pending");
    expect(store.saved).toEqual([]);
  });

  it("records a recording that could not be read as failed rather than throwing", async () => {
    store.add("s1");
    const svc = new SessionAnalysisService({ store, load: async () => { throw new Error("s3 down"); }, summarizer: () => wired, config, now: () => NOW });
    const view = await svc.getAnalysis(SITE, "s1");
    expect(store.saved[0]!.status).toBe("failed");
    expect(view).toMatchObject({ status: "ready", score: 0, summaryStatus: "no_data" });
    expect(summarizer.calls).toEqual([]);
  });
});

describe("summaries", () => {
  it("writes one on first request, records its cost, and serves it from storage after", async () => {
    store.add("s1");
    const view = await service().getAnalysis(SITE, "s1");
    expect(view).toMatchObject({ summaryStatus: "ready", summarySource: "ai", summary: { outcome: "struggled" } });
    expect(store.summaries[0]).toMatchObject({ source: "ai", model: "claude-haiku-5-5", inputTokens: 900, outputTokens: 120 });
    await service().getAnalysis(SITE, "s1");
    expect(summarizer.calls).toHaveLength(1);
  });

  it("hands the summarizer the stored analysis and environment, nothing typed", async () => {
    store.add("s1");
    await service().getAnalysis(SITE, "s1");
    const input = summarizer.calls[0]!;
    expect(input).toMatchObject({ websiteId: SITE, sessionId: "s1", device: "Desktop", country: "DE", counts: { rage_click: 1 } });
    expect(input.timeline.clicks[0]!.label).toBe('button "Pay"');
  });

  it("says unavailable, and calls nothing, when no model is configured", async () => {
    wired = null;
    store.add("s1");
    const view = await service().getAnalysis(SITE, "s1");
    expect(view).toMatchObject({ summaryStatus: "unavailable", summary: null });
    expect(store.claims).toBe(0);
  });

  it("serves the template inside the cooldown, without a second model call", async () => {
    store.add("s1");
    await service().getAnalysis(SITE, "s1", { summarize: false });
    store.sessions.get("s1")!.analysis!.summaryAttemptedAt = new Date(NOW.getTime() - 4 * 60_000);
    const view = await service().getAnalysis(SITE, "s1");
    expect(view).toMatchObject({ summaryStatus: "ready", summarySource: "rules", summary: { text: "Template." } });
    expect(summarizer.calls).toEqual([]);
  });

  it("serves the template once the site's daily allowance is used", async () => {
    store.add("s1");
    store.used = 5;
    expect(await service().getAnalysis(SITE, "s1")).toMatchObject({ summaryStatus: "ready", summarySource: "rules", summary: { text: "Template." } });
    expect(summarizer.calls).toEqual([]);
  });

  it("serves the template, with no model call, for a visit a model would add nothing to, or without a model", async () => {
    store.add("s1");
    summarizer.worth = false;
    expect(await service().getAnalysis(SITE, "s1")).toMatchObject({ summaryStatus: "ready", summarySource: "rules" });
    summarizer.worth = true;
    summarizer.modelConfigured = false;
    expect(await service().getAnalysis(SITE, "s1")).toMatchObject({ summaryStatus: "ready", summarySource: "rules" });
    expect(summarizer.calls).toEqual([]);
    expect(service().summariesEnabled()).toBe(false);
  });

  it("serves the template summary when the model is down, and tries the model again after the cooldown", async () => {
    store.add("s1");
    summarizer.mode = "down";
    expect(await service().getAnalysis(SITE, "s1")).toMatchObject({ summaryStatus: "ready", summarySource: "rules" });
    summarizer.mode = "ai";
    // Inside the cooldown: the template one is still served, no call made.
    expect((await service().getAnalysis(SITE, "s1")).summarySource).toBe("rules");
    expect(summarizer.calls).toHaveLength(1);
    store.sessions.get("s1")!.analysis!.summaryAttemptedAt = new Date(NOW.getTime() - 11 * 60_000);
    expect((await service().getAnalysis(SITE, "s1")).summarySource).toBe("ai");
    expect(summarizer.calls).toHaveLength(2);
  });

  it("serves the template when generation threw", async () => {
    store.add("s1");
    summarizer.mode = "throw";
    expect(await service().getAnalysis(SITE, "s1")).toMatchObject({ summaryStatus: "ready", summarySource: "rules" });
  });
});

describe("analyzePending", () => {
  it("asks for idle sessions in the lookback window and stores each", async () => {
    store.add("a");
    store.add("b");
    store.pending = [{ websiteId: SITE, sessionId: "a" }, { websiteId: SITE, sessionId: "b" }];
    const stats = await service().analyzePending();
    expect(stats).toEqual({ analyzed: 2, empty: 0, failed: 0 });
    expect(store.lastPendingQuery).toMatchObject({ idleBeforeMs: NOW.getTime() - 30 * 60_000, limit: 200 });
    expect(store.lastPendingQuery!.since.getTime()).toBe(NOW.getTime() - 48 * HOUR);
    expect(summarizer.calls).toEqual([]);
  });

  it("stores an idle session with nothing in storage as empty, so it is not retried every run", async () => {
    store.add("a");
    store.pending = [{ websiteId: SITE, sessionId: "a" }];
    const svc = new SessionAnalysisService({ store, load: async () => null, summarizer: () => wired, config, now: () => NOW });
    expect(await svc.analyzePending()).toEqual({ analyzed: 0, empty: 1, failed: 0 });
    expect(store.saved[0]!.status).toBe("empty");
  });
});

describe("summarizeTop", () => {
  it("does nothing without a model", async () => {
    wired = null;
    store.candidates = [{ websiteId: SITE, sessionId: "a" }];
    expect(await service().summarizeTop()).toEqual({ generated: 0, skipped: 0, failed: 0, tokens: 0, costUsd: 0 });
  });

  it("writes summaries for the candidates and adds up what they cost", async () => {
    for (const id of ["a", "b"]) {
      store.add(id);
      await service().getAnalysis(SITE, id, { summarize: false });
    }
    store.candidates = [{ websiteId: SITE, sessionId: "a" }, { websiteId: SITE, sessionId: "b" }];
    const stats = await service().summarizeTop();
    expect(stats).toMatchObject({ generated: 2, failed: 0, tokens: 2040 });
    expect(stats.costUsd).toBeCloseTo(0.0003, 8);
  });

  it("stops calling the model after repeated failures", async () => {
    const ids = Array.from({ length: SUMMARY_BREAKER_THRESHOLD + 3 }, (_, i) => `s${i}`);
    for (const id of ids) {
      store.add(id);
      await service().getAnalysis(SITE, id, { summarize: false });
    }
    store.candidates = ids.map((sessionId) => ({ websiteId: SITE, sessionId }));
    summarizer.mode = "down";
    const stats = await service().summarizeTop();
    expect(summarizer.calls).toHaveLength(SUMMARY_BREAKER_THRESHOLD);
    expect(stats.skipped).toBe(3);
  });
});
