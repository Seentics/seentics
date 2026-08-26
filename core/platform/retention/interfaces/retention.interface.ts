/**
 * The retention sweep's contract with the modules that own the data.
 *
 * Retention is the one place in the system that has to touch every module's tables,
 * which made it the worst boundary violation left: a single 200-line function issuing
 * `DELETE FROM analytics_events`, `automation_events`, `session_replays`,
 * `heatmap_points` and `heatmap_page_snapshots` — five tables owned by four modules
 * that knew nothing about it. A schema change in any of them broke deletion silently,
 * in code no one running that module would think to look at.
 *
 * Inverted: retention owns the *policy* (how long each kind of data lives, including
 * per-website overrides) and each module owns the *deletion* of its own rows.
 */

/** The website being swept, with both identifiers its tables might be keyed by. */
export type RetentionTarget = {
  /** `websites.id`. Keys `heatmap_points`, `heatmap_page_snapshots`, `automations`. */
  websiteUuid: string;
  /** `websites.site_id`. Keys `analytics_events`; `session_replays` may use either. */
  siteId: string;
};

/**
 * Effective cut-offs for one website, after per-website overrides are merged.
 *
 * Four separate dates rather than one because the kinds age out at different rates:
 * replays and heatmap images are large and short-lived, funnel and automation history
 * is small and kept longer.
 */
export type RetentionCutoffs = {
  /** General analytics events older than this go. */
  analytics: Date;
  /** Funnel events and automation execution history. */
  funnelAutomation: Date;
  /** Session recordings, including their stored chunks. */
  replay: Date;
  /** Heatmap aggregates and layout snapshots. */
  heatmap: Date;
};

export type RetentionOptions = {
  /**
   * Rows per batch for the deletions that page.
   *
   * Recordings delete in batches because each row also implies object-storage
   * deletes; an unbounded sweep would hold a transaction open across thousands of
   * network calls.
   */
  batchSize: number;
  /** Object-storage bucket holding recordings and heatmap snapshots. */
  bucket: string;
};

/**
 * One module's share of a retention sweep.
 *
 * Implementations must be safe to call repeatedly — the sweep runs daily and may be
 * triggered manually on top of that — and must not throw for a website that simply
 * has nothing to delete.
 *
 * Failures should be logged and swallowed per website rather than propagated: one
 * site's unreachable S3 prefix must not stop the sweep for every other site, which is
 * the behaviour the original single-function version had.
 */
export interface RetentionPurge {
  /** Stable identifier, used in logs and to attribute returned counts. */
  readonly name: string;

  /**
   * Delete this module's aged rows for one website.
   *
   * Returns counts keyed by metric name; the orchestrator sums them across websites
   * into the sweep total. Keys are the module's own choice and appear verbatim in the
   * reported stats, so they should stay stable — dashboards and the internal endpoint
   * read them.
   */
  purge(
    target: RetentionTarget,
    cutoffs: RetentionCutoffs,
    options: RetentionOptions,
  ): Promise<Record<string, number>>;
}
