import type { AuthedRouter } from "../../../platform/http/router";
import type { UsageCounter } from "../../../platform/usage";
import type { RetentionPurge } from "../../../platform/retention";
import type {
  AutomationEvaluation,
  AutomationTrackerSettings,
  AutomationTriggerWriter,
} from "./index";

/** Everything the automations module offers. */
export interface AutomationsModule {
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

  /** Deletion of this module's own rows. */
  retention: RetentionPurge;

  /** This module's contribution to the per-user usage report. */
  usage: UsageCounter;

  routes: AuthedRouter;
}
