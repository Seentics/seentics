import type { AnalyticsImpactReads } from '../../analytics/interfaces';
import type { AutomationInsights } from '../../automations/interfaces';
import type { FunnelPerformance } from '../../funnels/interfaces';
import type { SessionAnalysisReads } from '../../recordings/interfaces';
import { log as baseLog } from '../../../platform/observability/logger';
import type { LlmClient } from '../interfaces/llm-client.interface';
import type { InsightLine } from '../insights/types';
import type { RecommendationReadPorts } from '../tools/recommendation-reads';
import type { ImpactPorts } from './metrics';
import { createImpactNarrator } from './narration';
import { PostgresRecommendationRepository } from './postgres-repository';
import { RecommendationService } from './service';

const log = baseLog.child({ category: 'ai_recommendations' });

/**
 * The recommendations loop, assembled from the ports `initAiModule` already holds.
 *
 * Kept out of `init.ts` so the module root only names what it hands over. Every read of another
 * module goes through that module's port: analytics for session counts, funnels for a funnel's
 * figures over a fixed window, automations for an automation's execution totals, recordings for
 * frustrated sessions.
 */
export function composeRecommendations(deps: {
  impactReads: AnalyticsImpactReads;
  funnelPerformance: FunnelPerformance;
  automationStats: Pick<AutomationInsights, 'stats'> | null;
  sessionAnalysis: SessionAnalysisReads;
  latestInsight: (websiteId: string) => Promise<{ insightDate: string; status: string; lines: InsightLine[] } | null>;
  /** The cheap insight model, for the one optional sentence per reading. `null`: rule wording. */
  llm: LlmClient | null;
}): { service: RecommendationService; reads: RecommendationReadPorts } {
  const ports: ImpactPorts = {
    sessionCounts: (websiteId, query) => deps.impactReads.getImpactCounts(websiteId, query),
    funnelCounts: async (websiteId, funnelId, from, to) => {
      const r = await deps.funnelPerformance.reportBetween(websiteId, funnelId, from, to);
      return r ? { entries: r.totalEntries, completions: r.completions } : null;
    },
    automationActivity: async (websiteId, automationId) => {
      const s = await deps.automationStats?.stats(websiteId, automationId);
      return s
        ? { automationId, totalExecutions: s.totalExecutions, successCount: s.successCount, failureCount: s.failureCount, last30Days: s.last30Days }
        : null;
    },
  };

  const service = new RecommendationService({
    repo: new PostgresRecommendationRepository(),
    ports,
    sources: {
      latestInsight: deps.latestInsight,
      frustratedSessions: (websiteId, days) => deps.sessionAnalysis.listFrustrated(websiteId, { days, limit: 50, minScore: 1 }),
    },
    narrator: createImpactNarrator(deps.llm, (u) => log.info({ msg: 'ai_impact_sentence', input_tokens: u.inputTokens, output_tokens: u.outputTokens })),
  });

  return {
    service,
    reads: {
      list: (websiteId, statuses) => service.list(websiteId, { statuses, limit: 50 }),
      get: (websiteId, id) => service.get(websiteId, id),
    },
  };
}
