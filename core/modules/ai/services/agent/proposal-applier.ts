import type { AiProposalApplier } from "../../interfaces/ai-agent.interface";
import type { AiRepository } from "../../interfaces/ai-repository.interface";
import { log as baseLog } from "../../../../platform/observability/logger";

const log = baseLog.child({ category: "ai_proposals" });

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
  /** Absent where the funnels module is not wired; a funnel draft is then refused. */
  createFunnel?(input: { websiteId: string; userId: string; payload: unknown }): Promise<{ id: string }>;
  /** Absent where goal drafts are not wired; a goal draft is then refused. */
  createGoal?(input: { websiteId: string; userId: string; payload: unknown }): Promise<{ id: string }>;
};

/** What was created, told to whoever records it (the recommendations loop). */
export type AppliedProposal = {
  websiteId: string;
  userId: string;
  queryId: string;
  /** The recommendation the chat was started from, if any. Unverified: the listener checks it. */
  recommendationId: string | null;
  proposal: { resource: string; payload: unknown; summary?: { title?: string } };
  created: { resource: string; id: string };
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
 *
 * Who may approve is the route's decision (a member or above), not this class's.
 */
export class ProposalApplier implements AiProposalApplier {
  constructor(
    private readonly repo: AiRepository,
    private readonly writers: ProposalWriters,
    /** Told after a successful create. Its failure is logged, never surfaced: the thing exists. */
    private readonly onApplied?: (applied: AppliedProposal) => Promise<void>,
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
      summary?: { title?: string };
    };

    if (proposal.operation !== "create") {
      return { ok: false, error: `Unsupported operation: ${proposal.operation ?? "none"}` };
    }

    const writer = this.writerFor(proposal.resource);
    if (!writer) {
      return { ok: false, error: `Unsupported resource: ${proposal.resource ?? "none"}` };
    }

    // Claimed before the write. Losing this race means another request is already
    // creating it, and the honest answer is that it is done rather than doing it twice.
    const claimed = await this.repo.markProposalApplied(input.userId, input.queryId);
    if (!claimed) {
      return { ok: false, error: "That draft has already been created." };
    }

    const created = await writer.call(this.writers, {
      websiteId: input.websiteId,
      userId: input.userId,
      payload: proposal.payload,
    });
    const result = { resource: proposal.resource!, id: created.id };

    if (this.onApplied) {
      try {
        await this.onApplied({
          websiteId: input.websiteId,
          userId: input.userId,
          queryId: input.queryId,
          recommendationId: pending.recommendationId ?? null,
          proposal: { resource: result.resource, payload: proposal.payload, summary: proposal.summary },
          created: result,
        });
      } catch (err) {
        log.warn({ msg: "proposal_applied_listener_failed", query_id: input.queryId, err: String(err) });
      }
    }
    return { ok: true, created: result };
  }

  private writerFor(resource: string | undefined) {
    switch (resource) {
      case "automation":
        return this.writers.createAutomation;
      case "funnel":
        return this.writers.createFunnel;
      case "goal":
        return this.writers.createGoal;
      default:
        return undefined;
    }
  }
}
