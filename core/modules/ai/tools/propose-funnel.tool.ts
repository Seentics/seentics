import { z } from "zod";
import type { FunnelDraftPort } from "../../funnels/interfaces";
import type { AiTool, ActionProposal, ToolResult } from "./tool.types";

/**
 * `propose_funnel`: draft a funnel for a person to approve. Writes nothing.
 *
 * Flat, like `propose_automation`: a name and an ordered list of steps, each a page path or a
 * custom event. The stored step shape (`step_type`, `page_path`, `match_type`, ...) is built here,
 * correct by construction, and checked by the funnels module's own validation before the draft is
 * shown — so approving it cannot fail on a step the report would refuse.
 *
 * `websiteId` is absent on purpose: it is bound from the authenticated request.
 */

const MAX_STEPS = 20;

const stepSchema = z.object({
  name: z.string().trim().min(1).max(80).describe("Short step name, e.g. Pricing page"),
  type: z.enum(["page", "event"]).describe("page: a page view; event: a custom event"),
  value: z.string().trim().min(1).max(500).describe("The page path (e.g. /pricing) or the custom event name (e.g. signup)"),
  match: z.enum(["exact", "contains", "starts_with"]).optional().describe("How a page path matches; default exact"),
});

const argsSchema = z.object({
  name: z.string().trim().min(1).max(120).describe("Short human name for the funnel"),
  description: z.string().max(500).optional(),
  steps: z.array(stepSchema).min(2).max(MAX_STEPS).describe("The steps in order, first to last"),
  conversionWindowHours: z.number().int().min(1).max(720).optional()
    .describe("Hours allowed between one step and the next; omit for no limit"),
});

export type ProposeFunnelArgs = z.infer<typeof argsSchema>;

/** The stored JSONB step shape, from the flat spec. Exported for tests. */
export function buildSteps(args: ProposeFunnelArgs): Record<string, unknown>[] {
  return args.steps.map((s, i) => {
    const base = { id: `step-${i + 1}`, name: s.name, order: i };
    if (s.type === "event") return { ...base, step_type: "event", event_type: s.value, match_type: "exact" };
    const match = s.match ?? "exact";
    // An exact or prefix path without its leading slash would match nothing.
    const path = match !== "contains" && !s.value.startsWith("/") ? `/${s.value}` : s.value;
    return { ...base, step_type: "page_view", page_path: path, match_type: match };
  });
}

function summarise(args: ProposeFunnelArgs, steps: Record<string, unknown>[]): string[] {
  const lines = steps.map((s, i) => {
    if (s.step_type === "event") return `Step ${i + 1}: ${s.name} (event "${s.event_type}")`;
    const how = s.match_type === "contains" ? "contains" : s.match_type === "starts_with" ? "starts with" : "is";
    return `Step ${i + 1}: ${s.name} (page ${how} ${s.page_path})`;
  });
  if (args.conversionWindowHours) lines.push(`Each step within ${args.conversionWindowHours} hours of the one before`);
  lines.push("Counted from your page views and events, including visits before it was created.");
  return lines;
}

export function proposeFunnelTool(drafts: FunnelDraftPort): AiTool<ProposeFunnelArgs> {
  return {
    name: "propose_funnel",
    kind: "propose",
    description:
      "Draft a conversion funnel for the user to review and approve. Does not create anything. " +
      "Use when the user asks to track, set up or create a funnel or a multi-step conversion path. " +
      "Each step is a page path or a custom event name; call get_top_pages first if you are not sure of the paths.",
    schema: argsSchema as unknown as z.ZodType<ProposeFunnelArgs>,
    async handler(args): Promise<ToolResult> {
      const steps = buildSteps(args);
      const checked = await drafts.validate({
        name: args.name,
        description: args.description ?? "",
        steps,
        conversion_window_hours: args.conversionWindowHours ?? null,
      });
      if (!checked.ok) return { ok: false, error: `That funnel is not valid: ${checked.error}` };

      const proposal: ActionProposal = {
        resource: "funnel",
        operation: "create",
        payload: checked.draft,
        summary: { title: checked.draft.name, lines: summarise(args, steps), hasExternalEffect: false },
      };
      return { ok: true, data: { proposal } };
    },
  };
}
