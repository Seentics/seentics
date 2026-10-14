import type { WebsiteQuery } from "../../websites/interfaces";
import type { AiQueryExecution, AiQueryHistory } from "../interfaces";

import type { AiAgent, AiProposalApplier } from "../interfaces/ai-agent.interface";
import type { InsightService } from "../insights/service";
import type { AnomalyService } from "../anomalies/service";
import type { RecommendationService } from "../recommendations/service";

export type AiControllerDeps = {
  agent: AiAgent;
  applier: AiProposalApplier;
  query: AiQueryExecution;
  history: AiQueryHistory;
  websites: WebsiteQuery;
  /** The daily dashboard insight. */
  insights: InsightService;
  /** Anomaly alerts and their per-site settings. */
  alerts?: AnomalyService;
  /** Recommendations, the actions taken on them and their measured impact. */
  recommendations?: RecommendationService;
  /** Whether a model provider is configured; answers `GET /status`. */
  configured: boolean;
};
