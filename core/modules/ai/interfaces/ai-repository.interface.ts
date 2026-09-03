import type { AIHistoryItem, AIVizType } from "../services/shared";

/** Everything recorded about a finished attempt that succeeded. */
export type AiSuccessRecord = {
  systemContext: string;
  generatedSql: string;
  vizType: AIVizType;
  title: string;
  insight: string | null;
  tips: string | null;
  xKey: string | null;
  yKey: string | null;
  columns: Array<{ key: string; label: string }>;
  rowCount: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  executionTimeMs: number;
};

/** The two identifiers a website is reachable by. See `AiRepository.history`. */
export type WebsiteIds = { websiteId: string; uuid: string };

/**
 * Storage for the AI module.
 *
 * The reason this exists is `runGuarded`. Everything else here is ordinary bookkeeping
 * over `ai_queries`, but that one method is where model-authored SQL meets a live
 * multi-tenant database, and it was previously an inline `sql.begin` in the middle of a
 * 340-line function — reachable only by calling OpenAI first, and therefore untested.
 * Behind a port it is a named thing with one job, and the pipeline around it can be
 * driven by a fake.
 */
export interface AiRepository {
  /**
   * Execute already-validated SQL against the caller's tenant.
   *
   * Contract, and the reason this is storage's job rather than the service's: the
   * statement runs in a transaction that is `READ ONLY` and carries a statement
   * timeout, and `boundId` is passed as `$1` rather than interpolated. The string
   * validator in `services/shared.ts` is the first half of the defence and this is the
   * second — neither is sufficient alone.
   */
  runGuarded(sql: string, boundId: string): Promise<Record<string, unknown>[]>;

  /** Attempts by this user since `since`. Drives the rolling daily cap. */
  countQueriesSince(userId: string, since: Date): Promise<number>;

  /**
   * Record an attempt before the LLM is called, returning its id.
   *
   * Written first so a crash mid-call still leaves evidence the attempt happened —
   * which is what the cap counts. `null` if the row could not be created; the caller
   * proceeds without recording rather than failing the query.
   */
  createPending(input: {
    userId: string;
    websiteUuid: string;
    prompt: string;
    model: string;
  }): Promise<string | null>;

  markSuccess(id: string, record: AiSuccessRecord): Promise<void>;

  markFailure(id: string, record: { errorMessage: string; executionTimeMs: number }): Promise<void>;

  /**
   * Recent prompts for a user and website, newest first.
   *
   * Matches on either identifier: new rows are written under the canonical UUID, but
   * rows predating that carry whichever form the client sent, so keying on the UUID
   * alone would silently hide a user's existing history.
   */
  history(userId: string, ids: WebsiteIds, limit: number): Promise<AIHistoryItem[]>;

  /**
   * Successful analyses by this user since `since`, for the usage report.
   *
   * Only `success` counts — a failed LLM call is not charged. Keyed by user rather
   * than website because an analysis is billed to whoever ran it.
   */
  countSuccessfulSince(userId: string, since: Date): Promise<number>;
}
