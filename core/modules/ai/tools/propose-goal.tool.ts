import { z } from "zod";
import type { GoalDraftPort } from "../../websites/interfaces";
import type { AiTool, ActionProposal, ToolResult } from "./tool.types";
import { UUID, diffFields, diffLines, drafted, proposal as withRole, refuse } from "./proposal-policy";

/**
 * `propose_goal`: draft a conversion goal for a person to approve. Writes nothing.
 *
 * A goal is a page reached or a custom event fired. Checked with the goal create endpoint's own
 * schema (through `GoalDraftPort`) before it is shown. Click goals need a CSS selector picked on
 * the page, which is the settings screen's job, so they are not offered here.
 */

const argsSchema = z.object({
  name: z.string().trim().min(1).max(120).describe("Short human name, e.g. Signed up"),
  type: z.enum(["pageview", "event"]).describe("pageview: a page is reached; event: a custom event fires"),
  identifier: z.string().trim().min(1).max(256).describe("The page path (e.g. /thank-you) or the custom event name (e.g. signup)"),
});

export type ProposeGoalArgs = z.infer<typeof argsSchema>;

export function proposeGoalTool(drafts: GoalDraftPort): AiTool<ProposeGoalArgs> {
  return {
    name: "propose_goal",
    kind: "propose",
    description:
      "Draft a conversion goal (a page reached, or a custom event fired) for the user to review and " +
      "approve. Does not create anything. Use when the user asks to track a goal or a conversion.",
    schema: argsSchema as unknown as z.ZodType<ProposeGoalArgs>,
    async handler(args): Promise<ToolResult> {
      const checked = drafts.validate(args);
      if (!checked.ok) return { ok: false, error: `That goal is not valid: ${checked.error}` };
      const g = checked.draft;
      const proposal: ActionProposal = withRole({
        resource: "goal",
        operation: "create",
        payload: g,
        summary: {
          title: g.name,
          lines: [
            g.type === "pageview" ? `Completed when a visitor reaches ${g.identifier}` : `Completed when the "${g.identifier}" event fires`,
            "Counted from your existing data too, so past completions show up.",
          ],
          hasExternalEffect: false,
        },
      });
      return { ok: true, data: { proposal } };
    },
  };
}

const goalLine = (g: { type: string; identifier: string }) =>
  g.type === "pageview" ? `page ${g.identifier}` : g.type === "event" ? `event "${g.identifier}"` : `${g.type} ${g.identifier}`;

/**
 * `list_goals` and `propose_goal_update`. Goals have no archived or inactive state, so there is no
 * archive tool: removing a goal stays on the goals screen.
 */
export function goalEditTools(drafts: GoalDraftPort): AiTool<any>[] {
  const listTool: AiTool<Record<string, never>> = {
    name: "list_goals",
    kind: "read",
    description: "The conversion goals configured for this website, with their ids, types (pageview, event, click) and what completes them.",
    schema: z.object({}) as unknown as z.ZodType<Record<string, never>>,
    async handler(_args, ctx): Promise<ToolResult> {
      const goals = await drafts.list(ctx.websiteId);
      return { ok: true, data: { data: goals.slice(0, 100).map((g) => ({ id: g.id, name: g.name, type: g.type, identifier: g.identifier })) } };
    },
  };

  type UpdateArgs = { goalId: string; patch: { name?: string; type?: "pageview" | "event"; identifier?: string } };
  const updateTool: AiTool<UpdateArgs> = {
    name: "propose_goal_update",
    kind: "propose",
    description:
      "Draft a change to an existing goal — its name, or what completes it (a page or a custom event) — for the user " +
      "to confirm. Changes nothing until confirmed. Click goals can only be renamed. Call list_goals for the id.",
    schema: z.object({
      goalId: z.string().trim().min(1).max(64).describe("Goal id from list_goals"),
      patch: z.object({
        name: z.string().trim().min(1).max(120).optional(),
        type: z.enum(["pageview", "event"]).optional(),
        identifier: z.string().trim().min(1).max(256).optional().describe("The page path or the custom event name"),
      }),
    }) as unknown as z.ZodType<UpdateArgs>,
    async handler(args, ctx): Promise<ToolResult> {
      if (!UUID.test(args.goalId)) return refuse("Not a goal id. Call list_goals to find it.");
      const g = await drafts.get(ctx.websiteId, args.goalId);
      if (!g) return refuse("No goal with that id on this website. Call list_goals.");
      const checked = drafts.validatePatch(g, args.patch);
      if (!checked.ok) return refuse(`That change is not valid: ${checked.error}`);
      const after = { ...g, ...checked.patch };
      const diff = diffFields(
        [["name", "Name"], ["completes", "Completed by"]],
        { name: g.name, completes: goalLine(g) },
        { ...(checked.patch.name !== undefined ? { name: after.name } : {}), ...(checked.patch.type || checked.patch.identifier ? { completes: goalLine(after) } : {}) },
      );
      if (!diff.length) return refuse("That is how the goal already is. Nothing to change.");
      return drafted(withRole({
        resource: "goal",
        operation: "update",
        target: { id: g.id, version: g.version },
        payload: checked.patch,
        diff,
        summary: {
          title: `Change the "${g.name}" goal`,
          lines: [...diffLines(diff), ...(checked.patch.type || checked.patch.identifier ? ["Its conversions are recounted from your existing data with the new rule."] : [])],
          hasExternalEffect: false,
        },
      }));
    },
  };

  return [listTool, updateTool];
}
