import { describe, expect, it } from "bun:test";
import type { StoredInsight } from "../../insights/types";
import type { WeeklyDigestNotice } from "../builder";
import { gatewayNotifySender, runWeeklyDigest, type DigestRunnerDeps } from "../runner";

const NOW = new Date("2026-10-12T07:00:00Z");
const pair = (cur: number, prev: number) => ({ cur, prev });
const traffic = (visitors: number, prev: number) => ({
  traffic: { visitors: pair(visitors, prev), pageviews: pair(visitors * 3, prev * 3), sessions: pair(visitors, prev), bounces: pair(0, 0), durationSec: pair(visitors * 60, prev * 60) },
  conversion: null,
});

const insight = (date: string, text: string): StoredInsight => ({
  websiteId: "s", insightDate: date, status: "ready", source: "rules",
  lines: [{ kind: "finding", text, evidence: { kind: "traffic", label: "Traffic" } }],
  reason: null, model: null, inputTokens: 0, outputTokens: 0, costUsd: 0, createdAt: date,
});

function deps(over: Partial<DigestRunnerDeps> = {}) {
  const sent: WeeklyDigestNotice[] = [];
  const generated: string[] = [];
  const snapshotEnds: string[] = [];
  const d: DigestRunnerDeps = {
    listSites: async () => ["busy", "quiet", "stale"],
    describeSite: async (id) => ({ id, name: `Site ${id}`, domain: `${id}.com`, userIds: ["owner", "member"] }),
    snapshot: async (id, _days, end) => {
      snapshotEnds.push(end.toISOString());
      return id === "quiet" ? traffic(0, 0) : traffic(100, 80);
    },
    insights: {
      latest: async (id) => (id === "busy" ? insight("2026-10-12", "Busy today.") : insight("2026-10-01", "Old.")),
      generate: async (id) => { generated.push(id); return { insight: insight("2026-10-12", `Fresh for ${id}.`) }; },
    },
    send: async (n) => { sent.push(n); },
    now: () => NOW,
    ...over,
  };
  return { d, sent, generated, snapshotEnds };
}

describe("runWeeklyDigest", () => {
  it("sends sites with traffic, skips quiet ones, and reads whole UTC days", async () => {
    const { d, sent, generated, snapshotEnds } = deps();
    const stats = await runWeeklyDigest(d);
    expect(stats).toEqual({ sent: 2, skipped: 1, failed: 0 });
    expect(sent.map((n) => n.websiteId).sort()).toEqual(["busy", "stale"]);
    expect(new Set(snapshotEnds)).toEqual(new Set(["2026-10-12T00:00:00.000Z"]));
    // Today's insight is used as is; a stale one is regenerated; a quiet site costs no model call.
    expect(generated).toEqual(["stale"]);
    expect(sent.find((n) => n.websiteId === "busy")!.lines).toEqual([{ kind: "finding", text: "Busy today." }]);
    expect(sent.find((n) => n.websiteId === "stale")!.lines).toEqual([{ kind: "finding", text: "Fresh for stale." }]);
  });

  it("falls back to the older insight, then to no lines, when generating fails", async () => {
    const { d, sent } = deps({
      listSites: async () => ["stale"],
      insights: { latest: async () => insight("2026-10-01", "Old."), generate: async () => { throw new Error("model down"); } },
    });
    await runWeeklyDigest(d);
    expect(sent[0]!.lines).toEqual([{ kind: "finding", text: "Old." }]);

    const none = deps({
      listSites: async () => ["stale"],
      insights: { latest: async () => null, generate: async () => { throw new Error("model down"); } },
    });
    await runWeeklyDigest(none.d);
    expect(none.sent[0]!.lines).toEqual([]);
  });

  it("counts a failing site and carries on", async () => {
    const { d, sent } = deps({
      send: async (n) => { if (n.websiteId === "busy") throw new Error("notify returned 502"); sent.push(n); },
    });
    const stats = await runWeeklyDigest(d);
    expect(stats).toEqual({ sent: 1, skipped: 1, failed: 1 });
  });

  it("never throws, even when the site list cannot be read", async () => {
    const { d } = deps({ listSites: async () => { throw new Error("db down"); } });
    expect(await runWeeklyDigest(d)).toEqual({ sent: 0, skipped: 0, failed: 0 });
  });

  it("runs at most two sites at a time", async () => {
    let active = 0;
    let peak = 0;
    const { d } = deps({
      listSites: async () => ["a", "b", "c", "d", "e"],
      snapshot: async () => {
        active += 1; peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active -= 1;
        return traffic(10, 10);
      },
    });
    await runWeeklyDigest(d);
    expect(peak).toBe(2);
  });
});

describe("gatewayNotifySender", () => {
  it("posts the notice with the gateway key and fails on a non-2xx", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    let status = 202;
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(null, { status });
    }) as unknown as typeof fetch;
    const send = gatewayNotifySender({ url: "http://gw/api/v1/internal/notify", apiKey: "k" }, fake);
    const { d, sent } = deps({ listSites: async () => ["busy"] });
    await runWeeklyDigest(d);
    await send(sent[0]!);
    expect(calls[0]!.url).toBe("http://gw/api/v1/internal/notify");
    expect((calls[0]!.init.headers as Record<string, string>)["X-API-Key"]).toBe("k");
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual(sent[0]!);
    status = 500;
    await expect(send(sent[0]!)).rejects.toThrow("notify returned 500");
  });
});
