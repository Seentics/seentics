import { goalCreateSchema } from "../validators/website.schema";
import type { GoalDraft, GoalDraftPort } from "../interfaces";
import { createWebsiteGoal } from "../services/website-goal.service";

/** Goal types an approved draft may create: a page reached, or a custom event fired. */
export const DRAFT_GOAL_TYPES = ["pageview", "event"] as const;

/**
 * `GoalDraftPort`: the goal create endpoint's schema, narrowed to the two goal types that need no
 * selector, and the same insert the endpoint runs. The AI module's whole write surface into goals.
 */
export class GoalDraftService implements GoalDraftPort {
  validate(draft: unknown): { ok: true; draft: GoalDraft } | { ok: false; error: string } {
    const parsed = goalCreateSchema.safeParse(draft);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".") || "goal"}: ${i.message}`).join("; ") };
    }
    const type = parsed.data.type.trim().toLowerCase();
    if (!(DRAFT_GOAL_TYPES as readonly string[]).includes(type)) {
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
}
