import { describe, expect, it } from "bun:test";
import { routingOfDefinition } from "../lib/form-routing";
import { redactDefinition, redactRewards } from "../lib/popup-rewards";
import { automationsUpsertBodySchema } from "../validators/automation.schema";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

const definition = (...actions: Record<string, unknown>[]) => ({
  graph: { entry: "n0", nodes: actions.map((action, i) => ({ id: `n${i}`, kind: "action", action })), edges: [] },
});

describe("routingOfDefinition", () => {
  it("reads the destinations the form names", () => {
    expect(routingOfDefinition(definition({ type: "show_modal", form: { destinations: [A, B] } }))).toEqual({ destinations: [A, B] });
  });

  it("keeps an empty list as a deliberate 'nowhere'", () => {
    expect(routingOfDefinition(definition({ type: "show_modal", form: { destinations: [] } }))).toEqual({ destinations: [] });
  });

  it("routes everywhere when the form names none, or there is no form", () => {
    expect(routingOfDefinition(definition({ type: "show_modal", form: { fields: [] } }))).toEqual({ destinations: null });
    expect(routingOfDefinition(definition({ type: "show_modal" }))).toEqual({ destinations: null });
    expect(routingOfDefinition(definition({ type: "redirect", url: "/x" }))).toEqual({ destinations: null });
    expect(routingOfDefinition({})).toEqual({ destinations: null });
  });

  it("uses the first form it finds, on a banner too", () => {
    expect(routingOfDefinition(definition({ type: "show_modal", title: "no form" }, { type: "show_banner", form: { destinations: [B] } }))).toEqual({ destinations: [B] });
  });

  it("ignores anything that is not a string id", () => {
    expect(routingOfDefinition(definition({ type: "show_modal", form: { destinations: [A, 7, null, { x: 1 }] } }))).toEqual({ destinations: [A] });
    expect(routingOfDefinition(definition({ type: "show_modal", form: { destinations: "all" } }))).toEqual({ destinations: null });
  });
});

describe("what the browser is sent", () => {
  it("never includes the form's destinations", () => {
    const action: Record<string, unknown> = { type: "show_modal", title: "Join", form: { submit_text: "Go", destinations: [A] } };
    expect(redactRewards(action)).toEqual({ type: "show_modal", title: "Join", form: { submit_text: "Go" } });
    expect(JSON.stringify(redactDefinition(definition(action)))).not.toContain(A);
  });

  it("strips them from a popup that also pays a reward, keeping the rest of the redaction", () => {
    const action = {
      type: "show_modal", layout: "spin_wheel", form: { destinations: [A] },
      wheel: { segments: [{ label: "10%", weight: 1, coupon_code: "SAVE10" }] },
    };
    const out = redactRewards(action) as any;
    expect(out.form).toEqual({});
    expect(out.wheel.segments[0].coupon_code).toBe("");
  });

  it("does not touch the stored action", () => {
    const action = { type: "show_modal", form: { destinations: [A] } };
    redactRewards(action);
    expect(action.form.destinations).toEqual([A]);
    expect(redactRewards(action)).not.toBe(action);
  });

  it("leaves actions without a form as they were", () => {
    const action = { type: "redirect", url: "/x" };
    expect(redactRewards(action)).toBe(action);
  });
});

describe("destinations in the form schema", () => {
  const withForm = (form: unknown) => ({
    name: "Newsletter popup",
    definition: { triggers: [{ type: "exit_intent" }], graph: { entry: "a", nodes: [{ id: "a", kind: "action", action: { type: "show_modal", title: "Join", form } }], edges: [] } },
  });
  const destinationsOf = (form: unknown) => {
    const parsed = automationsUpsertBodySchema.safeParse(withForm(form));
    return parsed.success ? (parsed.data.definition.graph.nodes[0] as any).action.form.destinations : "invalid";
  };

  it("accepts a list of ids, an empty list, or nothing", () => {
    expect(destinationsOf({ destinations: [A, B] })).toEqual([A, B]);
    expect(destinationsOf({ destinations: [] })).toEqual([]);
    expect(destinationsOf({})).toBeUndefined();
  });

  it("rejects ids that are not uuids and more than twenty", () => {
    expect(destinationsOf({ destinations: ["hubspot"] })).toBe("invalid");
    expect(destinationsOf({ destinations: Array.from({ length: 21 }, () => A) })).toBe("invalid");
  });
});
