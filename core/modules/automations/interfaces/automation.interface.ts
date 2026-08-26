/**
 * The automations module's dashboard-facing surface.
 *
 * Split by capability rather than exposed as one `IAutomationsModule`: the
 * dashboard edits automations, the tracker asks which ones are live, and the
 * evaluation path fires them. Those three have different callers, different
 * failure modes and different blast radius — the evaluation path runs
 * unauthenticated on the ingest edge and must not be able to reach `delete`.
 *
 * Read models are returned in the exact shape the web client already parses.
 * Note that `list` is snake_case with an embedded `stats` object while the single
 * -automation endpoints return the camelCase row: that inconsistency is part of
 * the live API contract, so it is preserved here rather than tidied. Normalizing
 * it is a client change, not a refactor.
 */

/**
 * One row of `automations`, camelCase as the single-automation endpoints return
 * it.
 *
 * `websiteId` is the website **UUID** (`websites.id`), never the short public
 * `siteId` — the `automations` table is keyed by the UUID. Both are `string`, so
 * nothing but discipline stops a mix-up; see `AutomationRepository` on why
 * resolution happens exactly once, above this type.
 */
export type AutomationRow = {
  id: string;
  websiteId: string;
  userId: string;
  name: string;
  definition: Record<string, unknown>;
  isActive: boolean;
  priority: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Aggregate counters for one automation, as the dashboard renders them. */
export type AutomationStats = {
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  /** Percentage with one decimal. 100 when there were runs but no action rows. */
  successRate: number;
  last30Days: number;
};

/**
 * One automation in the list view: snake_case, with its counters joined in.
 *
 * The counters come from the same query as the row on purpose — the list is the
 * automations landing page, and a per-automation stats query there is an N+1.
 */
export type AutomationListItem = {
  id: string;
  website_id: string;
  name: string;
  definition: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  stats: AutomationStats;
};

/** One `automation_events` row, returned verbatim by the executions endpoint. */
export type AutomationExecutionRow = {
  id: string;
  automationId: string;
  recordType: string;
  triggerEvent: string | null;
  runId: string | null;
  status: string;
  visitorId: string | null;
  sessionId: string | null;
  pageUrl: string | null;
  actionKey: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  detail: Record<string, unknown> | null;
  createdAt: Date;
};

/** Runs-per-day for the last 14 days, bucketed for the sparkline. */
export type AutomationDailyRuns = {
  /** `D1`…`D14`, oldest first — a position label, not a date. */
  day: string;
  runs: number;
};

export type CreateAutomationInput = {
  name: string;
  definition: Record<string, unknown>;
  is_active?: boolean;
};

/**
 * Fields an update may change, all optional.
 *
 * Absence means "leave alone", which is why this is a `Partial` of the writable
 * fields rather than a `Partial<AutomationRow>` — the latter would invite a
 * caller to try to move an automation between websites.
 */
export type UpdateAutomationInput = Partial<{
  name: string;
  definition: Record<string, unknown>;
  is_active: boolean;
}>;

/**
 * Create, read, update and delete — the dashboard's surface.
 *
 * Every method takes a loose `websiteRef` (a UUID or a `siteId`, whichever the
 * URL carried) and resolves it once. Authorization is *not* this interface's
 * job: routes check the caller's role against the websites module before
 * calling, and the implementation assumes that already happened.
 */
export interface AutomationCrud {
  /** Every automation for the website with its counters, newest first. */
  list(websiteRef: string): Promise<AutomationListItem[]>;

  create(
    websiteRef: string,
    userId: string,
    input: CreateAutomationInput,
  ): Promise<AutomationRow>;

  /** `null` when no automation with that id belongs to this website. */
  get(websiteRef: string, automationId: string): Promise<AutomationRow | null>;

  /** `null` when there was nothing to update. */
  update(
    websiteRef: string,
    automationId: string,
    patch: UpdateAutomationInput,
  ): Promise<AutomationRow | null>;

  /** Idempotent: deleting an automation that is already gone is not an error. */
  remove(websiteRef: string, automationId: string): Promise<void>;

  /** Same as `remove`, one automation at a time. Partial success is possible. */
  bulkDelete(websiteRef: string, automationIds: string[]): Promise<void>;

  /** Flip `is_active`. `null` when the automation does not exist. */
  toggle(websiteRef: string, automationId: string): Promise<AutomationRow | null>;
}

/**
 * The execution log and its aggregates.
 *
 * Separate from `AutomationCrud` because it is pure history over
 * `automation_events` — a growing, append-only table that a reporting reader
 * could serve from a replica without any of the write path coming along. A
 * consumer that only draws charts should not be handed `remove`.
 */
export interface AutomationInsights {
  /** Most recent runs, newest first. `null` when the automation does not exist. */
  executions(
    websiteRef: string,
    automationId: string,
  ): Promise<AutomationExecutionRow[] | null>;

  /** `null` when the automation does not exist — distinct from all-zero counters. */
  stats(websiteRef: string, automationId: string): Promise<AutomationStats | null>;

  /** 14 buckets, oldest first. `null` when the automation does not exist. */
  dailyStats(
    websiteRef: string,
    automationId: string,
  ): Promise<AutomationDailyRuns[] | null>;
}
