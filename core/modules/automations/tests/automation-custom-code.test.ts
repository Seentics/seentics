import { describe, expect, it } from "bun:test";
import { renderTemplate, renderTemplateDeep } from "../lib/automation-template-renderer";
import { automationsUpsertBodySchema } from "../validators/automation.schema";

const context = { url: 'https://evil.example/?q="><img src=x onerror=alert(1)>', user: { name: "Ada" } };

describe("custom code in automation actions", () => {
  it("escapes visitor data interpolated into custom markup", () => {
    const out = renderTemplateDeep({ type: "show_modal", custom_html: "<h1>Hi {{ user.name }}</h1><a href=\"{{ url }}\">x</a>" }, context) as { custom_html: string };
    expect(out.custom_html).toContain("<h1>Hi Ada</h1>");
    expect(out.custom_html).not.toContain("<img");
    expect(out.custom_html).toContain("&lt;img");
    expect(out.custom_html).toContain("&quot;");
  });

  it("leaves the author's own style and script exactly as written, never interpolating them", () => {
    const out = renderTemplateDeep({ type: "show_toast", custom_css: ".a{content:'{{ user.name }}'}", custom_js: "root.title = '{{ url }}'" }, context) as Record<string, string>;
    expect(out.custom_css).toBe(".a{content:'{{ user.name }}'}");
    expect(out.custom_js).toBe("root.title = '{{ url }}'");
  });

  it("still interpolates ordinary text fields as before", () => {
    expect(renderTemplate("Hello {{ user.name }}", context)).toBe("Hello Ada");
    const out = renderTemplateDeep({ message: "Hi {{ user.name | uppercase }}" }, context) as { message: string };
    expect(out.message).toBe("Hi ADA");
  });

  const definition = (action: Record<string, unknown>) => ({
    name: "Custom",
    definition: {
      triggers: [{ type: "page_view" }],
      graph: { entry: "a", nodes: [{ id: "a", kind: "action", action }], edges: [] },
    },
  });

  it("accepts custom code on a modal, toast, banner and tooltip", () => {
    for (const type of ["show_modal", "show_toast", "show_banner", "show_tooltip"]) {
      const parsed = automationsUpsertBodySchema.safeParse(definition({ type, selector: "#x", custom_html: "<b>x</b>", custom_css: ".a{}", custom_js: "root.dataset.x=1" }));
      expect(parsed.success, type).toBe(true);
    }
  });

  it("refuses custom code over the size limit", () => {
    const parsed = automationsUpsertBodySchema.safeParse(definition({ type: "show_modal", custom_html: "x".repeat(20_001) }));
    expect(parsed.success).toBe(false);
  });
});

describe("frequency caps in a definition", () => {
  const withFrequency = (frequency: Record<string, unknown>) => ({
    name: "Capped",
    definition: {
      triggers: [{ type: "page_view" }],
      graph: { entry: "a", nodes: [{ id: "a", kind: "action", action: { type: "show_toast", message: "x" } }], edges: [] },
      frequency,
    },
  });

  it("refuses a cap of zero per session or per visitor, with a message that says what to do", () => {
    for (const key of ["maxPerSession", "maxPerUser"]) {
      const parsed = automationsUpsertBodySchema.safeParse(withFrequency({ [key]: 0 }));
      expect(parsed.success, key).toBe(false);
      if (!parsed.success) expect(parsed.error.issues[0]!.message).toContain("at least 1");
    }
  });

  it("accepts real caps, and zero days of cooldown as no cooldown", () => {
    expect(automationsUpsertBodySchema.safeParse(withFrequency({ maxPerSession: 1, maxPerUser: 3, cooldownDays: 7 })).success).toBe(true);
    expect(automationsUpsertBodySchema.safeParse(withFrequency({ cooldownDays: 0 })).success).toBe(true);
  });
});
