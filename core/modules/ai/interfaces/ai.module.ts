import type { AuthedRouter } from "../../../platform/http/router";
import type { RetentionPurge } from "../../../platform/retention";
import type { UsageCounter } from "../../../platform/usage";
import type { RunStats } from "../insights/service";
import type { DigestStats } from "../digest/runner";
import type { AnomalyRunStats } from "../anomalies/service";
import type { RecommendationRunStats } from "../recommendations/service";
import type { HeatmapInsightNarrator } from "../../heatmaps/interfaces";
import type { SessionSummarizer } from "../../recordings/interfaces";

/**
 * Everything the AI module offers: its routes, and nothing else.
 *
 * AI is purely a consumer — it reads through other modules' query surfaces and
 * exposes no capability anything else needs. The interface exists anyway so the
 * composition root names a type rather than a class, and so adding a capability later
 * is a change to this file rather than to the root.
 */
export interface AiModule {
  /** This module's contribution to the per-user usage report. */
  usage: UsageCounter;
  /** Ages out AI Mode history with the analytics it read. */
  retention: RetentionPurge;

  routes: AuthedRouter;

  /** The scheduled job that writes each site's daily insight. Absent work is skipped, never failed. */
  insights: { runDaily(): Promise<RunStats> };

  /**
   * The scheduled job that hands each site's weekly digest to the gateway to mail.
   * `enabled` is false without a gateway to send it through; `runWeekly` never throws.
   */
  digest: { enabled: boolean; runWeekly(): Promise<DigestStats> };

  /**
   * The hourly anomaly check: every active site against its seasonal baseline, alerts opened,
   * kept and resolved, and mailed through the gateway when there is one. `enabled` is false when
   * the reads it needs were not wired; `runHourly` then resolves `null`.
   */
  anomalies: { enabled: boolean; runHourly(): Promise<AnomalyRunStats | null> };

  /**
   * The daily recommendations job: collect suggestions from the stored insight, heatmap and session
   * outputs, expire stale ones, and take the 7- and 14-day impact readings that are due. `enabled` is
   * false when the impact readings are not wired; `runDaily` never throws.
   */
  recommendations: { enabled: boolean; runDaily(): Promise<RecommendationRunStats | null> };

  /**
   * Words heatmap insights for the heatmaps module's `/insights` route: plain-English findings
   * and fixes from that module's analysis, stored and rate-limited. `configured` is false
   * without a model, and the route then words findings from rules.
   */
  heatmapNarrator: HeatmapInsightNarrator;

  /**
   * Words session summaries for the recordings module, which decides when one is written and
   * stores it. `null` when no model is configured: analyses then carry signals only.
   */
  sessionSummarizer: SessionSummarizer | null;
}
