import type { WebsiteQuery } from "../../websites/interfaces";
import type { AiQueryExecution, AiQueryHistory } from "../interfaces";

import type { AiAgent, AiProposalApplier } from "../interfaces/ai-agent.interface";

export type AiControllerDeps = {
  agent: AiAgent;
  applier: AiProposalApplier;
  query: AiQueryExecution;
  history: AiQueryHistory;
  websites: WebsiteQuery;
};
