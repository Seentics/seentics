import type { AIDomain, AIHistoryItem, AIQueryResult } from "../services/shared";

/**
 * The ai module's public surface.
 *
 * The module owns `ai_queries` (prompt history and per-day quota accounting) and
 * nothing else. Everything it reports on — analytics, funnels, heatmaps,
 * automations, revenue — belongs to other modules; it reaches that data by
 * generating SQL against an allow-listed set of tables per domain, which is why the
 * domain prompts live under `services/domains/` and carry their own table lists.
 */

export type { AIDomain, AIHistoryItem, AIQueryResult };

/**
 * Natural-language querying.
 *
 * `runQuery` is the expensive path: it makes at least one LLM call, generates SQL,
 * and executes it. Quota is enforced inside rather than by the caller, so no route
 * can accidentally skip it — exceeding it raises `AIDailyLimitError`.
 */
export interface AiQuery {
  runQuery(
    userId: string,
    websiteRef: string,
    prompt: string,
    domain?: AIDomain | "auto",
  ): Promise<AIQueryResult>;

  /** Recent prompts for this user and website, newest first. */
  getHistory(userId: string, websiteRef: string, limit?: number): Promise<AIHistoryItem[]>;
}

/**
 * The website access check the ai routes apply.
 *
 * Separate from `AiQuery` because it is a guard rather than a capability: the routes
 * call it before `runQuery`, and nothing else in the module needs it.
 */
export interface AiAccessCheck {
  /** `true` when the user may query this website's data. */
  userCanQuery(websiteRef: string, userId: string): Promise<boolean>;
}
