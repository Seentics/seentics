import { describe, expect, it } from "bun:test";
import { toProgressStep } from "../lib/funnel-step-definition";
import { MAX_WINDOW_HOURS, validateFunnelDefinition, FunnelValidationError } from "../lib/funnel-validation";

const valid = async (pattern: string) => !pattern.includes("(?<") && !pattern.startsWith("(unclosed");
const page = (over: Record<string, unknown> = {}) => ({ name: "Step", step_type: "page_view", page_path: "/x", match_type: "exact", ...over });

describe("validateFunnelDefinition", () => {
  it("accepts an ordinary funnel, with or without a window", async () => {
    expect(await validateFunnelDefinition({ steps: [page(), page({ page_path: "/y" })] }, valid)).toEqual([]);
    expect(await validateFunnelDefinition({ steps: [page()], conversion_window_hours: 24 }, valid)).toEqual([]);
    expect(await validateFunnelDefinition({ steps: [page()], conversion_window_hours: null }, valid)).toEqual([]);
  });

  it("refuses a window that is not a whole number of hours from 1 to 30 days", async () => {
    for (const bad of [0, -1, 1.5, MAX_WINDOW_HOURS + 1, "24", NaN]) {
      const issues = await validateFunnelDefinition({ conversion_window_hours: bad }, valid);
      expect(issues, String(bad)).toHaveLength(1);
      expect(issues[0]).toContain("from 1 to 720");
    }
    expect(await validateFunnelDefinition({ conversion_window_hours: MAX_WINDOW_HOURS }, valid)).toEqual([]);
  });

  it("names the step whose regular expression the database cannot read", async () => {
    const issues = await validateFunnelDefinition({ steps: [page(), page({ name: "Checkout", page_path: "(unclosed", match_type: "regex" })] }, valid);
    expect(issues).toEqual(['Checkout: "(unclosed" is not a valid regular expression.']);
  });

  it("refuses a pattern that is fine in a browser and not in the database", async () => {
    const issues = await validateFunnelDefinition({ steps: [page({ page_path: "/(?<id>[0-9]+)", match_type: "regex" })] }, valid);
    expect(issues).toHaveLength(1);
  });

  it("does not ask the database about steps that are not patterns", async () => {
    let asked = 0;
    const counting = async () => { asked++; return true; };
    await validateFunnelDefinition({ steps: [page(), page({ match_type: "contains" }), { name: "E", step_type: "event", event_type: "buy", match_type: "regex" }] }, counting);
    expect(asked).toBe(0);
  });

  it("refuses too many steps and an over-long pattern", async () => {
    const many = Array.from({ length: 21 }, (_, i) => page({ page_path: `/p${i}` }));
    expect((await validateFunnelDefinition({ steps: many }, valid))[0]).toContain("at most 20");
    const long = page({ page_path: "a".repeat(501), match_type: "regex" });
    expect((await validateFunnelDefinition({ steps: [long] }, valid))[0]).toContain("at most 500");
  });

  it("carries the messages on the error", () => {
    const error = new FunnelValidationError(["one", "two"]);
    expect(error.issues).toEqual(["one", "two"]);
    expect(error.message).toBe("one");
  });
});

// A step saved with a number where text belongs used to be accepted, then broke the stats of
// every funnel on the site (500 on /funnels/stats) because the report called .trim() on it.
describe("funnel steps must hold text", () => {
  const ok = async () => true;
  it("refuses a non-string path or event name", async () => {
    expect(await validateFunnelDefinition({ steps: [{ step_type: "page_view", page_path: 5 }] }, ok)).toHaveLength(1);
    expect(await validateFunnelDefinition({ steps: [{ step_type: "event", event_type: { x: 1 } }] }, ok)).toHaveLength(1);
  });
  it("refuses steps that are not a list of objects, and a non-text name", async () => {
    expect(await validateFunnelDefinition({ steps: {} }, ok)).toEqual(["Steps must be a list of steps."]);
    expect(await validateFunnelDefinition({ steps: [null] }, ok)).toEqual(["Steps must be a list of steps."]);
    expect(await validateFunnelDefinition({ name: 42 }, ok)).toHaveLength(1);
  });
  it("still accepts ordinary steps", async () => {
    expect(await validateFunnelDefinition({ name: "Checkout", steps: [{ step_type: "page_view", page_path: "/cart" }, { step_type: "event", event_type: "purchase" }] }, ok)).toEqual([]);
  });
  it("reads an already-stored bad step as unreachable instead of throwing", () => {
    expect(toProgressStep({ step_type: "page_view", page_path: 5 } as never)).toBeNull();
    expect(toProgressStep({ step_type: "event", event_type: 7 } as never)).toBeNull();
  });
});
