import { describe, expect, it } from "bun:test";
import {
  baseline, clock, count, formatDelta, median, percentOf, plural, rateText, relativeChange, signedPercent, span, twoProportionZ, zScore,
} from "..";

describe("stats", () => {
  it("takes a median that one odd reading does not move", () => {
    expect(median([])).toBe(0);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([10, 10, 10, 900])).toBe(10);
  });

  it("scores a reading against a robust baseline, with a noise floor for small and flat counts", () => {
    const flat = baseline([100, 100, 100, 100]);
    expect(flat.scale).toBe(10);
    expect(zScore(70, flat)).toBe(-3);
    expect(baseline([1, 0, 2]).scale).toBeCloseTo(1.4826, 4);
  });

  it("says whether a rate changed beyond chance", () => {
    expect(twoProportionZ(50, 1000, 80, 1000)).toBeGreaterThan(2);
    expect(Math.abs(twoProportionZ(50, 1000, 52, 1000)!)).toBeLessThan(1);
    expect(twoProportionZ(0, 0, 5, 10)).toBeNull();
  });

  it("measures change and shares, and refuses to divide by nothing", () => {
    expect(relativeChange({ cur: 125, prev: 100 })).toBe(0.25);
    expect(relativeChange({ cur: 5, prev: 0 })).toBeNull();
    expect(percentOf(1, 3)).toBe(33.3);
    expect(percentOf(1, 0)).toBeNull();
  });
});

describe("format", () => {
  it("writes numbers, changes and times the same way everywhere", () => {
    expect(count(4300.4)).toBe("4,300");
    expect(signedPercent(-0.16)).toBe("-16%");
    expect(rateText(4.23)).toBe("4.2%");
    expect(formatDelta(-6)).toBe("−6 pts");
    expect(formatDelta(1.5)).toBe("+1.5 pts");
    expect(span(252_000)).toBe("4m 12s");
    expect(clock(3_725_000)).toBe("1:02:05");
    expect(plural(1, "field")).toBe("1 field");
    expect(plural(3, "field")).toBe("3 fields");
  });
});
