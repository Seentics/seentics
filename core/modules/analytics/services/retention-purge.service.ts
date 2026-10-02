import { sql } from "../../../db";
import type {
  RetentionCutoffs,
  RetentionOptions,
  RetentionPurge,
  RetentionTarget,
} from "../../../platform/retention/interfaces";
import { affectedRows } from "../../../platform/retention";

/**
 * Deletes a website's aged analytics: raw events, and the summaries built from them.
 *
 * Funnel events and general events age out on different clocks, so they are two
 * statements over the same table rather than one. The predicates are complementary and
 * deliberately exhaustive: the general branch matches `event_type IS NULL` as well as
 * anything not in the funnel set, so a row with no type is still eligible instead of
 * living forever.
 *
 * The summaries — daily and hourly rollups, orders, per-day event counts, visitors'
 * first-seen days — age out on the analytics clock too. Raw events leave Postgres at 31
 * days anyway (db/sql/038), but the summaries are what a long range reads, and they used
 * to be kept forever whatever the plan said (a free site's 30 days included).
 *
 * In one transaction with TimescaleDB's decompression limit lifted: past 48 hours raw
 * events are compressed, and a delete there decompresses the batches it touches —
 * more than the default 100,000 rows for a large site, which failed the statement.
 * Elsewhere the setting is an unused placeholder.
 */
export class AnalyticsRetentionPurge implements RetentionPurge {
  readonly name = "analytics";

  async purge(
    target: RetentionTarget,
    cutoffs: RetentionCutoffs,
    _options: RetentionOptions,
  ): Promise<Record<string, number>> {
    // Keyed by the short website_id — `analytics_events.website_id` is text, not the UUID.
    const websiteId = target.websiteId;
    const cutoffDay = cutoffs.analytics.toISOString().slice(0, 10);

    return sql.begin(async (tx) => {
      await tx`SET LOCAL timescaledb.max_tuples_decompressed_per_dml_transaction = 0`;

      const funnel = await tx`
        DELETE FROM analytics_events
        WHERE website_id = ${websiteId}
          AND event_type IN ('funnel_step', 'funnel_complete')
          AND occurred_at < ${cutoffs.funnelAutomation}
      `;

      const general = await tx`
        DELETE FROM analytics_events
        WHERE website_id = ${websiteId}
          AND (
            event_type IS NULL
            OR event_type NOT IN ('funnel_step', 'funnel_complete')
          )
          AND occurred_at < ${cutoffs.analytics}
      `;

      // Orders and event counts exist everywhere (039, 040); the rollups only where the
      // `hll` extension let 031 create them.
      const orders = await tx`DELETE FROM analytics_revenue_orders WHERE website_id = ${websiteId} AND day < ${cutoffDay}::date`;
      await tx`DELETE FROM analytics_event_counts WHERE website_id = ${websiteId} AND day < ${cutoffDay}::date`;

      let summaryRows = 0;
      const [rollups] = await tx<{ ok: boolean }[]>`SELECT to_regclass('analytics_rollup_daily') IS NOT NULL AS ok`;
      if (rollups?.ok) {
        const daily = await tx`DELETE FROM analytics_rollup_daily WHERE website_id = ${websiteId} AND day < ${cutoffDay}::date`;
        const hourly = await tx`DELETE FROM analytics_rollup_hourly WHERE website_id = ${websiteId} AND hour < ${cutoffs.analytics}`;
        const firstSeen = await tx`
          DELETE FROM analytics_rollup_visitor_first_seen WHERE website_id = ${websiteId} AND first_day < ${cutoffDay}::date
        `;
        summaryRows = affectedRows(daily) + affectedRows(hourly) + affectedRows(firstSeen);
      }

      return {
        analyticsFunnelRows: affectedRows(funnel),
        analyticsGeneralRows: affectedRows(general),
        analyticsSummaryRows: summaryRows + affectedRows(orders),
      };
    });
  }
}
