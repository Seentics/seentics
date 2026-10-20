import { describe, expect, it } from "bun:test";
import { addDays, datesBetween, localDate, resolveSpan, zonedMidnight } from "../lib/analytics-window";

/**
 * The window every dashboard read uses. What matters is that "Today", "Yesterday", a custom
 * range and the period before each are the viewer's local days, and that a comparison period
 * can be asked for by itself — the dashboard used to send `days=0` (rejected, so each endpoint
 * fell back to its own default) and fetch `days×2` for the comparison (past the clamp at 365).
 */

const DAY = 86_400_000;
// 09:30 in Dhaka (UTC+6), 2026-10-20.
const NOW = Date.parse("2026-10-20T03:30:00Z");

describe("resolveSpan — trailing days", () => {
  it("reads days=0 as today since local midnight, not as a bad value", () => {
    const s = resolveSpan({ days: "0" }, "Asia/Dhaka", 30, NOW);
    expect(s.start).toBe("2026-10-19T18:00:00.000Z");
    expect(s.end).toBe(new Date(NOW).toISOString());
    expect(s.days).toBe(1);
    expect(s.fromDate).toBe("2026-10-20");
    expect(s.toDate).toBe("2026-10-20");
  });

  it("is today plus the N−1 local days before it", () => {
    const s = resolveSpan({ days: "7" }, "Asia/Dhaka", 30, NOW);
    expect(s.fromDate).toBe("2026-10-14");
    expect(s.toDate).toBe("2026-10-20");
    expect(s.days).toBe(7);
    expect(s.explicit).toBe(false);
  });

  it("compares today with yesterday up to the same time of day", () => {
    const s = resolveSpan({ days: "0" }, "Asia/Dhaka", 7, NOW);
    expect(s.prevStart).toBe("2026-10-18T18:00:00.000Z");
    expect(s.prevEnd).toBe("2026-10-19T03:30:00.000Z");
  });

  it("falls back to the endpoint's default for a bad value", () => {
    expect(resolveSpan({ days: "abc" }, "UTC", 30, NOW).days).toBe(30);
    expect(resolveSpan({ days: "-1" }, "UTC", 30, NOW).days).toBe(30);
    expect(resolveSpan({ days: "366" }, "UTC", 30, NOW).days).toBe(30);
    expect(resolveSpan({}, "UTC", 30, NOW).days).toBe(30);
  });
});

describe("resolveSpan — explicit ranges", () => {
  it("reads a date as the whole local day, with `to` inclusive", () => {
    const s = resolveSpan({ from: "2026-10-19", to: "2026-10-19" }, "Asia/Dhaka", 7, NOW);
    expect(s.start).toBe("2026-10-18T18:00:00.000Z");
    expect(s.end).toBe("2026-10-19T18:00:00.000Z");
    expect(s.days).toBe(1);
    expect(s.explicit).toBe(true);
  });

  it("compares yesterday with the whole day before it", () => {
    const s = resolveSpan({ from: "2026-10-19", to: "2026-10-19" }, "Asia/Dhaka", 7, NOW);
    expect(s.prevStart).toBe("2026-10-17T18:00:00.000Z");
    expect(s.prevEnd).toBe("2026-10-18T18:00:00.000Z");
  });

  it("never runs past now", () => {
    const s = resolveSpan({ from: "2026-10-20", to: "2026-10-25" }, "Asia/Dhaka", 7, NOW);
    expect(s.end).toBe(new Date(NOW).toISOString());
    expect(s.toDate).toBe("2026-10-20");
  });

  it("answers a 365-day range and the year before it, which `days` alone cannot", () => {
    const cur = resolveSpan({ from: "2025-10-21", to: "2026-10-20" }, "UTC", 7, NOW);
    expect(cur.days).toBe(365);
    const prev = resolveSpan({ from: "2024-10-21", to: "2025-10-20" }, "UTC", 7, NOW);
    expect(prev.days).toBe(365);
    expect(prev.end).toBe("2025-10-21T00:00:00.000Z");
  });

  it("takes ISO timestamps as exact instants", () => {
    const s = resolveSpan({ from: "2026-10-19T06:00:00Z", to: "2026-10-19T12:00:00Z" }, "UTC", 7, NOW);
    expect(s.start).toBe("2026-10-19T06:00:00.000Z");
    expect(s.end).toBe("2026-10-19T12:00:00.000Z");
    // Not day-aligned: compared with the six hours just before.
    expect(s.prevStart).toBe("2026-10-19T00:00:00.000Z");
    expect(s.prevEnd).toBe("2026-10-19T06:00:00.000Z");
  });

  it("ignores a reversed, malformed, impossible or over-long range in favour of `days`", () => {
    for (const q of [
      { from: "2026-10-19", to: "2026-10-01" },
      { from: "yesterday" },
      { from: "2026-02-30" },
      { from: "2026-10-19'; DROP TABLE x; --" },
      { from: "2020-01-01", to: "2026-10-01" },
      { from: "2026-10-25" },
    ]) {
      const s = resolveSpan({ ...q, days: "7" }, "UTC", 30, NOW);
      expect(s.explicit).toBe(false);
      expect(s.days).toBe(7);
    }
  });
});

describe("rollup days", () => {
  it("are the whole UTC days for a UTC window, as the daily rollups always read", () => {
    const s = resolveSpan({ days: "7" }, "UTC", 7, NOW);
    expect([s.fromDay, s.toDay]).toEqual(["2026-10-14", "2026-10-20"]);
  });

  it("are the UTC days mostly inside a local window", () => {
    // Yesterday in Dhaka is 18:00Z on the 18th to 18:00Z on the 19th: the 19th, mostly.
    const s = resolveSpan({ from: "2026-10-19", to: "2026-10-19" }, "Asia/Dhaka", 7, NOW);
    expect([s.fromDay, s.toDay]).toEqual(["2026-10-19", "2026-10-19"]);
  });

  it("are never empty, however short the window", () => {
    const early = Date.parse("2026-10-19T19:00:00Z"); // 01:00 in Dhaka
    const s = resolveSpan({ days: "0" }, "Asia/Dhaka", 7, early);
    expect(s.fromDay <= s.toDay).toBe(true);
  });
});

describe("date helpers", () => {
  it("finds local midnight across a DST change", () => {
    // New York leaves DST on 2026-11-01: midnight that day is still EDT (UTC−4).
    expect(new Date(zonedMidnight("2026-11-01", "America/New_York")).toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(new Date(zonedMidnight("2026-11-02", "America/New_York")).toISOString()).toBe("2026-11-02T05:00:00.000Z");
  });

  it("lists every date of a range", () => {
    expect(datesBetween("2026-02-27", "2026-03-02")).toEqual(["2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02"]);
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(localDate(NOW - DAY, "Asia/Dhaka")).toBe("2026-10-19");
  });
});
