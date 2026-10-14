import { sql } from "../../../db";
import type {
  RetentionCutoffs,
  RetentionOptions,
  RetentionPurge,
  RetentionTarget,
} from "../../../platform/retention/interfaces";
import { affectedRows } from "../../../platform/retention";

/**
 * Ages out AI Mode history (each question, the SQL it ran and the answer, which can quote the
 * site's analytics), the daily dashboard insights and heatmap insight wording. Kept for the analytics window, like the data
 * they read.
 */
export class AiRetentionPurge implements RetentionPurge {
  readonly name = "ai";

  async purge(
    target: RetentionTarget,
    cutoffs: RetentionCutoffs,
    _options: RetentionOptions,
  ): Promise<Record<string, number>> {
    const deleted = await sql`
      DELETE FROM ai_queries
      WHERE website_id = ${target.websiteId}::uuid
        AND created_at < ${cutoffs.analytics}
    `;
    // Insights are counts and a few sentences, kept for the same window as the data they describe.
    const insights = await sql`
      DELETE FROM ai_insights
      WHERE website_id = ${target.websiteId}::uuid
        AND created_at < ${cutoffs.analytics}
    `;
    // Heatmap wording is regenerated daily while in use; old rows are pages nobody opened since.
    const heatmapInsights = await sql`
      DELETE FROM ai_heatmap_insights
      WHERE website_id = ${target.websiteId}::uuid
        AND created_at < ${cutoffs.analytics}
    `;
    // Anomalies are counts and sentences about the data they were found in: the same window.
    const anomalies = await sql`
      DELETE FROM ai_anomalies
      WHERE website_id = ${target.websiteId}::uuid
        AND detected_at < ${cutoffs.analytics}
        AND status = 'resolved'
    `;
    // Recommendations that are finished with (dismissed, expired, measured) and untouched since the
    // cutoff. Open and in-progress ones stay: their impact report is still being written.
    const recommendations = await sql`
      DELETE FROM ai_recommendations
      WHERE website_id = ${target.websiteId}::uuid
        AND status IN ('dismissed', 'expired', 'measured')
        AND updated_at < ${cutoffs.analytics}
    `;
    return {
      aiRecommendationRows: affectedRows(recommendations),
      aiQueryRows: affectedRows(deleted),
      aiInsightRows: affectedRows(insights),
      aiHeatmapInsightRows: affectedRows(heatmapInsights),
      aiAnomalyRows: affectedRows(anomalies),
    };
  }
}
