import type { AiProposalApplier } from "../../interfaces/ai-agent.interface";
import type { AiRepository } from "../../interfaces/ai-repository.interface";

/**
 * Creates the resource an approved draft describes.
 *
 * Injected as a port so the AI module does not reach into the automations module to
 * write. It also keeps the write surface explicit and small: this is the entire list of
 * things an approved AI proposal can create, and adding to it is a deliberate edit here
 * rather than a consequence of adding a tool.
 */
export type ProposalWriters = {
  createAutomation(input: {
    websiteId: string;
    userId: string;
    payload: unknown;
  }): Promise<{ id: string }>;
};

export type ApplyResult =
  | { ok: true; created: { resource: string; id: string } }
  | { ok: false; error: string };

/**
 * Applies a stored draft after a person approved it.
 *
 * Three things make the approval meaningful rather than decorative:
 *
 * - The payload is read from the stored row, not from the request. A client sending the
 *   payload back could send a different one than the screen showed.
 * - The website on the row must match the website in the URL, so a draft approved for
 *   one site cannot be created against another.
 * - `markProposalApplied` is claimed *before* the write, and its update is conditional on
 *   the draft still being unapplied. Two concurrent confirms both see a pending draft;
 *   only one wins the update, so only one creates.
 */
export class ProposalApplier implements AiProposalApplier {
  constructor(
    private readonly repo: AiRepository,
    private readonly writers: ProposalWriters,
  ) {}

  async apply(input: {
    userId: string;
    websiteId: string;
    queryId: string;
  }): Promise<ApplyResult> {
    const pending = await this.repo.pendingProposal(input.userId, input.queryId);
    if (!pending) {
      return { ok: false, error: "That draft is no longer available, or was already created." };
    }

    if (pending.websiteId !== input.websiteId) {
      return { ok: false, error: "That draft belongs to a different website." };
    }

    const proposal = pending.proposal as {
      resource?: string;
      operation?: string;
      payload?: unknown;
    };

    if (proposal.operation !== "create") {
      return { ok: false, error: `Unsupported operation: ${proposal.operation ?? "none"}` };
    }

    // Claimed before the write. Losing this race means another request is already
    // creating it, and the honest answer is that it is done rather than doing it twice.
    const claimed = await this.repo.markProposalApplied(input.userId, input.queryId);
    if (!claimed) {
      return { ok: false, error: "That draft has already been created." };
    }

    switch (proposal.resource) {
      case "automation": {
        const created = await this.writers.createAutomation({
          websiteId: input.websiteId,
          userId: input.userId,
          payload: proposal.payload,
        });
        return { ok: true, created: { resource: "automation", id: created.id } };
      }
      default:
        return { ok: false, error: `Unsupported resource: ${proposal.resource ?? "none"}` };
    }
  }
}
