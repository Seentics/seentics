import { z } from "zod";
import type { AutomationDraftValidator } from "../../automations/interfaces/automations.module";
import type { AiTool, ActionProposal, ToolResult } from "./tool.types";

/**
 * The vocabularies, passed in rather than imported.
 *
 * A module may only reach a peer through its interfaces, and the enums live beside the
 * Zod schema. Injecting them keeps this tool honest about the boundary while still
 * proposing only what the server will accept.
 */
export type AutomationVocabulary = {
  triggerTypes: readonly string[];
  actionTypes: readonly string[];
};

/**
 * Action types a proposal may contain, and how loudly to say so.
 *
 * `webhook` and `redirect` are the two that reach outside the product — one posts to an
 * arbitrary external URL, the other sends a visitor to another origin. Everything else
 * changes what a visitor sees on a page the customer already controls. The split drives
 * the warning the confirmation screen shows; it does not decide what is allowed, because
 * nothing here is written without a person approving it either way.
 */
const EXTERNAL_EFFECT_ACTIONS = new Set(["webhook", "redirect"]);

/**
 * What the model supplies.
 *
 * Deliberately flat. The real definition is a graph of nodes and edges with entry points
 * and branch wiring, and asking a model to emit one means asking it to get acyclicity
 * and reachability right — it would fail often, and each failure is a retry that costs a
 * call. A trigger, an action and its configuration is the part a person actually
 * described; the graph is assembled here, where it is correct by construction.
 *
 * `websiteId` is absent on purpose. It is bound from the authenticated request in
 * `ToolContext`; a model-supplied one would be a cross-tenant write vector.
 */
function buildArgsSchema(vocab: AutomationVocabulary) {
  return z.object({
  name: z.string().min(1).max(120).describe("Short human name for the automation"),
  description: z.string().max(500).optional(),
  trigger: z
    .enum(vocab.triggerTypes as [string, ...string[]])
    .describe("What starts the automation"),
  action: z
    .enum(vocab.actionTypes as [string, ...string[]])
    .describe("What the automation does when it fires"),
  /**
   * Free-form action configuration — the message of a modal, the URL of a redirect.
   *
   * Passed through to the same passthrough schema the builder writes, so this tool does
   * not have to track every action type's fields. The action *type* is still closed.
   */
  actionConfig: z.record(z.unknown()).optional(),
  delaySeconds: z
    .number()
    .int()
    .nonnegative()
    .max(86_400)
    .optional()
    .describe("Wait this long after the trigger before acting"),
  });
}

type ProposeAutomationArgs = {
  name: string;
  description?: string;
  trigger: string;
  action: string;
  actionConfig?: Record<string, unknown>;
  delaySeconds?: number;
};

/**
 * Assemble a definition from the flat spec.
 *
 * A single action, optionally behind a delay: entry → (delay) → action. That is the
 * shape almost every automation someone describes in a sentence actually has, and
 * anything more elaborate belongs in the builder where it can be seen.
 */
function buildDefinition(args: ProposeAutomationArgs): unknown {
  const actionNode = {
    id: "n_action",
    kind: "action" as const,
    action: { type: args.action, ...(args.actionConfig ?? {}) },
  };

  if (!args.delaySeconds) {
    return {
      triggers: [{ type: args.trigger }],
      graph: { entry: actionNode.id, nodes: [actionNode], edges: [] },
    };
  }

  const delayNode = { id: "n_delay", kind: "delay" as const, seconds: args.delaySeconds };
  return {
    triggers: [{ type: args.trigger }],
    graph: {
      entry: delayNode.id,
      nodes: [delayNode, actionNode],
      edges: [{ from: delayNode.id, to: actionNode.id }],
    },
  };
}

/** One readable line per fact the approver needs, built from the validated payload. */
function summarise(args: ProposeAutomationArgs): string[] {
  const lines = [`Trigger: ${args.trigger.replace(/_/g, " ")}`];
  if (args.delaySeconds) lines.push(`Wait: ${args.delaySeconds}s`);
  lines.push(`Action: ${args.action.replace(/_/g, " ")}`);

  const cfg = args.actionConfig ?? {};
  for (const key of ["url", "message", "title", "selector", "content"]) {
    const v = cfg[key];
    if (typeof v === "string" && v.trim()) {
      lines.push(`${key}: ${v.slice(0, 200)}`);
    }
  }
  lines.push("Created inactive — it will not run until you enable it.");
  return lines;
}

/**
 * Draft an automation for a person to approve. Writes nothing.
 *
 * The draft is validated here against `automationDefinitionSchema` — the same schema the
 * create endpoint uses, graph semantics included — so accepting it cannot fail
 * validation afterwards. The confirmation step is a decision, not a second chance to
 * catch a malformed draft.
 */
export function proposeAutomationTool(
  validator: AutomationDraftValidator,
  vocab: AutomationVocabulary,
): AiTool<ProposeAutomationArgs> {
  return {
    name: "propose_automation",
    kind: "propose",
    description:
      "Draft an automation for the user to review and approve. Does not create anything. " +
      "Use when the user asks to set up, create or add an automation, popup, banner or webhook.",
    schema: buildArgsSchema(vocab) as unknown as z.ZodType<ProposeAutomationArgs>,
    async handler(args): Promise<ToolResult> {
      const definition = buildDefinition(args);

      const checked = validator.validateDefinition(definition);
      if (!checked.ok) {
        // Returned, not thrown: the model can correct the spec and try again, and the
        // message names the field so it has something to correct.
        return { ok: false, error: `That automation is not valid: ${checked.error}` };
      }

      const proposal: ActionProposal = {
        resource: "automation",
        operation: "create",
        payload: {
          name: args.name,
          description: args.description ?? "",
          // Never active on creation, whoever approves it. An automation runs against
          // live visitors, and "approved the draft" is not "meant it to start now".
          status: "draft",
          definition: checked.definition,
        },
        summary: {
          title: args.name,
          lines: summarise(args),
          hasExternalEffect: EXTERNAL_EFFECT_ACTIONS.has(args.action),
        },
      };

      return { ok: true, data: { proposal } };
    },
  };
}
