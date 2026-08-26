/**
 * Public contracts for the automations module.
 *
 * Four capabilities, deliberately not one `IAutomationsModule`, because four
 * different callers reach this module and they overlap in nothing but the table:
 *
 * - `AutomationCrud` / `AutomationInsights` — the dashboard, authenticated, one
 *   website at a time.
 * - `AutomationTrackerSettings` — the anonymous tracker init endpoint, once per
 *   session, one indexed read.
 * - `AutomationEvaluation` / `VisitorProfileWriter` — the ingest edge, per
 *   trigger, the only surface with outbound side effects.
 * - `AutomationEventSubscriber` — automations as a consumer of other modules'
 *   events, which is the seam a scheduled or ingest-driven trigger would use.
 *
 * Peer modules should import from here and no deeper; the services and
 * repositories behind these types are internal.
 *
 * The ingest write path is the one capability with no interface here:
 * `ingestAutomationTriggersBatch` stays a plain function in
 * `repositories/automation-batch.repository.ts` because the ingest queue imports
 * it directly and has no constructor to inject into. When ingest becomes a
 * module with a composed graph, that function is the thing to wrap.
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

export type {
  AutomationEvaluation,
  ClientAction,
  EvaluateRequest,
  EvaluateResult,
  IdentifyPayload,
} from "./automation-evaluation.interface";
