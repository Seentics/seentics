import { describe, expect, it } from "bun:test";
import { automationsUpsertBodySchema } from "../validators/automation.schema";

const body = (action: Record<string, unknown>) => ({
  name: "Popup",
  definition: {
    triggers: [{ type: "exit_intent" }],
    graph: { entry: "a", nodes: [{ id: "a", kind: "action", action }], edges: [] },
  },
});
const ok = (action: Record<string, unknown>) => automationsUpsertBodySchema.safeParse(body(action));

const form = { fields: [] };
const wheel = { segments: [{ label: "10% off", weight: 1, coupon_code: "SAVE10" }, { label: "Try again", weight: 3 }] };
const steps = [{ name: "goal", title: "What brings you here?", options: [{ label: "Sales", value: "sales" }, { label: "Support", value: "support" }] }];

describe("spin wheel", () => {
  it("accepts a wheel with a form and fills defaults", () => {
    const r = ok({ type: "show_modal", layout: "spin_wheel", wheel, form });
    expect(r.success).toBe(true);
    if (!r.success) return;
    const a = (r.data.definition.graph.nodes[0] as any).action;
    expect(a.wheel.spin_text).toBe("Spin to win");
    expect(a.wheel.segments[1]).toMatchObject({ weight: 3, coupon_code: "" });
  });

  it("needs the slices and the email form", () => {
    expect(ok({ type: "show_modal", layout: "spin_wheel", form }).success).toBe(false);
    expect(ok({ type: "show_modal", layout: "spin_wheel", wheel }).success).toBe(false);
  });

  it("rejects too few or too many slices and a wheel nothing can win", () => {
    expect(ok({ type: "show_modal", layout: "spin_wheel", form, wheel: { segments: [{ label: "x" }] } }).success).toBe(false);
    const many = Array.from({ length: 13 }, (_, i) => ({ label: `s${i}` }));
    expect(ok({ type: "show_modal", layout: "spin_wheel", form, wheel: { segments: many } }).success).toBe(false);
    const dead = { segments: [{ label: "a", weight: 0 }, { label: "b", weight: 0 }] };
    expect(ok({ type: "show_modal", layout: "spin_wheel", form, wheel: dead }).success).toBe(false);
  });

  it("restricts coupon codes to checkout-safe characters", () => {
    const bad = { segments: [{ label: "a", coupon_code: "<script>" }, { label: "b" }] };
    expect(ok({ type: "show_modal", layout: "spin_wheel", form, wheel: bad }).success).toBe(false);
  });

  it("only applies to modals", () => {
    expect(ok({ type: "show_banner", layout: "spin_wheel", wheel, form }).success).toBe(false);
  });

  it("tolerates a leftover wheel under another layout", () => {
    expect(ok({ type: "show_modal", layout: "modal", wheel }).success).toBe(true);
  });
});

describe("multi-step", () => {
  it("accepts questions with a form", () => {
    expect(ok({ type: "show_modal", layout: "multi_step", steps, form }).success).toBe(true);
  });
  it("needs steps and a form", () => {
    expect(ok({ type: "show_modal", layout: "multi_step", form }).success).toBe(false);
    expect(ok({ type: "show_modal", layout: "multi_step", steps }).success).toBe(false);
  });
  it("rejects a step with one option, duplicate names or more than five steps", () => {
    expect(ok({ type: "show_modal", layout: "multi_step", form, steps: [{ ...steps[0], options: [steps[0]!.options[0]] }] }).success).toBe(false);
    expect(ok({ type: "show_modal", layout: "multi_step", form, steps: [steps[0], steps[0]] }).success).toBe(false);
    const six = Array.from({ length: 6 }, (_, i) => ({ ...steps[0], name: `q${i}` }));
    expect(ok({ type: "show_modal", layout: "multi_step", form, steps: six }).success).toBe(false);
  });
});

describe("countdown", () => {
  it("accepts evergreen and fixed timers on a modal or a banner", () => {
    expect(ok({ type: "show_banner", message: "Sale", countdown: { mode: "evergreen", duration_minutes: 15 } }).success).toBe(true);
    expect(ok({ type: "show_modal", layout: "countdown", countdown: { mode: "fixed", ends_at: "2030-01-01T00:00:00Z" } }).success).toBe(true);
  });
  it("needs an end date when fixed, and a countdown for the countdown layout", () => {
    expect(ok({ type: "show_banner", countdown: { mode: "fixed" } }).success).toBe(false);
    expect(ok({ type: "show_modal", layout: "countdown" }).success).toBe(false);
    expect(ok({ type: "show_banner", countdown: { mode: "fixed", ends_at: "tomorrow" } }).success).toBe(false);
  });
  it("is not available on a toast", () => {
    expect(ok({ type: "show_toast", countdown: { mode: "evergreen" } }).success).toBe(false);
  });
});

describe("teaser, coupon and sticky bar", () => {
  it("accepts a teaser on a modal only", () => {
    expect(ok({ type: "show_modal", teaser: { label: "10% off" } }).success).toBe(true);
    expect(ok({ type: "show_banner", teaser: { label: "10% off" } }).success).toBe(false);
  });
  it("accepts a coupon, but not an empty code", () => {
    expect(ok({ type: "show_modal", form, coupon: { code: "WELCOME10" } }).success).toBe(true);
    expect(ok({ type: "show_modal", form, coupon: { code: "" } }).success).toBe(false);
  });
  it("lets a banner carry an email form (sticky bar)", () => {
    expect(ok({ type: "show_banner", message: "Join", position: "bottom", form }).success).toBe(true);
  });
});
