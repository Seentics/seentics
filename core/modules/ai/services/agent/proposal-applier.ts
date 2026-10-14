import type { AiProposalApplier, ApplyFailureCode } from "../../interfaces/ai-agent.interface";
import type { AiRepository } from "../../interfaces/ai-repository.interface";
import { roleAtLeast, type WebsiteRole } from "../../../websites/interfaces";
import { requiredPermissionFor, requiredRoleFor, resourceLabel } from "../../tools/proposal-policy";
import type { ProposalOperation } from "../../tools/tool.types";
import { log as baseLog } from "../../../../platform/observability/logger";

const log = baseLog.child({ category: "ai_proposals" });

export type WriteInput = { websiteId: string; userId: string; payload: unknown };
/** `id` is the target's id on this website, from the stored draft. */
export type TargetWriteInput = WriteInput & { id: string };

/**
 * What an approved draft can do to one kind of resource.
 *
 * Every non-create operation needs `version`: the applier checks the target still exists on
 * this website, at the version the draft was made against, before it writes. A writer without
 * an operation simply cannot be asked to do it — there is no fallback.
 *
 * There is no delete here, and no way to add one by accident: `archive` must be implemented as a
 * deactivation or soft archive by whoever wires it.
 */
export type ResourceWriter = {
  create?(input: WriteInput): Promise<{ id: string }>;
  /** The target's version on this website now; `null` when it does not exist here. */
  version?(websiteId: string, id: string): Promise<string | null>;
  update?(input: TargetWriteInput): Promise<{ id: string }>;
  setStatus?(input: TargetWriteInput): Promise<{ id: string }>;
  archive?(input: TargetWriteInput): Promise<{ id: string }>;
};

/**
 * The entire write surface an approved proposal can reach, by resource.
 *
 * Injected so the AI module does not reach into its peers to write, and so the list stays
 * explicit and small: adding to it is a deliberate edit (see `proposal-writers.ts`) rather than a
 * consequence of adding a tool.
 */
export type ProposalWriters = Partial<Record<string, ResourceWriter>>;

/** What was done, told to whoever records it (the recommendations loop). */
export type AppliedProposal = {
  websiteId: string;
  userId: string;
  queryId: string;
  /** The recommendation the chat was started from, if any. Unverified: the listener checks it. */
  recommendationId: string | null;
  operation: ProposalOperation;
  proposal: { resource: string; payload: unknown; summary?: { title?: string } };
  /** The resource created or changed. Named `created` for the create case it started with. */
  created: { resource: string; id: string };
};

export type ApplyResult =
  | { ok: true; created: { resource: string; id: string }; operation: ProposalOperation }
  | { ok: false; error: string; code?: ApplyFailureCode };

const OPERATIONS: readonly ProposalOperation[] = ["create", "update", "set_status", "archive"];

const METHOD: Record<Exclude<ProposalOperation, "create">, "update" | "setStatus" | "archive"> = {
  update: "update",
  set_status: "setStatus",
  archive: "archive",
};

/**
 * Applies a stored draft after a person approved it.
 *
 * What makes the approval meaningful rather than decorative:
 *
 * - The payload is read from the stored row, not from the request. A client sending the
 *   payload back could send a different one than the screen showed.
 * - The website on the row must match the website in the URL, so a draft approved for
 *   one site cannot be applied to another — and a change's target is looked up on that
 *   website only, so a target on another site reads as gone.
 * - The confirmer's role is checked here, per resource: settings need an admin, everything
 *   else a member. The role stored on the draft is display only.
 * - A change is refused when its target moved on since the draft was made (stale).
 * - `markProposalApplied` is claimed *before* the write, and its update is conditional on
 *   the draft still being unapplied. Two concurrent confirms both see a pending draft;
 *   only one wins the update, so only one writes. A failed write releases the claim, so the
 *   person can fix what was wrong (or retry a blip) and confirm again.
 */
export class ProposalApplier implements AiProposalApplier {
  constructor(
    private readonly repo: AiRepository,
    private readonly writers: ProposalWriters,
    /** Told after a successful write. Its failure is logged, never surfaced: the change is made. */
    private readonly onApplied?: (applied: AppliedProposal) => Promise<void>,
  ) {}

  async apply(input: {
    userId: string;
    websiteId: string;
    queryId: string;
    /** The confirmer's role on the website, from the route. */
    role: WebsiteRole;
    /** The team-permission check for this request; absent means nothing is narrowed. */
    can?: (permission: string) => boolean;
  }): Promise<ApplyResult> {
    const pending = await this.repo.pendingProposal(input.userId, input.queryId);
    if (!pending) {
      return { ok: false, code: "gone", error: "That draft is no longer available, or was already applied." };
    }

    if (pending.websiteId !== input.websiteId) {
      return { ok: false, error: "That draft belongs to a different website." };
    }

    const proposal = pending.proposal as {
      resource?: string;
      operation?: string;
      target?: { id?: unknown; version?: unknown };
      payload?: unknown;
      summary?: { title?: string };
    };

    // Drafts stored before operations existed are all creates.
    const operation = (proposal.operation ?? "create") as ProposalOperation;
    if (!OPERATIONS.includes(operation)) {
      return { ok: false, error: `Unsupported operation: ${proposal.operation ?? "none"}` };
    }
    const resource = proposal.resource ?? "";
    const writer = this.writers[resource];
    const write = operation === "create" ? writer?.create : writer?.[METHOD[operation]];
    if (!writer || !write || (operation !== "create" && !writer.version)) {
      return { ok: false, error: `Unsupported change: ${operation} ${resource || "none"}` };
    }

    const target = operation === "create" ? null : proposal.target;
    if (target && (typeof target.id !== "string" || typeof target.version !== "string")) {
      return { ok: false, error: "That draft does not say what it changes." };
    }
    if (operation !== "create" && !target) {
      return { ok: false, error: "That draft does not say what it changes." };
    }

    const role = requiredRoleFor(resource, operation);
    if (!roleAtLeast(input.role, role)) {
      return {
        ok: false,
        code: "forbidden",
        error: role === "admin"
          ? "Only the site's owner or an admin can confirm this change."
          : "Viewers cannot confirm changes. Ask a member, admin or the owner to confirm it.",
      };
    }
    const permission = requiredPermissionFor(resource);
    if (permission && input.can && !input.can(permission)) {
      return { ok: false, code: "forbidden", error: "Your team role does not allow this change." };
    }

    // Claimed before the write. Losing this race means another request is already applying
    // it, and the honest answer is that it is done rather than doing it twice.
    const claimed = await this.repo.markProposalApplied(input.userId, input.queryId);
    if (!claimed) {
      return { ok: false, code: "gone", error: "That draft has already been applied." };
    }

    const label = resourceLabel(resource);
    let done: { id: string };
    try {
      if (target) {
        // After the claim, so nothing else confirming this draft can slip between check and write.
        const now = await writer.version!(input.websiteId, target.id as string);
        if (now === null) {
          await this.release(input);
          return { ok: false, code: "gone", error: `The ${label} this draft changes no longer exists on this website.` };
        }
        if (now !== target.version) {
          await this.release(input);
          return {
            ok: false,
            code: "stale",
            error: `This draft is out of date: the ${label} was changed after it was drafted. Ask the assistant to draft it again.`,
          };
        }
        done = await write.call(writer, {
          websiteId: input.websiteId, userId: input.userId, id: target.id as string, payload: proposal.payload,
        } as TargetWriteInput);
      } else {
        done = await (write as NonNullable<ResourceWriter["create"]>).call(writer, {
          websiteId: input.websiteId, userId: input.userId, payload: proposal.payload,
        });
      }
    } catch (err) {
      await this.release(input);
      log.warn({ msg: "proposal_apply_failed", query_id: input.queryId, resource, operation, err: String(err) });
      return { ok: false, error: err instanceof Error ? err.message.slice(0, 300) : `Could not apply the ${label} change.` };
    }

    const result = { resource, id: done.id };
    // A recommendation's own status change is the recommendation loop acting on itself: not news to it.
    if (this.onApplied && resource !== "recommendation") {
      try {
        await this.onApplied({
          websiteId: input.websiteId,
          userId: input.userId,
          queryId: input.queryId,
          recommendationId: pending.recommendationId ?? null,
          operation,
          proposal: { resource, payload: proposal.payload, summary: proposal.summary },
          created: result,
        });
      } catch (err) {
        log.warn({ msg: "proposal_applied_listener_failed", query_id: input.queryId, err: String(err) });
      }
    }
    return { ok: true, created: result, operation };
  }

  /** Puts a claimed draft back, so it can be confirmed again. Logged, never thrown. */
  private async release(input: { userId: string; queryId: string }): Promise<void> {
    try {
      await this.repo.releaseProposalClaim(input.userId, input.queryId);
    } catch (err) {
      log.error({ msg: "proposal_claim_release_failed", query_id: input.queryId, err: String(err) });
    }
  }
}
