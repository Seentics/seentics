import { describe, expect, it } from "bun:test";
import { triggerConfigMatches } from "../services/automation-evaluation.service";
import { automationsUpsertBodySchema } from "../validators/automation.schema";

const event = (over: Record<string, unknown> = {}) => ({ type: "funnel", funnel_id: "f1", event: "step", step: 2, step_name: "Pricing", steps_total: 4, ...over });

describe("funnel trigger matching", () => {
  it("matches any funnel event when nothing is configured", () => {
    for (const e of ["entry", "step", "dropoff", "complete"]) expect(triggerConfigMatches({ type: "funnel" }, event({ event: e }))).toBe(true);
  });

  it("matches only the funnel it names", () => {
    expect(triggerConfigMatches({ type: "funnel", funnel_id: "f1" }, event())).toBe(true);
    expect(triggerConfigMatches({ type: "funnel", funnel_id: "f2" }, event())).toBe(false);
  });

  it("matches only the kind of event it names", () => {
    expect(triggerConfigMatches({ type: "funnel", event: "complete" }, event({ event: "complete" }))).toBe(true);
    expect(triggerConfigMatches({ type: "funnel", event: "complete" }, event({ event: "dropoff" }))).toBe(false);
    expect(triggerConfigMatches({ type: "funnel", event: "entry" }, event({ event: "step" }))).toBe(false);
  });

  it("matches a particular step, as a number or a numeric string", () => {
    expect(triggerConfigMatches({ type: "funnel", event: "dropoff", step: 2 }, event({ event: "dropoff" }))).toBe(true);
    expect(triggerConfigMatches({ type: "funnel", event: "dropoff", step: "2" }, event({ event: "dropoff" }))).toBe(true);
    expect(triggerConfigMatches({ type: "funnel", event: "dropoff", step: 3 }, event({ event: "dropoff" }))).toBe(false);
  });

  it("combines the three", () => {
    const t = { type: "funnel", funnel_id: "f1", event: "dropoff", step: 2 };
    expect(triggerConfigMatches(t, event({ event: "dropoff" }))).toBe(true);
    expect(triggerConfigMatches(t, event({ event: "dropoff", funnel_id: "f9" }))).toBe(false);
    expect(triggerConfigMatches(t, event({ event: "dropoff", step: 1 }))).toBe(false);
  });
});

describe("funnel drop-off by stalling or leaving", () => {
  const dropoff = (over: Record<string, unknown> = {}) => event({ event: "dropoff", reason: "inactive", seconds: 60, ...over });

  it("takes the idle threshold it names, and ignores the others", () => {
    const t = { type: "funnel", event: "dropoff", seconds: 60 };
    expect(triggerConfigMatches(t, dropoff())).toBe(true);
    expect(triggerConfigMatches(t, dropoff({ seconds: 30 }))).toBe(false);
  });

  it("takes any idle threshold when it names none", () => {
    expect(triggerConfigMatches({ type: "funnel", event: "dropoff" }, dropoff({ seconds: 30 }))).toBe(true);
  });

  it("is not held to the idle threshold when the visitor is leaving", () => {
    const t = { type: "funnel", event: "dropoff", seconds: 60 };
    expect(triggerConfigMatches(t, event({ event: "dropoff", reason: "exit_intent" }))).toBe(true);
  });
});

describe("funnel trigger in a saved definition", () => {
  it("is accepted", () => {
    const parsed = automationsUpsertBodySchema.safeParse({
      name: "Funnel",
      definition: {
        triggers: [{ type: "funnel", funnel_id: "f1", event: "dropoff", step: 2, seconds: 60 }],
        graph: { entry: "a", nodes: [{ id: "a", kind: "action", action: { type: "show_toast", message: "Need help?" } }], edges: [] },
      },
    });
    expect(parsed.success).toBe(true);
  });
});

describe("goal trigger matching", () => {
  const reached = (over: Record<string, unknown> = {}) => ({ type: "goal_reached", goal_id: "g1", goal_name: "Signed up", ...over });

  it("takes any goal when none is named", () => {
    expect(triggerConfigMatches({ type: "goal_reached" }, reached())).toBe(true);
  });

  it("takes only the goal it names", () => {
    expect(triggerConfigMatches({ type: "goal_reached", goal_id: "g1" }, reached())).toBe(true);
    expect(triggerConfigMatches({ type: "goal_reached", goal_id: "g2" }, reached())).toBe(false);
  });
});
