/**
 * Public contracts for the automations module.
 *
 * Five capabilities, deliberately not one `IAutomationsModule`, because five
 * different callers reach this module and they overlap in nothing but the table:
 *
 * - `AutomationCrud` / `AutomationInsights` — the dashboard, authenticated, one
 *   website at a time.
 * - `AutomationTrackerSettings` — the anonymous tracker init endpoint, once per
 *   session, one indexed read.
 * - `AutomationEvaluation` / `VisitorProfileWriter` — the ingest edge, per
 *   trigger, the only surface with outbound side effects.
 * - `AutomationTriggerWriter` — the ingest flush path.
 *   `ingestAutomationTriggersBatch` used to be imported straight out of
 *   `repositories/automation-batch.repository.ts` by the ingest queue; now that
 *   ingest has a composed graph, that function is wrapped behind this port and the
 *   import is gone.
 * - `AutomationEventSubscriber` — automations as a consumer of other modules'
 *   events, which is the seam a scheduled or ingest-driven trigger would use.
 *
 * Peer modules should import from here and no deeper; the services and
 * repositories behind these types are internal.
 */
export type {
  AutomationCrud,
  AutomationDailyRuns,
  AutomationExecutionRow,
  AutomationInsights,
  AutomationListItem,
  AutomationRow,
  AutomationStats,
  CreateAutomationInput,
  UpdateAutomationInput,
} from "./automation.interface";

export type { AutomationRepository } from "./automation-repository.interface";

export type { AutomationTrackerSettings } from "./automation-settings.interface";

export type { AutomationTriggerWriter } from "./automation-ingest.interface";

export type {
  VisitorProfileWrite,
  VisitorProfileWriter,
} from "./visitor-profile.interface";

export type {
  AutomationEvaluation,
  ClientAction,
  EvaluateRequest,
  EvaluateResult,
  IdentifyPayload,
} from "./automation-evaluation.interface";

/** The whole module surface, as a peer receives it at composition time. */
export type { AutomationsModule } from "./automations.module";
