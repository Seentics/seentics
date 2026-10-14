import { z } from "zod";
import type { FunnelDraftPatch, FunnelDraftPort, FunnelSnapshot } from "../../funnels/interfaces";
import { buildSteps } from "./propose-funnel.tool";
import { UUID, diffFields, diffLines, drafted, proposal, refuse } from "./proposal-policy";
import type { AiTool, ToolResult } from "./tool.types";

/**
 * `get_funnel`, `propose_funnel_update` and `propose_funnel_status`.
 *
 * Steps are written flat (name, page or event, value, match), as in `propose_funnel`, and stored
 * in the funnel's JSONB shape by `buildSteps`. A change is checked by the funnels module as the
 * whole funnel it produces, with the checks the save endpoint runs.
 */

/** One stored step as a line: "Pricing (page is /pricing)". Exported for tests. */
export function stepLine(s: Record<string, unknown>): string {
  const name = String(s.name ?? "").trim() || "Step";
  if (s.step_type === "event") return `${name} (event "${String(s.event_type ?? "")}")`;
  const match = String(s.match_type ?? "exact");
  const how = match === "contains" ? "contains" : match === "starts_with" ? "starts with" : match === "regex" ? "matches" : "is";
  return `${name} (page ${how} ${String(s.page_path ?? "")})`;
}

/** Stored steps in the flat shape the tools take, so the model can send them back edited. */
function flatSteps(steps: Record<string, unknown>[]) {
  return steps.map((s) =>
    s.step_type === "event"
      ? { name: s.name, type: "event", value: s.event_type }
      : { name: s.name, type: "page", value: s.page_path, match: s.match_type ?? "exact" });
}

const windowText = (h: number | null | undefined) => (h ? `${h} hours` : "no limit");

const stepSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.enum(["page", "event"]),
  value: z.string().trim().min(1).max(500).describe("Page path or custom event name"),
  match: z.enum(["exact", "contains", "starts_with"]).optional(),
});

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  steps: z.array(stepSchema).min(2).max(20).optional().describe("Replaces all steps, in order. Send every step, changed or not"),
  conversionWindowHours: z.number().int().min(0).max(720).optional().describe("Hours allowed between steps; 0 removes the limit"),
});

type UpdateArgs = { funnelId: string; patch: z.infer<typeof patchSchema> };

export function funnelEditTools(drafts: FunnelDraftPort): AiTool<any>[] {
  const load = async (websiteId: string, id: string): Promise<FunnelSnapshot | string> => {
    if (!UUID.test(id)) return "Not a funnel id. Call list_funnels to find it.";
    return (await drafts.get(websiteId, id)) ?? "No funnel with that id on this website. Call list_funnels.";
  };

  const getTool: AiTool<{ funnelId: string }> = {
    name: "get_funnel",
    kind: "read",
    description: "One funnel's definition: name, whether it is active, its steps (page or event, value, match) and time window. Call before drafting a change to it.",
    schema: z.object({ funnelId: z.string().trim().min(1).max(64).describe("Funnel id from list_funnels") }),
    async handler(args, ctx): Promise<ToolResult> {
      const f = await load(ctx.websiteId, args.funnelId);
      if (typeof f === "string") return refuse(f);
      return {
        ok: true,
        data: { data: { id: f.id, name: f.name, description: f.description, active: f.isActive, steps: flatSteps(f.steps), conversion_window_hours: f.conversion_window_hours } },
      };
    },
  };

  const updateTool: AiTool<UpdateArgs> = {
    name: "propose_funnel_update",
    kind: "propose",
    description:
      "Draft a change to an existing funnel — its name, steps or match rules, or time window — for the user to " +
      "review and confirm. Changes nothing until confirmed. Call get_funnel first; change as little as needed.",
    schema: z.object({ funnelId: z.string().trim().min(1).max(64), patch: patchSchema }) as unknown as z.ZodType<UpdateArgs>,
    async handler(args, ctx): Promise<ToolResult> {
      const f = await load(ctx.websiteId, args.funnelId);
      if (typeof f === "string") return refuse(f);
      const p = args.patch;
      const patch: FunnelDraftPatch = {};
      if (p.name !== undefined) patch.name = p.name;
      if (p.description !== undefined) patch.description = p.description;
      if (p.steps) patch.steps = buildSteps({ name: p.name ?? f.name, steps: p.steps });
      if (p.conversionWindowHours !== undefined) patch.conversion_window_hours = p.conversionWindowHours === 0 ? null : p.conversionWindowHours;

      const checked = await drafts.validatePatch(f, patch);
      if (!checked.ok) return refuse(`That change is not valid: ${checked.error}`);

      const diff = diffFields(
        [["name", "Name"], ["description", "Description"], ["steps", "Steps"], ["window", "Time between steps"]],
        { name: f.name, description: f.description, steps: f.steps.map(stepLine), window: windowText(f.conversion_window_hours) },
        {
          ...(checked.patch.name !== undefined ? { name: checked.patch.name } : {}),
          ...(checked.patch.description !== undefined ? { description: checked.patch.description } : {}),
          ...(checked.patch.steps ? { steps: checked.patch.steps.map(stepLine) } : {}),
          ...(checked.patch.conversion_window_hours !== undefined ? { window: windowText(checked.patch.conversion_window_hours) } : {}),
        },
      );
      if (!diff.length) return refuse("That is how the funnel already is. Nothing to change.");

      return drafted(proposal({
        resource: "funnel",
        operation: "update",
        target: { id: f.id, version: f.version },
        payload: checked.patch,
        diff,
        summary: {
          title: `Change the "${f.name}" funnel`,
          lines: [...diffLines(diff), "Its report is recounted from your page views and events with the new definition."],
          hasExternalEffect: false,
        },
      }));
    },
  };

  const statusTool: AiTool<{ funnelId: string; active: boolean }> = {
    name: "propose_funnel_status",
    kind: "propose",
    description: "Draft switching an existing funnel on or off, for the user to confirm. Switching off never deletes it.",
    schema: z.object({ funnelId: z.string().trim().min(1).max(64), active: z.boolean() }),
    async handler(args, ctx): Promise<ToolResult> {
      const f = await load(ctx.websiteId, args.funnelId);
      if (typeof f === "string") return refuse(f);
      if (f.isActive === args.active) return refuse(`"${f.name}" is already ${f.isActive ? "active" : "inactive"}.`);
      return drafted(proposal({
        resource: "funnel",
        operation: "set_status",
        target: { id: f.id, version: f.version },
        payload: { active: args.active },
        diff: [{ field: "active", label: "Status", before: f.isActive ? "active" : "inactive", after: args.active ? "active" : "inactive" }],
        summary: {
          title: `${args.active ? "Activate" : "Deactivate"} the "${f.name}" funnel`,
          lines: f.steps.map((s, i) => `Step ${i + 1}: ${stepLine(s)}`),
          hasExternalEffect: false,
          risks: args.active ? [] : [{ kind: "stops", message: "The tracker stops evaluating it. It is kept, and can be switched back on." }],
        },
      }));
    },
  };

  return [getTool, updateTool, statusTool];
}
