import type { LaneSpec } from "../../ingest/interfaces";
import type { AuthedRouter } from "../../../platform/http/router";
import type { UsageCounter } from "../../../platform/usage";
import type { RetentionPurge } from "../../../platform/retention";
import type {
  AutomationEvaluation,
  AutomationTrackerSettings,
  AutomationTriggerWriter,
  VisitorProfileWriter,
} from "./index";

/** Everything the automations module offers. */
export interface AutomationsModule {
  /** This module's ingest lanes — trigger rows and visitor profiles. */
  lanes: { automations: LaneSpec; profiles: LaneSpec };

  /** Checks a draft definition without creating it. See `AutomationDraftValidator`. */
  draftValidator: AutomationDraftValidator;

  /** Creates an automation from an already-validated draft. See `AutomationDraftWriter`. */
  draftWriter: AutomationDraftWriter;

  /** Active automations for the tracker's `/init`. One indexed read per session. */
  trackerSettings: AutomationTrackerSettings;

  /**
   * Server-side trigger evaluation, for the ingest edge.
   *
   * The only surface here with outbound side effects — it can fire a webhook — which
   * is why it is separate from the read capabilities either side of it.
   */
  evaluation: AutomationEvaluation;

  /** Where ingest hands a flushed batch of trigger rows. */
  triggers: AutomationTriggerWriter;

  /**
   * Where ingest hands the visitor profile built from a `/collect` batch.
   *
   * Separate from `triggers` because it is written per request rather than per flush,
   * and it is what gives conditions anything to say about the person rather than the page.
   */
  visitorProfiles: VisitorProfileWriter;

  /** Deletion of this module's own rows. */
  retention: RetentionPurge;

  /** This module's contribution to the per-user usage report. */
  usage: UsageCounter;

  routes: AuthedRouter;
}

/**
 * Validates a draft automation definition without creating anything.
 *
 * Exposed as a port because the AI module needs to know whether a draft it is about to
 * show someone would actually save, and a module may only reach a peer through its
 * interfaces — importing the Zod schema directly is the boundary violation the
 * architecture test catches.
 *
 * Returning the parsed definition rather than a boolean matters: the caller stores what
 * validation produced, so approving a draft later cannot fail on a field that was
 * defaulted or stripped during the check.
 */
export interface AutomationDraftValidator {
  /** The trigger and action names the server accepts, for a caller building a draft. */
  vocabulary(): { triggerTypes: readonly string[]; actionTypes: readonly string[] };

  validateDefinition(
    definition: unknown,
  ): { ok: true; definition: unknown } | { ok: false; error: string };
}

/**
 * Creates an automation someone approved.
 *
 * Narrow on purpose: this is the whole write surface another module can reach, and the
 * AI module is the only caller. A general "create automation" port would let any future
 * consumer write here without the approval step this one exists to serve.
 *
 * Always inactive. Whatever the payload says, an automation created this way does not
 * start running against live visitors until a person enables it.
 */
export interface AutomationDraftWriter {
  createFromProposal(input: {
    websiteId: string;
    userId: string;
    payload: unknown;
  }): Promise<{ id: string }>;
}
