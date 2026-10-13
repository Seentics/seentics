import { describe, expect, it } from "bun:test";
import { extractRewards, redactDefinition, redactRewards, rewardsOfDefinition } from "../lib/popup-rewards";

const wheelAction = {
  type: "show_modal",
  layout: "spin_wheel",
  form: { fields: [] },
  wheel: { segments: [{ label: "10% off", weight: 2, coupon_code: "SAVE10", color: "#fff" }, { label: "Try again", weight: 1, coupon_code: "" }] },
};

describe("extractRewards", () => {
  it("reads the wheel of a spin-wheel modal", () => {
    expect(extractRewards(wheelAction)).toEqual({
      wheel: [{ label: "10% off", weight: 2, coupon_code: "SAVE10" }, { label: "Try again", weight: 1, coupon_code: "" }],
      coupon: null,
    });
  });

  it("ignores a wheel left over under another layout", () => {
    expect(extractRewards({ ...wheelAction, layout: "modal" })).toBeNull();
  });

  it("treats a coupon behind a form as a reward, and a bare coupon as plain content", () => {
    expect(extractRewards({ type: "show_banner", form: {}, coupon: { code: "HI", description: "d" } })).toEqual({ wheel: null, coupon: { code: "HI", description: "d" } });
    expect(extractRewards({ type: "show_modal", coupon: { code: "HI" } })).toBeNull();
  });

  it("has nothing for other actions", () => {
    expect(extractRewards({ type: "show_toast", coupon: { code: "x" }, form: {} })).toBeNull();
  });
});

describe("redaction", () => {
  it("removes every coupon code but keeps what the wheel needs to be drawn", () => {
    const out = redactRewards(wheelAction) as any;
    expect(out.wheel.segments.map((s: any) => s.coupon_code)).toEqual(["", ""]);
    expect(out.wheel.segments[0]).toMatchObject({ label: "10% off", weight: 2, color: "#fff" });
    // The original is untouched: the dashboard keeps reading the full definition.
    expect(wheelAction.wheel.segments[0]!.coupon_code).toBe("SAVE10");
  });

  it("blanks a gated coupon but leaves a bare one visible", () => {
    expect((redactRewards({ type: "show_modal", form: {}, coupon: { code: "HI", description: "d" } }) as any).coupon).toEqual({ code: "", description: "d" });
    const bare = { type: "show_modal", coupon: { code: "HI" } };
    expect(redactRewards(bare)).toBe(bare);
  });

  it("redacts a whole definition and finds its rewards before that", () => {
    const definition = { triggers: [], graph: { entry: "a", nodes: [{ id: "a", kind: "action", action: wheelAction }, { id: "b", kind: "delay", seconds: 1 }], edges: [] } };
    expect(rewardsOfDefinition(definition)?.wheel).toHaveLength(2);
    const redacted = JSON.stringify(redactDefinition(definition));
    expect(redacted).not.toContain("SAVE10");
    expect(redacted).toContain("10% off");
    expect(JSON.stringify(definition)).toContain("SAVE10");
  });
});
