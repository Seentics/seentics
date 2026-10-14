import { z } from "zod";
import type {
  AutomationDraftValidator,
  AutomationDraftWriter,
  AutomationSnapshot,
} from "../../automations/interfaces/automations.module";
import { UUID, diffFields, diffLines, drafted, proposal, refuse } from "./proposal-policy";
import type { AiTool, ProposalRisk, ToolResult } from "./tool.types";

/**
 * `get_automation`, `propose_automation_update` and `propose_automation_status`.
 *
 * The model names an automation by id (from `list_automations`) and says what to change; the
 * definition the change produces is assembled here from the stored one and checked with the
 * update endpoint's own schema before the draft is shown. The version the draft is made against
 * is read here too, never supplied by the model, so a stale draft is caught on confirm.
 */

/** Long strings (custom code, long copy) are cut for the model; a cut one sent back is restored. */
const MAX_SHOWN_CHARS = 300;
const TRUNCATED = "…[truncated";

const EXTERNAL = new Set(["webhook", "redirect"]);

type Def = {
  triggers?: Array<Record<string, unknown>>;
  graph?: { entry?: string; nodes?: Array<Record<string, unknown>>; edges?: unknown[] };
  [k: string]: unknown;
};

function shorten(value: unknown): unknown {
  if (typeof value === "string") {
    return value.length > MAX_SHOWN_CHARS ? `${value.slice(0, MAX_SHOWN_CHARS)}${TRUNCATED} ${value.length - MAX_SHOWN_CHARS} chars]` : value;
  }
  if (Array.isArray(value)) return value.map(shorten);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shorten(v)]));
  }
  return value;
}

/** What the model sees of one automation: compact, ids kept, long strings cut. */
export function automationForModel(a: AutomationSnapshot) {
  const def = a.definition as Def;
  return {
    id: a.id,
    name: a.name,
    active: a.isActive,
    summary: describeDefinition(def),
    triggers: shorten(def.triggers ?? []),
    graph: shorten(def.graph ?? {}),
    ...(def.frequency ? { frequency: def.frequency } : {}),
  };
}

const ruleText = (r: Record<string, unknown>): string =>
  "rules" in r
    ? `(${((r.rules as Array<Record<string, unknown>>) ?? []).map(ruleText).join(` ${String(r.operator ?? "AND")} `)})`
    : `${String(r.fact)} ${String(r.operator)}${r.value === undefined ? "" : ` ${JSON.stringify(r.value)}`}`;

function actionText(action: Record<string, unknown>): string {
  const type = String(action.type ?? "action").replace(/_/g, " ");
  // Every visible field, so a change to any of them shows in the diff.
  const parts = ["title", "message", "content", "url", "selector"]
    .map((k) => action[k])
    .filter((v): v is string => typeof v === "string" && !!v.trim())
    .map((v) => v.slice(0, 80));
  return parts.length ? `${type}: ${parts.join(" — ")}` : type;
}

/** Triggers, actions and conditions as short lines — the card's lists and the diff's values. */
export function describeDefinition(def: Def): { triggers: string[]; actions: string[]; conditions: string[] } {
  const triggers = (def.triggers ?? []).map((t) => String(t.type ?? "").replace(/_/g, " "));
  const actions: string[] = [];
  const conditions: string[] = [];
  for (const n of def.graph?.nodes ?? []) {
    if (n.kind === "action") actions.push(actionText((n.action ?? {}) as Record<string, unknown>));
    else if (n.kind === "delay") actions.push(`wait ${String(n.seconds)}s`);
    else if (n.kind === "if" || n.kind === "wait_until") {
      conditions.push(`${n.kind === "if" ? "if" : "wait until"} ${ruleText((n.group ?? {}) as Record<string, unknown>)}`);
    } else if (n.kind === "switch") {
      conditions.push(`switch: ${((n.cases as Array<Record<string, unknown>>) ?? []).map((c) => String(c.label ?? c.id)).join(", ")}`);
    }
  }
  return { triggers, actions, conditions };
}

function actionTypes(def: Def): string[] {
  return (def.graph?.nodes ?? []).filter((n) => n.kind === "action").map((n) => String((n.action as Record<string, unknown> | undefined)?.type ?? ""));
}

/** A value sent back with the truncation marker means "unchanged": the stored one is kept. */
function restoreTruncated(next: Record<string, unknown>, prev: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...next };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === "string" && v.includes(TRUNCATED) && typeof prev[k] === "string") out[k] = prev[k];
  }
  return out;
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional().describe("New name"),
  triggers: z
    .array(z.record(z.unknown()))
    .min(1)
    .max(10)
    .optional()
    .describe("Replaces every trigger. Each is {type, ...its settings} as get_automation shows them"),
  actionUpdates: z
    .array(z.object({
      nodeId: z.string().min(1).max(64).describe("Id of an action node from get_automation"),
      changes: z.record(z.unknown()).describe("Fields to set on that node's action, e.g. {message: 'New text'}"),
    }))
    .max(20)
    .optional()
    .describe("Small edits to existing actions; fields not named are kept"),
  conditionUpdates: z
    .array(z.object({
      nodeId: z.string().min(1).max(64).describe("Id of an if or wait_until node from get_automation"),
      group: z.record(z.unknown()).describe("The new condition group: {operator: AND|OR|NOT, rules: [{fact, operator, value}]}"),
    }))
    .max(20)
    .optional()
    .describe("Replace the conditions of existing if / wait_until nodes"),
  graph: z
    .record(z.unknown())
    .optional()
    .describe("Only for structural changes: the whole new graph {entry, nodes, edges}. Action nodes keeping their id keep fields you omit"),
});

type Patch = z.infer<typeof patchSchema>;
type UpdateArgs = { automationId: string; patch: Patch };

/** The definition the patch produces, or a message the model can act on. Exported for tests. */
export function applyAutomationPatch(current: Def, patch: Patch): { ok: true; definition: Def } | { ok: false; error: string } {
  const def = structuredClone(current) as Def;
  if (patch.triggers) {
    if (patch.triggers.some((t) => typeof t.type !== "string")) return { ok: false, error: "Every trigger needs a type." };
    def.triggers = patch.triggers;
  }
  if (patch.graph) {
    const prevNodes = new Map((current.graph?.nodes ?? []).map((n) => [String(n.id), n]));
    const g = patch.graph as Def["graph"] & Record<string, unknown>;
    const nodes = Array.isArray(g.nodes) ? (g.nodes as Array<Record<string, unknown>>) : [];
    def.graph = {
      ...g,
      nodes: nodes.map((n) => {
        const prev = prevNodes.get(String(n.id));
        if (n.kind === "action" && prev?.kind === "action" && n.action && typeof n.action === "object") {
          const prevAction = (prev.action ?? {}) as Record<string, unknown>;
          return { ...n, action: { ...prevAction, ...restoreTruncated(n.action as Record<string, unknown>, prevAction) } };
        }
        return n;
      }),
    };
  }
  const nodes = def.graph?.nodes ?? [];
  for (const u of patch.actionUpdates ?? []) {
    const node = nodes.find((n) => n.id === u.nodeId);
    if (!node || node.kind !== "action") return { ok: false, error: `No action node "${u.nodeId}". Call get_automation for the node ids.` };
    const prev = (node.action ?? {}) as Record<string, unknown>;
    node.action = { ...prev, ...restoreTruncated(u.changes, prev) };
  }
  for (const u of patch.conditionUpdates ?? []) {
    const node = nodes.find((n) => n.id === u.nodeId);
    if (!node || (node.kind !== "if" && node.kind !== "wait_until")) {
      return { ok: false, error: `No if or wait_until node "${u.nodeId}". Call get_automation for the node ids.` };
    }
    node.group = u.group;
  }
  return { ok: true, definition: def };
}

export function automationEditTools(deps: {
  automations: Pick<AutomationDraftWriter, "get">;
  validator: AutomationDraftValidator;
}): AiTool<any>[] {
  const load = async (websiteId: string, id: string): Promise<AutomationSnapshot | string> => {
    // Model-supplied: checked before it reaches a uuid column, where a malformed one is a database error.
    if (!UUID.test(id)) return "Not an automation id. Call list_automations to find it.";
    return (await deps.automations.get(websiteId, id)) ?? "No automation with that id on this website. Call list_automations.";
  };

  const getTool: AiTool<{ automationId: string }> = {
    name: "get_automation",
    kind: "read",
    description:
      "One automation's current definition: name, whether it is active, triggers, and its graph of nodes " +
      "(actions, delays, conditions) with their ids. Call before drafting a change to it.",
    schema: z.object({ automationId: z.string().trim().min(1).max(64).describe("Automation id from list_automations") }),
    async handler(args, ctx): Promise<ToolResult> {
      const a = await load(ctx.websiteId, args.automationId);
      return typeof a === "string" ? refuse(a) : { ok: true, data: { data: automationForModel(a) } };
    },
  };

  const updateTool: AiTool<UpdateArgs> = {
    name: "propose_automation_update",
    kind: "propose",
    description:
      "Draft a change to an existing automation — its name, triggers, conditions or actions — for the user to " +
      "review and confirm. Changes nothing until confirmed, and does not switch it on or off (use " +
      "propose_automation_status). Call get_automation first and change as little as the request needs.",
    schema: z.object({
      automationId: z.string().trim().min(1).max(64).describe("Automation id from list_automations"),
      patch: patchSchema,
    }) as unknown as z.ZodType<UpdateArgs>,
    async handler(args, ctx): Promise<ToolResult> {
      const a = await load(ctx.websiteId, args.automationId);
      if (typeof a === "string") return refuse(a);
      const p = args.patch;
      if (p.name === undefined && !p.triggers && !p.actionUpdates?.length && !p.conditionUpdates?.length && !p.graph) {
        return refuse("The patch changes nothing. Say what to change.");
      }

      const before = a.definition as Def;
      let definition: Def | undefined;
      if (p.triggers || p.actionUpdates?.length || p.conditionUpdates?.length || p.graph) {
        const merged = applyAutomationPatch(before, p);
        if (!merged.ok) return refuse(merged.error);
        // The update endpoint's own schema, graph semantics included.
        const checked = deps.validator.validateDefinition(merged.definition);
        if (!checked.ok) return refuse(`That change is not valid: ${checked.error}`);
        definition = checked.definition as Def;
      }

      const b = describeDefinition(before);
      const after = definition ? describeDefinition(definition) : b;
      const diff = diffFields(
        [["name", "Name"], ["triggers", "Triggers"], ["conditions", "Conditions"], ["actions", "Actions"]],
        { name: a.name, ...b },
        { ...(p.name !== undefined ? { name: p.name } : {}), ...(definition ? after : {}) },
      );
      // A graph identical in what it says can still differ in wiring; that is a change too.
      if (!diff.length && !(definition && JSON.stringify(definition) !== JSON.stringify(before))) {
        return refuse("That is how the automation already is. Nothing to change.");
      }

      const external = definition
        ? actionTypes(definition).some((t) => EXTERNAL.has(t)) && JSON.stringify(after.actions) !== JSON.stringify(b.actions)
        : false;
      const risks: ProposalRisk[] = [];
      if (a.isActive) risks.push({ kind: "live", message: "This automation is live: the change reaches visitors as soon as you confirm." });
      if (external) risks.push({ kind: "external", message: "The changed actions reach outside Seentics (a webhook or a redirect). Check the address." });

      return drafted(proposal({
        resource: "automation",
        operation: "update",
        target: { id: a.id, version: a.version },
        payload: { ...(p.name !== undefined ? { name: p.name } : {}), ...(definition ? { definition } : {}) },
        diff,
        summary: {
          title: `Change "${a.name}"`,
          lines: [...diffLines(diff), a.isActive ? "Stays active." : "Stays inactive."],
          hasExternalEffect: external,
          risks,
        },
      }));
    },
  };

  const statusTool: AiTool<{ automationId: string; active: boolean }> = {
    name: "propose_automation_status",
    kind: "propose",
    description:
      "Draft switching an existing automation on (live for visitors) or off, for the user to confirm. " +
      "Changes nothing until confirmed. Switching off never deletes it.",
    schema: z.object({
      automationId: z.string().trim().min(1).max(64).describe("Automation id from list_automations"),
      active: z.boolean().describe("true: switch on (goes live); false: switch off"),
    }),
    async handler(args, ctx): Promise<ToolResult> {
      const a = await load(ctx.websiteId, args.automationId);
      if (typeof a === "string") return refuse(a);
      if (a.isActive === args.active) return refuse(`"${a.name}" is already ${a.isActive ? "on" : "off"}.`);
      const external = args.active && actionTypes(a.definition as Def).some((t) => EXTERNAL.has(t));
      const risks: ProposalRisk[] = args.active
        ? [{ kind: "live", message: "Goes live immediately: visitors start seeing it as soon as you confirm." }]
        : [{ kind: "stops", message: "Stops running for visitors. It is kept, and can be switched back on." }];
      if (external) risks.push({ kind: "external", message: "It reaches outside Seentics (a webhook or a redirect)." });
      const d = describeDefinition(a.definition as Def);
      return drafted(proposal({
        resource: "automation",
        operation: "set_status",
        target: { id: a.id, version: a.version },
        payload: { active: args.active },
        diff: [{ field: "active", label: "Status", before: a.isActive ? "active" : "inactive", after: args.active ? "active" : "inactive" }],
        summary: {
          title: `${args.active ? "Switch on" : "Switch off"} "${a.name}"`,
          lines: [`Trigger: ${d.triggers.join(", ") || "none"}`, `Actions: ${d.actions.join("; ") || "none"}`],
          hasExternalEffect: external,
          risks,
        },
      }));
    },
  };

  return [getTool, updateTool, statusTool];
}
