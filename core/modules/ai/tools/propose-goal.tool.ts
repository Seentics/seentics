import { z } from "zod";
import type { GoalDraftPort } from "../../websites/interfaces";
import type { AiTool, ActionProposal, ToolResult } from "./tool.types";

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
      const proposal: ActionProposal = {
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
      };
      return { ok: true, data: { proposal } };
    },
  };
}
