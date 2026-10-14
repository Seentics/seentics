import { describe, expect, it } from "bun:test";
import {
  THRESHOLDS,
  baseline,
  detectConversionDrop,
  detectErrorSurge,
  detectOutage,
  detectTrafficDrop,
  detectTrafficSpike,
  hourFloor,
  hoursOf,
  lastDay,
  lastHours,
  median,
  seasonalWindows,
} from "../detect";

// Wednesday 14 Oct 2026, 14:15 UTC — the run judges the hour 13:00–14:00.
const NOW = new Date("2026-10-14T14:15:00Z");
const series = (observed: number, base: number[]) => ({ observed, baseline: base });

describe("windows", () => {
  it("judges whole UTC hours that have closed", () => {
    expect(hourFloor(NOW).toISOString()).toBe("2026-10-14T14:00:00.000Z");
    const w = lastHours(NOW, 3);
    expect([w.start.toISOString(), w.end.toISOString()]).toEqual(["2026-10-14T11:00:00.000Z", "2026-10-14T14:00:00.000Z"]);
    expect(hoursOf(lastHours(NOW, 2)).map((h) => h.start.toISOString())).toEqual(["2026-10-14T12:00:00.000Z", "2026-10-14T13:00:00.000Z"]);
  });

  it("compares with the same hours of the four previous weeks (same weekday, same time)", () => {
    const base = seasonalWindows(lastHours(NOW, 1));
    expect(base.map((w) => w.start.toISOString())).toEqual([
      "2026-10-07T13:00:00.000Z",
      "2026-09-30T13:00:00.000Z",
      "2026-09-23T13:00:00.000Z",
      "2026-09-16T13:00:00.000Z",
    ]);
    for (const w of base) expect(w.start.getUTCDay()).toBe(3);
  });

  it("checks conversions over yesterday", () => {
    const d = lastDay(NOW);
    expect([d.start.toISOString(), d.end.toISOString()]).toEqual(["2026-10-13T00:00:00.000Z", "2026-10-14T00:00:00.000Z"]);
  });
});

describe("robust baseline", () => {
  it("is the median, and one odd week does not move it", () => {
    expect(median([100, 110, 90, 105])).toBe(102.5);
    expect(baseline([100, 110, 90, 2_000]).median).toBe(105);
  });

  it("never measures in a spread narrower than Poisson noise or a tenth of the median", () => {
    expect(baseline([500, 500, 500, 500]).scale).toBe(50);
    expect(baseline([4, 4, 4, 4]).scale).toBe(2);
  });
});

describe("traffic drop", () => {
  const usual = { pageviews: [400, 420, 380, 410], visitors: [200, 210, 190, 205] };

  it("alerts on a large drop against the seasonal baseline, on the metric that fell harder", () => {
    const d = detectTrafficDrop({
      window: lastHours(NOW, 3),
      pageviews: series(150, usual.pageviews),
      visitors: series(40, usual.visitors),
      sensitivity: "normal",
    });
    expect(d.verdict).toBe("anomalous");
    expect(d.metric).toBe("visitors");
    expect(d.severity).toBe("high"); // 80% down
    expect(d.title).toBe("Visitors down 80% from usual");
    expect(d.summary).toBe("40 visitors between 11:00 and 14:00 UTC, against about 203 on a usual Wednesday at this time.");
  });

  it("is normal inside the band, and elevated (keeps open, opens nothing) between the bands", () => {
    const at = (pv: number, uv: number) =>
      detectTrafficDrop({ window: lastHours(NOW, 3), pageviews: series(pv, usual.pageviews), visitors: series(uv, usual.visitors), sensitivity: "normal" }).verdict;
    expect(at(390, 200)).toBe("normal");
    expect(at(260, 130)).toBe("elevated");
  });

  it("says nothing about a small site", () => {
    const d = detectTrafficDrop({ window: lastHours(NOW, 3), pageviews: series(0, [30, 25, 40, 35]), visitors: series(0, [12, 10, 15, 14]), sensitivity: "normal" });
    expect(d.verdict).toBe("insufficient");
  });

  it("uses the seasonal baseline: a quiet hour that is quiet every week is not a drop", () => {
    // Usually ~80 in this window (night time), the busy daytime numbers are irrelevant.
    const d = detectTrafficDrop({ window: lastHours(NOW, 3), pageviews: series(78, [80, 75, 85, 82]), visitors: series(40, [40, 38, 42, 41]), sensitivity: "normal" });
    expect(d.verdict).toBe("normal");
  });

  it("follows the sensitivity", () => {
    const run = (sensitivity: "low" | "normal" | "high") =>
      detectTrafficDrop({ window: lastHours(NOW, 3), pageviews: series(240, usual.pageviews), visitors: series(120, usual.visitors), sensitivity }).verdict;
    expect(run("high")).toBe("anomalous");
    expect(run("normal")).toBe("elevated");
    expect(run("low")).toBe("elevated");
  });
});

describe("traffic spike", () => {
  it("alerts on a large rise in the last hour", () => {
    const d = detectTrafficSpike({ window: lastHours(NOW, 1), pageviews: series(2_000, [180, 200, 220, 190]), visitors: series(300, [90, 100, 110, 95]), sensitivity: "normal" });
    expect(d.verdict).toBe("anomalous");
    expect(d.metric).toBe("pageviews");
    expect(d.severity).toBe("high"); // 10.3×
    expect(d.title).toBe("Pageviews up 10.3× on usual");
    expect(d.summary).toContain("in the hour to 14:00 UTC");
  });

  it("needs real volume: a tiny site going from 2 to 20 is not a spike", () => {
    const d = detectTrafficSpike({ window: lastHours(NOW, 1), pageviews: series(20, [2, 1, 3, 2]), visitors: series(10, [1, 1, 2, 1]), sensitivity: "high" });
    expect(d.verdict).not.toBe("anomalous");
  });

  it("is normal under the resolve band", () => {
    const d = detectTrafficSpike({ window: lastHours(NOW, 1), pageviews: series(220, [180, 200, 220, 190]), visitors: series(100, [90, 100, 110, 95]), sensitivity: "normal" });
    expect(d.verdict).toBe("normal");
  });
});

describe("tracking outage", () => {
  const hours = (obs: [number, number], base: [number[], number[]]) =>
    hoursOf(lastHours(NOW, 2)).map((w, i) => ({ window: w, observed: obs[i]!, baseline: base[i]! }));
  const busy: [number[], number[]] = [[300, 320, 280, 310], [310, 330, 290, 300]];

  it("is critical when pageviews stop where the baseline is healthy", () => {
    const d = detectOutage({ hours: hours([0, 0], busy), sensitivity: "normal" });
    expect(d.verdict).toBe("anomalous");
    expect(d.severity).toBe("critical");
    expect(d.title).toBe("Tracking may be down: no pageviews for 2 hours");
    expect(d.path).toBe("settings/tracking");
    expect(d.window.start.toISOString()).toBe("2026-10-14T12:00:00.000Z");
  });

  it("needs both hours near zero: one quiet hour is not an outage", () => {
    expect(detectOutage({ hours: hours([0, 150], busy), sensitivity: "normal" }).verdict).toBe("normal");
    expect(detectOutage({ hours: hours([150, 40], busy), sensitivity: "normal" }).verdict).toBe("elevated");
  });

  it("does not fire on a site that is quiet at this hour anyway", () => {
    expect(detectOutage({ hours: hours([0, 0], [[5, 3, 6, 4], [4, 5, 3, 6]]), sensitivity: "normal" }).verdict).toBe("insufficient");
  });

  it("recovers as soon as the latest hour has a fair share of its usual traffic, whatever the volume", () => {
    expect(detectOutage({ hours: hours([0, 2], [[5, 3, 6, 4], [4, 5, 3, 6]]), sensitivity: "normal" }).verdict).toBe("normal");
    expect(detectOutage({ hours: hours([0, 100], busy), sensitivity: "normal" }).verdict).toBe("normal");
  });
});

describe("error surge", () => {
  const err = (over: Partial<Parameters<typeof detectErrorSurge>[0]["series"]> = {}) => ({
    fingerprint: "abc123",
    message: "TypeError: cannot read properties of undefined (reading 'price') for jane@example.com",
    pagePath: "/checkout",
    firstSeen: "2026-10-14T13:05:00Z",
    observed: 180,
    sessions: 64,
    baseline: [0, 0, 0, 0],
    ...over,
  });

  it("flags a new error that clears the volume floors, with its message masked", () => {
    const d = detectErrorSurge({ window: lastHours(NOW, 1), series: err(), sensitivity: "normal", now: NOW });
    expect(d.verdict).toBe("anomalous");
    expect(d.subject).toBe("abc123");
    expect(d.severity).toBe("high");
    expect(d.title.startsWith("New error: TypeError")).toBe(true);
    expect(d.title).not.toContain("jane@example.com");
    expect(d.path).toBe("errors");
  });

  it("flags a growing error only well above its usual", () => {
    const growing = detectErrorSurge({ window: lastHours(NOW, 1), series: err({ firstSeen: "2026-01-01T00:00:00Z", baseline: [20, 25, 18, 22] }), sensitivity: "normal", now: NOW });
    expect(growing.verdict).toBe("anomalous");
    expect(growing.title.startsWith("Error surge:")).toBe(true);
    const usual = detectErrorSurge({ window: lastHours(NOW, 1), series: err({ firstSeen: "2026-01-01T00:00:00Z", observed: 30, baseline: [20, 25, 18, 22] }), sensitivity: "normal", now: NOW });
    expect(usual.verdict).toBe("normal");
  });

  it("ignores a handful of occurrences or a single unlucky visitor", () => {
    expect(detectErrorSurge({ window: lastHours(NOW, 1), series: err({ observed: 8, sessions: 2 }), sensitivity: "normal", now: NOW }).verdict).toBe("normal");
    expect(detectErrorSurge({ window: lastHours(NOW, 1), series: err({ observed: 400, sessions: 1 }), sensitivity: "normal", now: NOW }).verdict).toBe("insufficient");
  });
});

describe("conversion drop", () => {
  const goal = (observed: number, base: number[]) => ({ goalId: "g1", name: "Signup", observed, baseline: base });

  it("alerts when yesterday's completions fell well below the same weekday's", () => {
    const d = detectConversionDrop({ window: lastDay(NOW), series: goal(4, [40, 36, 44, 38]), sensitivity: "normal" });
    expect(d.verdict).toBe("anomalous");
    expect(d.severity).toBe("high");
    expect(d.subject).toBe("g1");
    expect(d.title).toBe('"Signup" conversions down 90% from usual');
    expect(d.summary).toBe('4 completions of "Signup" on Tue, Oct 13 (UTC), against about 39 on a usual Tuesday.');
  });

  it("needs a goal that usually converts", () => {
    expect(detectConversionDrop({ window: lastDay(NOW), series: goal(0, [3, 2, 4, 3]), sensitivity: "normal" }).verdict).toBe("insufficient");
  });

  it("thresholds tighten from low to high", () => {
    expect(THRESHOLDS.low.conversions.minExpected).toBeGreaterThan(THRESHOLDS.normal.conversions.minExpected);
    expect(THRESHOLDS.high.conversions.minExpected).toBeLessThan(THRESHOLDS.normal.conversions.minExpected);
  });
});
