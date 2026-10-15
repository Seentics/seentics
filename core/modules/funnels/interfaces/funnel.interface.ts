/**
 * The funnels module's public surface.
 *
 * Split by capability rather than exposed as one `IFunnelsModule`, because the four
 * consumers of this module want genuinely different things and two of them read
 * different tables under different identifiers:
 *
 * - the dashboard lists and opens funnel definitions (`funnels`, keyed by website UUID)
 * - the builder creates, edits and deletes them (same table, write side)
 * - the funnel report aggregates tracker events (`analytics_events`, keyed by `websiteId`)
 * - the tracker asks, on every page load, which funnels are live
 *
 * That last one is why the split is not cosmetic: the tracker is unauthenticated
 * and hit on every session, and its constructor should make it impossible to reach
 * a mutation.
 */

/**
 * A funnel step, as the builder and the tracker both understand it.
 *
 * `snake_case` because this type is the wire shape, not an internal one — see the
 * note on `Funnel`. Steps are stored as free-form JSONB, so the fields are
 * normalized on read (`step_type` vs `stepType`, and so on) rather than trusted.
 */
export type FunnelStep = {
  id: string;
  name: string;
  order: number;
  step_type: string;
  page_path?: string | undefined;
  event_type?: string | undefined;
  match_type: "exact" | "contains" | "starts_with" | "regex";
};

/**
 * A funnel definition.
 *
 * Deliberately `snake_case` and deliberately carrying a zeroed `stats` block: this
 * is the exact JSON the web client already parses, and the funnel list renders
 * `stats` before the per-funnel report has loaded. Normalizing to camelCase here
 * would mean a presenter on every route plus a coordinated web-client release, so
 * the wire shape is the module's domain shape and the mapping stops at the
 * repository. Same reasoning as the recordings module's `replay`/`recording` split.
 */
export type Funnel = {
  id: string;
  /** `websites.id` — the UUID, which is what the `funnels` table is keyed by. */
  website_id: string;
  user_id: string;
  name: string;
  description: string;
  is_active: boolean;
  steps: FunnelStep[];
  /** Hours allowed between one step and the next; `null` is no limit. */
  conversion_window_hours: number | null;
  created_at: string;
  updated_at: string;
  /** Placeholder counters; the real numbers come from `FunnelPerformance`. */
  stats: {
    totalEntries: number;
    completions: number;
    conversionRate: number;
    stepBreakdown: { stepOrder: number; count: number; dropoffCount: number; dropoffRate: number }[];
  };
};

/** Conversion figures for one funnel over a time window. */
export type FunnelReport = {
  totalEntries: number;
  completions: number;
  /** Percentage with one decimal, e.g. `12.5`. */
  conversionRate: number;
  stepBreakdown: {
    stepOrder: number;
    stepName: string;
    count: number;
    dropoffCount: number;
    dropoffRate: number;
  }[];
  /** Things the owner should know about how this was counted, such as a step that cannot match. */
  warnings?: string[];
};

export type CreateFunnelInput = {
  name: string;
  description?: string;
  steps?: Record<string, unknown>[];
  is_active?: boolean;
  conversion_window_hours?: number | null;
};

/**
 * Fields a funnel update may change, all optional.
 *
 * Absence means "leave alone", which is why this is not `Partial<Funnel>` — a
 * `Partial` would let a caller blank out `steps` by passing `undefined`, and the
 * builder does exactly that when it re-submits an unchanged form.
 */
export type UpdateFunnelInput = {
  name?: string;
  description?: string;
  is_active?: boolean;
  steps?: Record<string, unknown>[];
  conversion_window_hours?: number | null;
};

/**
 * Read access to funnel definitions, for the dashboard.
 *
 * Every method takes the loose `websiteRef` the URL carries (UUID or `websiteId`) and
 * resolves it internally — see `FunnelService`. Callers must not pre-resolve, or
 * the resolution happens twice.
 */
export interface FunnelQuery {
  /** Newest first. Empty when the website is unknown. */
  list(websiteRef: string): Promise<Funnel[]>;

  /** `null` when no funnel with that id belongs to this website. */
  get(websiteRef: string, funnelId: string): Promise<Funnel | null>;
}

/**
 * Write access, kept separate so the tracker and the report path cannot reach it.
 *
 * Access control is the route's job, not this interface's: by the time a mutation
 * is called the caller's role has already been checked, exactly as in the
 * recordings and analytics modules.
 */
export interface FunnelMutations {
  create(websiteRef: string, userId: string, input: CreateFunnelInput): Promise<Funnel>;

  /** `null` when the funnel does not exist on this website. */
  update(websiteRef: string, funnelId: string, input: UpdateFunnelInput): Promise<Funnel | null>;

  /** Silent when there was nothing to delete — deleting twice is not an error. */
  remove(websiteRef: string, funnelId: string): Promise<void>;

  /** Bulk variant of `remove`. An empty list is a no-op, not a full-table delete. */
  bulkRemove(websiteRef: string, funnelIds: string[]): Promise<void>;
}

/**
 * The funnel report.
 *
 * Separate from `FunnelQuery` because it reads a different table under a different
 * identifier: definitions live in `funnels` keyed by the website UUID, while the
 * events being counted live in `analytics_events` keyed by the short `websiteId`.
 * Both identifiers are `string`, so nothing but this boundary stops the two from
 * being crossed — and crossing them returns zeroes rather than an error.
 */
export interface FunnelPerformance {
  reports(websiteRef: string, days?: number): Promise<Record<string, FunnelReport>>;
  /**
   * Conversion figures over the last `days` days, or `null` when the funnel does
   * not exist. `days` is clamped to 1..366 by the implementation.
   */
  report(websiteRef: string, funnelId: string, days?: number | undefined): Promise<FunnelReport | null>;
  /**
   * The same figures over a fixed window, for before-and-after comparisons (the AI module's
   * recommendation impact reports). Counted from page views and events, so a funnel created
   * today still has figures for the weeks before it existed. `null` when the funnel does not exist.
   */
  reportBetween(websiteRef: string, funnelId: string, from: Date, to: Date): Promise<FunnelReport | null>;
}

/**
 * A funnel the AI assistant drafted, in the wire shape `create` takes.
 *
 * Steps are the stored JSONB form (`step_type`, `page_path` or `event_type`, `match_type`), built by
 * the draft tool from a flat spec so the model never writes this shape itself.
 */
export type FunnelDraft = {
  name: string;
  description?: string;
  steps: Record<string, unknown>[];
  conversion_window_hours?: number | null;
};

/** A funnel as the assistant reads it before drafting a change to it. */
export type FunnelSnapshot = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  steps: Record<string, unknown>[];
  conversion_window_hours: number | null;
  /** `updated_at`, ISO: the version a drafted change is checked against when it is confirmed. */
  version: string;
};

/** The fields a drafted funnel change may set. Absent means "leave alone"; a null window clears it. */
export type FunnelDraftPatch = {
  name?: string;
  description?: string;
  steps?: Record<string, unknown>[];
  conversion_window_hours?: number | null;
};

/**
 * Validates, creates and changes funnels someone approved in the assistant.
 *
 * The AI module's whole write surface into funnels: `validate` runs the same checks `create` does,
 * so a draft shown for approval would save; the writes go through the definition service's own
 * `create` and `update`, which validate again. No delete: a change can switch a funnel off, never
 * remove it.
 */
export interface FunnelDraftPort {
  validate(draft: FunnelDraft): Promise<{ ok: true; draft: FunnelDraft } | { ok: false; error: string }>;
  createFromProposal(input: { websiteId: string; userId: string; payload: unknown }): Promise<{ id: string }>;

  /** `null` when no funnel with that id belongs to this website. */
  get(websiteId: string, funnelId: string): Promise<FunnelSnapshot | null>;
  /** A patch checked as the whole funnel it would produce, with `validate`'s rules. */
  validatePatch(current: FunnelSnapshot, patch: FunnelDraftPatch): Promise<{ ok: true; patch: FunnelDraftPatch } | { ok: false; error: string }>;
  /** Re-validated against the funnel as it is now, then `update`. Throws when gone or invalid. */
  updateFromProposal(input: { websiteId: string; funnelId: string; payload: unknown }): Promise<{ id: string }>;
  setActiveFromProposal(input: { websiteId: string; funnelId: string; active: boolean }): Promise<{ id: string }>;
}

/**
 * The funnels the tracker should evaluate.
 *
 * Separate from `FunnelQuery` because the caller is anonymous and this runs on every
 * session start: it must expose active funnels and nothing else, and the constructor
 * of anything holding it should make a mutation unreachable.
 *
 * Controllers resolve public website references before calling this capability.
 */
/** A funnel as the tracker receives it: what it matches steps with, nothing more. */
export type TrackerFunnel = { id: string; name: string; steps: Array<Record<string, unknown>> };

export interface FunnelTrackerConfig {
  /**
   * For `/tracker/init`, which has already loaded the website row — so this takes
   * the resolved `websites.id` UUID and does no lookup. Re-resolving here would add
   * a query to the hottest public endpoint in the product.
   */
  activeForTracker(websiteId: string): Promise<TrackerFunnel[]>;

}

/**
 * Tracker `type` values that belong to funnels rather than to plain analytics.
 *
 * Lives on the module's public surface because the ingest path needs it to route a
 * `/collect` batch, and routing on a hardcoded copy of these strings is how the
 * two ends drift. Events with these types are persisted to `analytics_events` and
 * are what `FunnelPerformance` counts.
 */
export const TRACKER_FUNNEL_EVENT_TYPES: ReadonlySet<string> = new Set([
  "funnel_step",
  "funnel_complete",
]);

/**
 * One bucket of the step aggregation: a step index (or `-1`) and its distinct visitors.
 *
 * Declared here even though analytics runs the query, because the shape is a funnels
 * concept — `-1` meaning "completed" is this module's encoding. `AnalyticsFunnelEvents`
 * declares the same shape structurally rather than importing this, so neither module's
 * interfaces depend on the other's.
 */
export type FunnelStepCount = { step_order: number | null; cnt: number };
