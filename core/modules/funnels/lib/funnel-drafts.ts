import type {
  CreateFunnelInput,
  FunnelDraft,
  FunnelDraftPatch,
  FunnelDraftPort,
  FunnelMutations,
  FunnelQuery,
  FunnelSnapshot,
} from "../interfaces";
import { validateFunnelDefinition } from "./funnel-validation";

/** Steps a funnel needs before it measures anything: one step is a page count, not a funnel. */
export const MIN_DRAFT_STEPS = 2;

/**
 * `FunnelDraftPort` over the definition service.
 *
 * `validate` is `create`'s own check plus what makes a draft worth approving: a name and at least
 * two steps that each have something to match. `createFromProposal` reads the stored payload and
 * goes through `create`, which validates again, so a draft cannot reach the table unchecked.
 */
export class FunnelDraftService implements FunnelDraftPort {
  constructor(
    private readonly definitions: Pick<FunnelMutations, "create" | "update"> & Pick<FunnelQuery, "get">,
    private readonly isValidPattern: (pattern: string) => Promise<boolean>,
  ) {}

  async validate(draft: FunnelDraft): Promise<{ ok: true; draft: FunnelDraft } | { ok: false; error: string }> {
    const name = typeof draft.name === "string" ? draft.name.trim() : "";
    if (!name) return { ok: false, error: "The funnel needs a name." };
    const steps = Array.isArray(draft.steps) ? draft.steps : [];
    if (steps.length < MIN_DRAFT_STEPS) return { ok: false, error: `A funnel needs at least ${MIN_DRAFT_STEPS} steps.` };
    for (const [i, step] of steps.entries()) {
      const isEvent = step.step_type === "event";
      const value = String((isEvent ? step.event_type : step.page_path) ?? "").trim();
      if (!value) return { ok: false, error: `Step ${i + 1} has no ${isEvent ? "event name" : "page path"} to match.` };
    }
    const issues = await validateFunnelDefinition(
      { steps, conversion_window_hours: draft.conversion_window_hours ?? null },
      this.isValidPattern,
    );
    if (issues.length) return { ok: false, error: issues.join(" ") };
    return { ok: true, draft: { ...draft, name } };
  }

  async createFromProposal(input: { websiteId: string; userId: string; payload: unknown }): Promise<{ id: string }> {
    const p = (input.payload ?? {}) as Partial<FunnelDraft>;
    const checked = await this.validate({
      name: String(p.name ?? ""),
      description: typeof p.description === "string" ? p.description : "",
      steps: Array.isArray(p.steps) ? p.steps : [],
      conversion_window_hours: typeof p.conversion_window_hours === "number" ? p.conversion_window_hours : null,
    });
    if (!checked.ok) throw new Error(`The approved funnel is not valid: ${checked.error}`);
    const create: CreateFunnelInput = {
      name: checked.draft.name,
      description: checked.draft.description ?? "",
      steps: checked.draft.steps,
      // Active: a funnel only counts visits while it is, and it changes nothing visitors see.
      is_active: true,
      conversion_window_hours: checked.draft.conversion_window_hours ?? null,
    };
    const funnel = await this.definitions.create(input.websiteId, input.userId, create);
    return { id: funnel.id };
  }

  async get(websiteId: string, funnelId: string): Promise<FunnelSnapshot | null> {
    const f = await this.definitions.get(websiteId, funnelId);
    if (!f || f.website_id !== websiteId) return null;
    return {
      id: f.id,
      name: f.name,
      description: f.description ?? "",
      isActive: f.is_active,
      steps: f.steps as unknown as Record<string, unknown>[],
      conversion_window_hours: f.conversion_window_hours ?? null,
      version: new Date(f.updated_at).toISOString(),
    };
  }

  async validatePatch(
    current: FunnelSnapshot,
    patch: FunnelDraftPatch,
  ): Promise<{ ok: true; patch: FunnelDraftPatch } | { ok: false; error: string }> {
    const clean = cleanPatch(patch);
    if (!clean) return { ok: false, error: "The change has nothing to change." };
    // Checked as the whole funnel it produces: a new window is only valid with the steps it applies to.
    const checked = await this.validate({
      name: clean.name ?? current.name,
      description: clean.description ?? current.description,
      steps: clean.steps ?? current.steps,
      conversion_window_hours: clean.conversion_window_hours !== undefined ? clean.conversion_window_hours : current.conversion_window_hours,
    });
    if (!checked.ok) return checked;
    return { ok: true, patch: { ...clean, ...(clean.name !== undefined ? { name: checked.draft.name } : {}) } };
  }

  async updateFromProposal(input: { websiteId: string; funnelId: string; payload: unknown }): Promise<{ id: string }> {
    const current = await this.get(input.websiteId, input.funnelId);
    if (!current) throw new Error("That funnel no longer exists on this website.");
    const checked = await this.validatePatch(current, (input.payload ?? {}) as FunnelDraftPatch);
    if (!checked.ok) throw new Error(`The approved change is not valid: ${checked.error}`);
    const funnel = await this.definitions.update(input.websiteId, input.funnelId, checked.patch);
    if (!funnel) throw new Error("That funnel no longer exists on this website.");
    return { id: funnel.id };
  }

  async setActiveFromProposal(input: { websiteId: string; funnelId: string; active: boolean }): Promise<{ id: string }> {
    const funnel = await this.definitions.update(input.websiteId, input.funnelId, { is_active: input.active });
    if (!funnel) throw new Error("That funnel no longer exists on this website.");
    return { id: funnel.id };
  }
}

/** Only the patchable fields, typed; `null` when nothing is left to change. */
function cleanPatch(p: FunnelDraftPatch): FunnelDraftPatch | null {
  const out: FunnelDraftPatch = {};
  if (typeof p.name === "string") out.name = p.name;
  if (typeof p.description === "string") out.description = p.description;
  if (Array.isArray(p.steps)) out.steps = p.steps;
  if (p.conversion_window_hours === null || typeof p.conversion_window_hours === "number") {
    out.conversion_window_hours = p.conversion_window_hours;
  }
  return Object.keys(out).length ? out : null;
}
