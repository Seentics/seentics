/**
 * Public contracts for the ai module.
 *
 * `AiQuery` is the capability; `AiAccessCheck` is the guard the routes apply before
 * spending an LLM call.
 */
export type {
  AiAccessCheck,
  AiQuery,
  AIDomain,
  AIHistoryItem,
  AIQueryResult,
} from "./ai.interface";

/** The whole module surface, as a peer receives it at composition time. */
export type { AiModule } from "./ai.module";
