import type { ActionProposal, ConfirmRole, ProposalChange, ProposalDiffValue, ProposalOperation } from "./tool.types";

/**
 * Who may confirm what, and the small helpers every `propose_*` tool shares.
 *
 * One table for the role, read by the tools (to say on the card who can confirm) and by the
 * applier (to decide). The applier never reads the role stored on the draft: a stored row is
 * data, and the rule is code.
 */

/** Resources whose changes are settings: they change what the site collects, or who is alerted. */
const ADMIN_RESOURCES: ReadonlySet<string> = new Set(["site_settings", "alert_settings", "alert_snooze"]);

/** Settings changes need an admin; everything else a member. Owners always qualify. */
export function requiredRoleFor(resource: string, _operation: ProposalOperation): ConfirmRole {
  return ADMIN_RESOURCES.has(resource) ? "admin" : "member";
}

/**
 * The team permission the matching dashboard endpoint checks, where it checks one.
 *
 * A custom team role can narrow a member (the gateway's `X-Team-Permissions`). The assistant must
 * not be a way round that: confirming a goal change needs what editing a goal on the goals page
 * needs. Funnels, automations, errors, recommendations and alerts check no permission there either.
 */
export function requiredPermissionFor(resource: string): string | null {
  switch (resource) {
    case "site_settings":
      return "analytics:settings.manage";
    case "goal":
      return "analytics:goals.manage";
    default:
      return null;
  }
}

/** Human name of a resource, for messages. */
export function resourceLabel(resource: string): string {
  switch (resource) {
    case "automation": return "automation";
    case "funnel": return "funnel";
    case "goal": return "goal";
    case "error": return "error";
    case "recommendation": return "suggestion";
    case "alert_settings": return "alert settings";
    case "alert_snooze": return "alert snooze";
    case "site_settings": return "site settings";
    default: return resource;
  }
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A diff value from anything: lists stay lists (each item as text), the rest becomes one line. */
export function diffValue(v: unknown): ProposalDiffValue {
  if (v === null || v === undefined || v === "") return null;
  if (Array.isArray(v)) return v.map((x) => clip(typeof x === "string" ? x : JSON.stringify(x)));
  if (typeof v === "boolean") return v ? "on" : "off";
  if (typeof v === "string") return clip(v);
  return clip(JSON.stringify(v));
}

function clip(s: string, max = 200): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

const same = (a: ProposalDiffValue, b: ProposalDiffValue) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The changed fields, compact. Unchanged fields are left out, so the card shows only what moves.
 * `fields` maps a key to its label; `before` and `after` are read with the same keys.
 */
export function diffFields(
  fields: ReadonlyArray<readonly [key: string, label: string]>,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): ProposalChange[] {
  const out: ProposalChange[] = [];
  for (const [key, label] of fields) {
    if (!(key in after)) continue;
    const b = diffValue(before[key]);
    const a = diffValue(after[key]);
    if (!same(a, b)) out.push({ field: key, label, before: b, after: a });
  }
  return out;
}

/** One line per change, for the plain-text summary (and the model). */
export function diffLines(diff: ProposalChange[]): string[] {
  const show = (v: ProposalDiffValue) => (v === null ? "(none)" : Array.isArray(v) ? `${v.length} item${v.length === 1 ? "" : "s"}` : v);
  return diff.map((d) => `${d.label}: ${show(d.before)} → ${show(d.after)}`);
}

/** A proposal with the role filled in from the table above. */
export function proposal(p: Omit<ActionProposal, "requiredRole">): ActionProposal {
  return { ...p, requiredRole: requiredRoleFor(p.resource, p.operation) };
}

/** The tool result for a draft. The model is told it is a draft, never that anything changed. */
export function drafted(p: ActionProposal) {
  return { ok: true as const, data: { proposal: p } };
}

/** A refusal the model can correct, with a hint. */
export const refuse = (error: string) => ({ ok: false as const, error });
