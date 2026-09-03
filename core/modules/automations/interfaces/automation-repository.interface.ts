import type {
  AutomationDailyRuns,
  AutomationExecutionRow,
  AutomationListItem,
  AutomationRow,
  AutomationStats,
  CreateAutomationInput,
  UpdateAutomationInput,
} from "./automation.interface";

/**
 * Persistence for automations and their execution log.
 *
 * The service depends on this rather than on Drizzle, which is what lets its
 * tests run with an in-memory double and no database.
 * `PostgresAutomationRepository` is the production implementation.
 *
 * **Every `websiteId` here is the resolved `websites.id` UUID**, never the loose
 * "UUID or websiteId" reference the HTTP layer accepts and never the short public
 * `websiteId`. `automations.website_id` is a uuid column: passing a `websiteId` would
 * not error, it would match zero rows and read as "this website has no
 * automations". Resolution happens once, in the service, so every method here can
 * assume a canonical id.
 *
 * Methods scoped by `(websiteId, automationId)` rather than by id alone: the id
 * is a UUID the caller supplies, and scoping the predicate is what stops one
 * website's request from touching another's row.
 */
export interface AutomationRepository {
  /** Automations with their counters joined in, newest first. */
  listWithStats(websiteId: string): Promise<AutomationListItem[]>;

  /** Active automations only, for the tracker payload. */
  listActive(websiteId: string): Promise<AutomationRow[]>;

  /**
   * Active automations ordered by ascending `priority`, for evaluation.
   *
   * Separate from `listActive` because the order is load-bearing: the first
   * automation whose conditions match gets to record its impression first, and
   * frequency caps are judged in that order.
   */
  listActiveByPriority(websiteId: string): Promise<AutomationRow[]>;

  /** `null` when no automation with that id belongs to this website. */
  findById(websiteId: string, automationId: string): Promise<AutomationRow | null>;

  create(
    websiteId: string,
    userId: string,
    input: CreateAutomationInput,
  ): Promise<AutomationRow>;

  /** `null` when the row no longer exists. Absent fields are left untouched. */
  update(
    websiteId: string,
    automationId: string,
    patch: UpdateAutomationInput,
  ): Promise<AutomationRow | null>;

  /** Flip `is_active`. `null` when the automation does not exist. */
  toggleActive(websiteId: string, automationId: string): Promise<AutomationRow | null>;

  /**
   * Delete the automation and its event log. Silent when already gone.
   *
   * The event rows go first: `automation_events` has no foreign key to
   * `automations`, so deleting the parent first would orphan them permanently.
   */
  delete(websiteId: string, automationId: string): Promise<void>;

  /**
   * Delete several automations owned by this website, and their events.
   *
   * One call rather than a loop over `delete`: that cost two statements per id, and a
   * bulk delete of fifty automations meant a hundred round trips.
   *
   * Ids that do not exist, or that belong to another website, match nothing — so a
   * caller cannot use this to reach outside `websiteId`, and a stale id in the list does
   * not fail the rest.
   */
  deleteMany(websiteId: string, automationIds: string[]): Promise<void>;

  /** Most recent execution rows, newest first, capped by `limit`. */
  listExecutions(automationId: string, limit: number): Promise<AutomationExecutionRow[]>;

  /** Aggregate counters over the whole event log for one automation. */
  getStats(automationId: string): Promise<AutomationStats>;

  /**
   * Runs per day over a fixed 14-day window, padded so every bucket is present.
   *
   * The window is not a parameter because `INTERVAL` cannot take a bind
   * parameter, and the endpoint has only ever drawn 14 days.
   */
  getDailyRuns(automationId: string): Promise<AutomationDailyRuns[]>;
}
