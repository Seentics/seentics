import type { AutomationDraftWriter } from "../interfaces/automations.module";

/** What the repository needs from us, declared here so this file does not import it. */
export type AutomationCreator = {
  create(
    websiteId: string,
    userId: string,
    input: { name: string; definition: unknown; is_active?: boolean },
  ): Promise<{ id: string }>;
};

/**
 * `AutomationDraftWriter` over the repository.
 *
 * `is_active: false` is set here rather than read from the payload. A draft reaches this
 * point because someone clicked confirm on a summary, and "yes, create this" is not "yes,
 * start showing it to visitors now" — the two are separate decisions and the second one
 * belongs on the automations screen where its effect is visible.
 */
export class AutomationDraftWriterService implements AutomationDraftWriter {
  constructor(private readonly repo: AutomationCreator) {}

  async createFromProposal(input: {
    websiteId: string;
    userId: string;
    payload: unknown;
  }): Promise<{ id: string }> {
    const payload = (input.payload ?? {}) as { name?: unknown; definition?: unknown };
    const name = typeof payload.name === "string" && payload.name.trim()
      ? payload.name.trim()
      : "Untitled automation";

    if (!payload.definition) {
      throw new Error("The approved draft has no definition to create.");
    }

    const row = await this.repo.create(input.websiteId, input.userId, {
      name,
      definition: payload.definition,
      is_active: false,
    });
    return { id: row.id };
  }
}
