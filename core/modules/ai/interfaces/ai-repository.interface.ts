import type { AIHistoryItem, AIVizType } from "./ai-query.types";

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

/**
 * A resolved website id.
 *
 * A pair of `{ websiteId, uuid }` until recently, from when `websites.site_id` was a
 * separate short public id. That column is gone — `websites` has one `id`, and every
 * `website_id` column holds it — so the pair was two names for the same value, and the
 * code branching on which one to use was choosing between identical strings.
 */
export type WebsiteId = string;

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
   * generated-SQL guard is the first half of the defence and this is the
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
    /** Threads this attempt to a conversation. Absent for the one-off SQL path. */
    conversationId?: string;
  }): Promise<string | null>;

  markSuccess(id: string, record: AiSuccessRecord): Promise<void>;

  markFailure(id: string, record: { errorMessage: string; executionTimeMs: number }): Promise<void>;

  /**
   * Recent prompts for a user and website, newest first.
   *
   * One equality, not the `website_id = uuid OR website_id = websiteId` this used to
   * be: both sides of that OR were the same value, and an OR of two equalities on one
   * column costs a BitmapOr where a plain equality uses
   * `ix_ai_queries_user_website_created` directly.
   */
  history(userId: string, websiteId: WebsiteId, limit: number): Promise<AIHistoryItem[]>;

  /**
   * Successful analyses by this user since `since`, for the usage report.
   *
   * Only `success` counts — a failed LLM call is not charged. Keyed by user rather
   * than website because an analysis is billed to whoever ran it.
   */
  countSuccessfulSince(userId: string, since: Date): Promise<number>;

  /** Record an agent answer: prose, the tools that ran, and any draft awaiting approval. */
  markAgentSuccess(id: string, record: AgentSuccessRecord): Promise<void>;

  /**
   * One conversation, oldest first, scoped to its owner.
   *
   * `userId` is part of the lookup rather than checked afterwards: a conversation id is a
   * UUID someone could hold from a shared link or a log, and the only thing that should
   * decide whether it can be read is who is asking.
   */
  conversation(
    userId: string,
    conversationId: string,
    limit: number,
  ): Promise<ConversationTurn[]>;

  /**
   * The stored draft for one query, if it has not already been applied.
   *
   * Read back at confirm time instead of trusting what the browser returns — a
   * round-trip through a client is a chance to change a payload after it was approved.
   */
  pendingProposal(
    userId: string,
    queryId: string,
  ): Promise<{ websiteId: string; proposal: Record<string, unknown> } | null>;

  /** Stamp a proposal as applied. Returns false when another request got there first. */
  markProposalApplied(userId: string, queryId: string): Promise<boolean>;

  /**
   * This user's conversations on one website, newest first.
   *
   * One row per thread, titled by its opening question — which is what a sidebar needs,
   * and what a per-message history cannot give without the caller grouping it.
   */
  conversations(
    userId: string,
    websiteId: WebsiteId,
    limit: number,
  ): Promise<ConversationSummary[]>;

  /** Per-message cost for the admin view, newest first. */
  costReport(input: { since: Date; limit: number; websiteId?: string }): Promise<AiCostRow[]>;
}

export type AgentSuccessRecord = {
  answer: string;
  toolCalls: Array<{ name: string; args: unknown; ok: boolean }>;
  proposal: Record<string, unknown> | null;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  executionTimeMs: number;
};

export type ConversationSummary = {
  id: string;
  /** The first question asked, which is what the thread is about. */
  title: string;
  messageCount: number;
  lastMessageAt: string;
};

export type ConversationTurn = {
  id: string;
  prompt: string;
  answer: string | null;
  proposal: Record<string, unknown> | null;
  proposalAppliedAt: string | null;
  status: string;
  createdAt: string;
};

/** One row of the admin spend report. */
export type AiCostRow = {
  id: string;
  userId: string;
  websiteId: string;
  prompt: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  executionTimeMs: number | null;
  status: string;
  createdAt: string;
};
