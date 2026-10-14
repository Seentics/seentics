import type { AutomationCrud } from "../interfaces";
import type { AutomationDraftWriter, AutomationSnapshot } from "../interfaces/automations.module";
import { automationsPatchBodySchema } from "../validators/automation.schema";

/**
 * `AutomationDraftWriter` over the dashboard's own CRUD service.
 *
 * Every write goes through `AutomationCrud` — the same create and update the automations
 * endpoints run — so an approved draft cannot reach the table by a path the dashboard does not
 * also take.
 *
 * `is_active` is decided here rather than copied from the payload: only an explicit
 * `activate: true` (which the draft tool sets only on request, and the card announces) makes a
 * new automation live. "Yes, create this" is otherwise not "yes, start showing it to visitors".
 */
export class AutomationDraftWriterService implements AutomationDraftWriter {
  constructor(private readonly crud: Pick<AutomationCrud, "create" | "get" | "update">) {}

  async createFromProposal(input: {
    websiteId: string;
    userId: string;
    payload: unknown;
  }): Promise<{ id: string }> {
    const payload = (input.payload ?? {}) as { name?: unknown; definition?: unknown; activate?: unknown };
    const name = typeof payload.name === "string" && payload.name.trim()
      ? payload.name.trim()
      : "Untitled automation";

    if (!payload.definition) {
      throw new Error("The approved draft has no definition to create.");
    }

    const row = await this.crud.create(input.websiteId, input.userId, {
      name,
      definition: payload.definition as Record<string, unknown>,
      is_active: payload.activate === true,
    });
    return { id: row.id };
  }

  async get(websiteId: string, automationId: string): Promise<AutomationSnapshot | null> {
    const row = await this.crud.get(websiteId, automationId);
    if (!row || row.websiteId !== websiteId) return null;
    return {
      id: row.id,
      name: row.name,
      isActive: row.isActive,
      definition: row.definition,
      version: new Date(row.updatedAt).toISOString(),
    };
  }

  async updateFromProposal(input: { websiteId: string; automationId: string; payload: unknown }): Promise<{ id: string }> {
    const parsed = automationsPatchBodySchema.safeParse(input.payload ?? {});
    if (!parsed.success) {
      const detail = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
      throw new Error(`The approved change is not valid: ${detail}`);
    }
    // Status is its own decision (`setActiveFromProposal`), never a side effect of an edit.
    const { name, definition } = parsed.data;
    if (name === undefined && definition === undefined) throw new Error("The approved change has nothing to change.");
    const row = await this.crud.update(input.websiteId, input.automationId, {
      ...(name !== undefined ? { name } : {}),
      ...(definition !== undefined ? { definition: definition as Record<string, unknown> } : {}),
    });
    if (!row) throw new Error("That automation no longer exists on this website.");
    return { id: row.id };
  }

  async setActiveFromProposal(input: { websiteId: string; automationId: string; active: boolean }): Promise<{ id: string }> {
    const row = await this.crud.update(input.websiteId, input.automationId, { is_active: input.active });
    if (!row) throw new Error("That automation no longer exists on this website.");
    return { id: row.id };
  }
}
