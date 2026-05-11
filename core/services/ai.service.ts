/**
 * ai.service.ts — backwards-compatible re-export.
 * All logic now lives in services/ai/ (domain-organized).
 */
export {
  checkWebsiteAccess,
  runAIQuery,
  getAIQueryHistory,
} from "./ai/index";

export type { AIDomain, AIHistoryItem, AIQueryResult } from "./ai/shared";
