/**
 * Per-user usage counts, and the modules' contract with the thing that reports them.
 *
 * This is the same inversion as `RetentionPurge`, for the same reason. One function in
 * `platform/lib/user-resource-counts.ts` ran seven `COUNT(*)` queries against seven
 * tables owned by six different modules — so a schema change in any of them broke
 * usage reporting silently, in shared code no one owning that module would look at.
 *
 * Inverted: this layer owns the *shape* of the report and resolves the user's scope
 * once; each module owns counting its own rows.
 */

/**
 * The window and the websites a count applies to, resolved once by the reporter.
 *
 * Four of the seven original queries each re-ran `SELECT … FROM websites WHERE
 * user_id = …` as a subquery. Resolving it here means one lookup instead of four, and
 * — more importantly — means a counter never has to touch the websites table.
 */
export type UsageScope = {
  userId: string;

  /** `websites.id` for every site the user owns. Empty means "count nothing". */
  websiteUuids: readonly string[];

  /**
   * `websites.website_id` for the same sites.
   *
   * Both forms are carried because the tables disagree: `analytics_events` is keyed by
   * `website_id`, `heatmap_points` by the UUID, and `session_replays` has historically
   * stored either.
   */
  websiteIds: readonly string[];

  /** Start of the current calendar month, UTC. For the month-scoped counts. */
  monthStart: Date;
};

/**
 * One number in the usage report.
 *
 * `key` is part of the external contract — the response body is consumed by the
 * billing gateway — so it must not change when a module is renamed or refactored.
 */
export interface UsageCounter {
  readonly key: string;

  /**
   * Count this module's rows within the scope.
   *
   * Must return 0 rather than throwing for an empty scope; a user with no websites is
   * a normal state, not an error.
   */
  countForUser(scope: UsageScope): Promise<number>;
}
