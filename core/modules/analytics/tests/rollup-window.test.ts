import { describe, expect, it } from "bun:test";

process.env.DATABASE_URL ??= "postgres://test-not-connected";

const { rollupWindow } = await import("../rollups/reads");

/**
 * Rollup reads cover calendar days (UTC): "last N days" is today plus the N−1 days
 * before it, and the comparison period is the N days immediately before that. Every
 * rollup-backed endpoint uses this one window, so they always agree with each other.
 */
describe("rollupWindow", () => {
  const noon = Date.parse("2026-09-27T12:34:56Z");

  it("covers today plus the previous N−1 days", () => {
    expect(rollupWindow(7, noon)).toMatchObject({ from: "2026-09-21", to: "2026-09-27" });
    expect(rollupWindow(1, noon)).toMatchObject({ from: "2026-09-27", to: "2026-09-27" });
  });

  it("compares against the N days immediately before, with no gap or overlap", () => {
    expect(rollupWindow(7, noon)).toMatchObject({ prevFrom: "2026-09-14", prevTo: "2026-09-20" });
    expect(rollupWindow(30, noon)).toMatchObject({ from: "2026-08-29", prevTo: "2026-08-28" });
  });

  it("uses the UTC date just after midnight and just before it", () => {
    expect(rollupWindow(1, Date.parse("2026-09-27T00:00:01Z")).to).toBe("2026-09-27");
    expect(rollupWindow(1, Date.parse("2026-09-27T23:59:59Z")).to).toBe("2026-09-27");
  });
});
