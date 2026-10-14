import { describe, expect, it } from "bun:test";
import type { InsightSnapshotData } from "../../../analytics/interfaces";
import {
  MAX_DIGEST_LINES,
  MAX_DIGEST_RECIPIENTS,
  buildWeeklyDigest,
  formatChange,
  formatDuration,
  formatPointChange,
} from "../builder";

const SITE = { id: "11111111-1111-4111-8111-111111111111", name: "Acme Store", domain: "acme.com", userIds: ["owner-1", "member-1"] };
// Monday 07:00 UTC: the week reported is Mon 6th to Sun 12th.
const NOW = new Date("2026-10-12T07:00:00Z");

const pair = (cur: number, prev: number) => ({ cur, prev });
function snapshot(over: Partial<InsightSnapshotData["traffic"]> = {}, conversion: InsightSnapshotData["conversion"] = null) {
  return {
    traffic: {
      visitors: pair(12_340, 11_426),
      pageviews: pair(40_100, 41_000),
      sessions: pair(15_000, 14_000),
      bounces: pair(6_300, 6_160),
      durationSec: pair(15_000 * 154, 14_000 * 140),
      ...over,
    },
    conversion,
  };
}

describe("formatting", () => {
  it("formats relative change as a whole signed percent", () => {
    expect(formatChange(108, 100)).toBe("+8%");
    expect(formatChange(88, 100)).toBe("-12%");
    expect(formatChange(100, 100)).toBe("0%");
    expect(formatChange(100.4, 100)).toBe("0%");
    expect(formatChange(25_000, 100)).toBe("+24,900%");
  });

  it("has no change when the previous period is zero", () => {
    expect(formatChange(50, 0)).toBeNull();
    expect(formatChange(0, 0)).toBeNull();
  });

  it("formats rates as percentage points", () => {
    expect(formatPointChange(42, 44, true)).toBe("-2 pts");
    expect(formatPointChange(44.04, 41.5, true)).toBe("+2.5 pts");
    expect(formatPointChange(40, 40, true)).toBe("0 pts");
    expect(formatPointChange(40, 0, false)).toBeNull();
  });

  it("formats durations", () => {
    expect(formatDuration(45.4)).toBe("45s");
    expect(formatDuration(154)).toBe("2m 34s");
    expect(formatDuration(3_720)).toBe("1h 2m");
    expect(formatDuration(-3)).toBe("0s");
  });
});

describe("buildWeeklyDigest", () => {
  it("builds the notice for the seven days ending yesterday", () => {
    const n = buildWeeklyDigest({
      site: SITE,
      snapshot: snapshot({}, { event: "purchase", count: pair(120, 100) }),
      insightLines: [
        { kind: "finding", text: "Mobile bounce rate rose to 61%." },
        { kind: "action", text: "Check the checkout page on small screens." },
      ],
      now: NOW,
    });
    expect(n).toEqual({
      kind: "weekly_digest",
      websiteId: SITE.id,
      websiteName: "Acme Store",
      websiteDomain: "acme.com",
      userIds: ["owner-1", "member-1"],
      periodStart: "2026-10-05",
      periodEnd: "2026-10-11",
      metrics: [
        { label: "Visitors", value: "12,340", change: "+8%" },
        { label: "Pageviews", value: "40,100", change: "-2%" },
        { label: "Bounce rate", value: "42%", change: "-2 pts" },
        { label: "Avg. session", value: "2m 34s", change: "+10%" },
        { label: "Conversions", value: "120", change: "+20%" },
      ],
      lines: [
        { kind: "finding", text: "Mobile bounce rate rose to 61%." },
        { kind: "action", text: "Check the checkout page on small screens." },
      ],
    });
  });

  it("uses whole UTC days whatever time the job runs", () => {
    const n = buildWeeklyDigest({ site: SITE, snapshot: snapshot(), insightLines: [], now: new Date("2026-10-12T23:59:59Z") })!;
    expect([n.periodStart, n.periodEnd]).toEqual(["2026-10-05", "2026-10-11"]);
  });

  it("gives null changes for a site new this week", () => {
    const n = buildWeeklyDigest({
      site: SITE,
      snapshot: snapshot({ visitors: pair(30, 0), pageviews: pair(90, 0), sessions: pair(40, 0), bounces: pair(10, 0), durationSec: pair(4_000, 0) }),
      insightLines: [],
      now: NOW,
    })!;
    expect(n.metrics.map((m) => m.change)).toEqual([null, null, null, null]);
    expect(n.metrics.map((m) => m.value)).toEqual(["30", "90", "25%", "1m 40s"]);
    expect(n.lines).toEqual([]);
  });

  it("leaves conversions out when there were none in either week", () => {
    const n = buildWeeklyDigest({ site: SITE, snapshot: snapshot({}, { event: "signup", count: pair(0, 0) }), insightLines: [], now: NOW })!;
    expect(n.metrics.map((m) => m.label)).not.toContain("Conversions");
  });

  it("is null for a site with no visitors in either week", () => {
    expect(buildWeeklyDigest({ site: SITE, snapshot: snapshot({ visitors: pair(0, 0) }), insightLines: [], now: NOW })).toBeNull();
  });

  it("still sends when this week is empty but last week was not", () => {
    const n = buildWeeklyDigest({
      site: SITE,
      snapshot: snapshot({ visitors: pair(0, 50), pageviews: pair(0, 80), sessions: pair(0, 60), bounces: pair(0, 30), durationSec: pair(0, 600) }),
      insightLines: [],
      now: NOW,
    })!;
    expect(n.metrics[0]).toEqual({ label: "Visitors", value: "0", change: "-100%" });
    expect(n.metrics[2]!.change).toBeNull();
    expect(n.metrics[3]!.change).toBeNull();
  });

  it("dedupes and caps recipients, and caps and cleans lines", () => {
    const ids = ["owner-1", "owner-1", "", ...Array.from({ length: 80 }, (_, i) => `m-${i}`)];
    const lines = [
      { kind: "finding" as const, text: "  " },
      ...Array.from({ length: 10 }, (_, i) => ({ kind: i % 2 ? ("action" as const) : ("finding" as const), text: ` line ${i} ` })),
    ];
    const n = buildWeeklyDigest({ site: { ...SITE, userIds: ids }, snapshot: snapshot(), insightLines: lines, now: NOW })!;
    expect(n.userIds).toHaveLength(MAX_DIGEST_RECIPIENTS);
    expect(n.userIds[0]).toBe("owner-1");
    expect(new Set(n.userIds).size).toBe(n.userIds.length);
    expect(n.lines).toHaveLength(MAX_DIGEST_LINES);
    expect(n.lines[0]).toEqual({ kind: "finding", text: "line 0" });
    expect(n.metrics.length).toBeLessThanOrEqual(6);
  });
});
