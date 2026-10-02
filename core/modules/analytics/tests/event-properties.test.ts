import { describe, expect, it, mock } from "bun:test";
import { fakeDbModule, fakeLogger } from "./helpers/fake-db";

mock.module("../../../db", fakeDbModule);
mock.module("../../../platform/observability/logger", fakeLogger);

const { groupEventProperties } = await import("../repositories/custom-events.repository");

/**
 * Event property breakdowns from the `event_prop` rollup, whose value is
 * "<event type>\x1f<key>\x1f<value>" and whose count is summed over the window's days.
 */
const row = (event: string, key: string, value: string, views: number) => ({ k: `${event}\x1f${key}\x1f${value}`, views });

describe("groupEventProperties", () => {
  it("nests event → property → value → count, summing repeated values", () => {
    const out = groupEventProperties([
      row("signup", "plan", "pro", 5),
      row("signup", "plan", "free", 9),
      row("signup", "plan", "pro", 2),
      row("download", "file", "guide.pdf", 3),
    ]);
    expect(out.get("signup")).toEqual({ plan: { free: 9, pro: 7 } });
    expect(out.get("download")).toEqual({ file: { "guide.pdf": 3 } });
  });

  it("keeps each property's eight most frequent values", () => {
    const rows = Array.from({ length: 12 }, (_, i) => row("click", "label", `v${i}`, i + 1));
    const values = groupEventProperties(rows).get("click")!.label!;
    expect(Object.keys(values)).toHaveLength(8);
    expect(values.v11).toBe(12);
    expect(values.v0).toBeUndefined();
  });

  it("keeps each event's ten properties with the most occurrences", () => {
    const rows = Array.from({ length: 14 }, (_, i) => row("click", `k${i}`, "x", i + 1));
    const keys = Object.keys(groupEventProperties(rows).get("click")!);
    expect(keys).toHaveLength(10);
    expect(keys).toContain("k13");
    expect(keys).not.toContain("k0");
  });

  it("skips a malformed value instead of failing", () => {
    expect(groupEventProperties([{ k: "no-separators", views: 3 }]).size).toBe(0);
  });
});
