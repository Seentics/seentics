import { goalCreateSchema, goalPatchSchema } from "../validators/website.schema";
import type { GoalDraft, GoalDraftPatch, GoalDraftPort, GoalSnapshot } from "../interfaces";
import { createWebsiteGoal, findWebsiteGoal, listWebsiteGoals, updateWebsiteGoal } from "../services/website-goal.service";

/** Goal types an approved draft may create: a page reached, or a custom event fired. */
export const DRAFT_GOAL_TYPES = ["pageview", "event"] as const;

const isDraftType = (t: string) => (DRAFT_GOAL_TYPES as readonly string[]).includes(t);

/**
 * `GoalDraftPort`: the goal endpoints' schemas, narrowed to the two goal types that need no
 * selector, and the same insert and update the endpoints run. The AI module's whole write surface
 * into goals.
 */
export class GoalDraftService implements GoalDraftPort {
  validate(draft: unknown): { ok: true; draft: GoalDraft } | { ok: false; error: string } {
    const parsed = goalCreateSchema.safeParse(draft);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".") || "goal"}: ${i.message}`).join("; ") };
    }
    const type = parsed.data.type.trim().toLowerCase();
    if (!isDraftType(type)) {
      return { ok: false, error: `type must be one of ${DRAFT_GOAL_TYPES.join(", ")}` };
    }
    let identifier = parsed.data.identifier.trim();
    if (type === "pageview" && !identifier.startsWith("/")) identifier = `/${identifier}`;
    return { ok: true, draft: { name: parsed.data.name.trim(), type: type as GoalDraft["type"], identifier } };
  }

  async createFromProposal(input: { websiteId: string; payload: unknown }): Promise<{ id: string }> {
    const checked = this.validate(input.payload);
    if (!checked.ok) throw new Error(`The approved goal is not valid: ${checked.error}`);
    const created = await createWebsiteGoal(input.websiteId, checked.draft);
    const id = (created.data as { id?: string } | undefined)?.id;
    if (!id) throw new Error("The goal could not be created.");
    return { id };
  }

  async list(websiteId: string): Promise<GoalSnapshot[]> {
    const { data } = await listWebsiteGoals(websiteId);
    return data.map((g) => ({ id: g.id, name: g.name, type: g.type, identifier: g.identifier, version: g.updated_at }));
  }

  async get(websiteId: string, goalId: string): Promise<GoalSnapshot | null> {
    const g = await findWebsiteGoal(websiteId, goalId);
    if (!g) return null;
    return { id: g.id, name: g.name, type: g.type, identifier: g.identifier, version: g.updatedAt.toISOString() };
  }

  validatePatch(current: GoalSnapshot, patch: unknown): { ok: true; patch: GoalDraftPatch } | { ok: false; error: string } {
    // The update endpoint's own schema first, then the create schema's field rules on the result.
    const raw = goalPatchSchema.safeParse(patch);
    if (!raw.success) return { ok: false, error: "The change must be an object of goal fields." };
    const p = raw.data;
    const wanted: GoalDraftPatch = {};
    if (typeof p.name === "string") wanted.name = p.name;
    if (typeof p.type === "string") wanted.type = p.type as GoalDraft["type"];
    if (typeof p.identifier === "string") wanted.identifier = p.identifier;
    if (!Object.keys(wanted).length) return { ok: false, error: "The change has nothing to change." };

    if (!isDraftType(current.type) && (wanted.type !== undefined || wanted.identifier !== undefined)) {
      return { ok: false, error: `A ${current.type} goal can only be renamed here; change its target on the goals screen.` };
    }
    const merged = {
      name: wanted.name ?? current.name,
      type: wanted.type ?? current.type,
      identifier: wanted.identifier ?? current.identifier,
    };
    if (!isDraftType(current.type)) {
      const name = goalCreateSchema.shape.name.safeParse(merged.name);
      return name.success ? { ok: true, patch: { name: name.data.trim() } } : { ok: false, error: `name: ${name.error.issues[0]?.message}` };
    }
    const checked = this.validate(merged);
    if (!checked.ok) return checked;
    const out: GoalDraftPatch = {};
    for (const k of Object.keys(wanted) as (keyof GoalDraftPatch)[]) (out as Record<string, string>)[k] = checked.draft[k];
    return { ok: true, patch: out };
  }

  async updateFromProposal(input: { websiteId: string; goalId: string; payload: unknown }): Promise<{ id: string }> {
    const current = await this.get(input.websiteId, input.goalId);
    if (!current) throw new Error("That goal no longer exists on this website.");
    const checked = this.validatePatch(current, input.payload);
    if (!checked.ok) throw new Error(`The approved change is not valid: ${checked.error}`);
    const updated = await updateWebsiteGoal(input.websiteId, input.goalId, checked.patch);
    if (!updated) throw new Error("That goal no longer exists on this website.");
    return { id: input.goalId };
  }
}
