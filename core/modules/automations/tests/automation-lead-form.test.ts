import { describe, expect, it } from "bun:test";
import { automationsUpsertBodySchema } from "../validators/automation.schema";

const withForm = (form: unknown) => ({
  name: "Newsletter popup",
  definition: {
    triggers: [{ type: "exit_intent" }],
    graph: { entry: "a", nodes: [{ id: "a", kind: "action", action: { type: "show_modal", title: "Join", form } }], edges: [] },
  },
});

describe("lead form on a modal action", () => {
  it("accepts a form and fills the defaults", () => {
    const parsed = automationsUpsertBodySchema.safeParse(withForm({ fields: [{ name: "name", label: "Name" }] }));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const action = (parsed.data.definition.graph.nodes[0] as any).action;
    expect(action.form.submit_text).toBe("Subscribe");
    expect(action.form.consent_required).toBe(true);
    expect(action.form.fields[0]).toMatchObject({ name: "name", type: "text", required: false });
  });

  it("rejects malformed field names, types and too many fields", () => {
    expect(automationsUpsertBodySchema.safeParse(withForm({ fields: [{ name: "bad key" }] })).success).toBe(false);
    expect(automationsUpsertBodySchema.safeParse(withForm({ fields: [{ name: "x", type: "file" }] })).success).toBe(false);
    const many = Array.from({ length: 8 }, (_, i) => ({ name: `f${i}` }));
    expect(automationsUpsertBodySchema.safeParse(withForm({ fields: many })).success).toBe(false);
  });

  it("only allows http(s) or site-relative success redirects", () => {
    for (const url of ["https://example.com/thanks", "/thanks"]) {
      expect(automationsUpsertBodySchema.safeParse(withForm({ success_redirect_url: url })).success, url).toBe(true);
    }
    for (const url of ["javascript:alert(1)", "//evil.test", "data:text/html,x"]) {
      expect(automationsUpsertBodySchema.safeParse(withForm({ success_redirect_url: url })).success, url).toBe(false);
    }
  });
});
