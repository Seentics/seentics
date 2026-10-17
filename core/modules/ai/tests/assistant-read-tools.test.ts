import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { assistantReadTools } from "../tools/agent-tools";
import { ToolRegistry } from "../tools/registry";

const ctx = { websiteId: "site-1", userId: "u1" };

const registry = new ToolRegistry([
  {
    name: "get_top_pages",
    kind: "read",
    description: "Top pages",
    schema: z.object({ days: z.number().int().min(1).max(365).default(7) }),
    handler: async (a, c) => ({ ok: true, data: { data: { site: c.websiteId, days: a.days }, display: { kind: "table" } } }),
  },
  {
    name: "get_automation",
    kind: "read",
    description: "One automation",
    schema: z.object({}),
    handler: async () => ({ ok: true, data: { automation: { id: "a1" }, version: "v1" } }),
  },
  {
    name: "propose_goal",
    kind: "propose",
    description: "Draft a goal",
    schema: z.object({}),
    handler: async () => ({ ok: true, data: { proposal: {} } }),
  },
]);

describe("assistantReadTools", () => {
  const tools = assistantReadTools(registry);

  it("offers the read tools only, with their JSON Schemas", () => {
    expect(tools.list().map((t) => t.name)).toEqual(["get_top_pages", "get_automation"]);
    expect(tools.list()[0]!.parameters).toEqual({
      type: "object",
      properties: { days: { type: "number" } },
      required: [],
      additionalProperties: false,
    });
  });

  it("refuses a propose tool by name", async () => {
    expect(await tools.run("propose_goal", {}, ctx)).toEqual({ ok: false, error: "Unknown tool: propose_goal" });
  });

  it("drops the dashboard's display block and keeps any other shape whole", async () => {
    expect(await tools.run("get_top_pages", { days: 30 }, ctx)).toEqual({ ok: true, data: { site: "site-1", days: 30 } });
    expect(await tools.run("get_automation", {}, ctx)).toEqual({ ok: true, data: { automation: { id: "a1" }, version: "v1" } });
  });

  it("validates arguments against the tool's schema", async () => {
    const r = await tools.run("get_top_pages", { days: 0 }, ctx);
    expect(r.ok).toBe(false);
  });
});
