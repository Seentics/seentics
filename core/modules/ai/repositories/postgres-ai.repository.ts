import { and, asc, count, desc, eq, gte, isNotNull, isNull } from "drizzle-orm";
import { aiQueries, db, sql } from "../../../db";
import type {
  AgentSuccessRecord,
  AiCostRow,
  AiRepository,
  AiSuccessRecord,
  ConversationTurn,
  WebsiteId,
} from "../interfaces/ai-repository.interface";
import type { AIHistoryItem } from "../interfaces/ai-query.types";

/** Hard timeout for AI-generated SQL. Bounds the cost of a runaway or expensive query. */
const AI_STATEMENT_TIMEOUT_MS = Number(process.env.AI_STATEMENT_TIMEOUT_MS ?? 8_000);

/**
 * `AiRepository` over Postgres.
 *
 * The only file in this module that touches `db`.
 */
export class PostgresAiRepository implements AiRepository {
  /**
   * The execution boundary for model-authored SQL.
   *
   * `transaction_read_only` is the enforcement that does not depend on parsing: however
   * the statement was written, it cannot write. `statement_timeout` bounds what it can
   * cost. Both are `SET LOCAL`, so they last exactly as long as this transaction.
   *
   * What neither of them does is stop a read of the wrong tenant — a `SELECT` against
   * another customer's rows is a perfectly valid read-only statement. That is
   * `validateAndSanitizeSQL`'s job, and it must have run before this is called.
   */
  async runGuarded(statement: string, boundId: string): Promise<Record<string, unknown>[]> {
    return (await sql.begin(async (tx) => {
      await tx.unsafe(`SET LOCAL statement_timeout = ${AI_STATEMENT_TIMEOUT_MS}`);
      await tx.unsafe("SET LOCAL transaction_read_only = on");
      // `boundId` is a bound parameter, never interpolated into the statement.
      return (await tx.unsafe(statement, [boundId])) as Record<string, unknown>[];
    })) as Record<string, unknown>[];
  }

  async countQueriesSince(userId: string, since: Date): Promise<number> {
    const [row] = await db
      .select({ n: count() })
      .from(aiQueries)
      .where(and(eq(aiQueries.userId, userId), gte(aiQueries.createdAt, since)));
    return row?.n ?? 0;
  }

  async createPending(input: {
    userId: string;
    websiteUuid: string;
    prompt: string;
    model: string;
    conversationId?: string;
  }): Promise<string | null> {
    const [inserted] = await db
      .insert(aiQueries)
      .values({
        userId: input.userId,
        websiteId: input.websiteUuid,
        prompt: input.prompt,
        conversationId: input.conversationId ?? null,
        model: input.model,
        status: "pending",
      })
      .returning({ id: aiQueries.id });
    return inserted?.id ?? null;
  }

  async markSuccess(id: string, record: AiSuccessRecord): Promise<void> {
    await db
      .update(aiQueries)
      .set({ ...record, status: "success" })
      .where(eq(aiQueries.id, id));
  }

  async markFailure(
    id: string,
    record: { errorMessage: string; executionTimeMs: number },
  ): Promise<void> {
    await db
      .update(aiQueries)
      .set({ ...record, status: "error" })
      .where(eq(aiQueries.id, id));
  }

  async countSuccessfulSince(userId: string, since: Date): Promise<number> {
    const [row] = await db
      .select({ n: count() })
      .from(aiQueries)
      .where(
        and(
          eq(aiQueries.userId, userId),
          eq(aiQueries.status, "success"),
          gte(aiQueries.createdAt, since),
        ),
      );
    return row?.n ?? 0;
  }

  async history(userId: string, websiteId: WebsiteId, limit: number): Promise<AIHistoryItem[]> {
    const rows = await db
      .select({
        id: aiQueries.id,
        prompt: aiQueries.prompt,
        title: aiQueries.title,
        viz_type: aiQueries.vizType,
        status: aiQueries.status,
        created_at: aiQueries.createdAt,
      })
      .from(aiQueries)
      .where(and(eq(aiQueries.userId, userId), eq(aiQueries.websiteId, websiteId)))
      .orderBy(desc(aiQueries.createdAt))
      .limit(Math.min(limit, 20));

    return rows.map((r) => ({ ...r, created_at: r.created_at.toISOString() }));
  }

  async markAgentSuccess(id: string, record: AgentSuccessRecord): Promise<void> {
    await db
      .update(aiQueries)
      .set({
        status: "success",
        answer: record.answer,
        toolCalls: record.toolCalls,
        proposal: record.proposal,
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        estimatedCostUsd: record.estimatedCostUsd,
        executionTimeMs: record.executionTimeMs,
      })
      .where(eq(aiQueries.id, id));
  }

  async conversation(
    userId: string,
    conversationId: string,
    limit: number,
  ): Promise<ConversationTurn[]> {
    const rows = await db
      .select({
        id: aiQueries.id,
        prompt: aiQueries.prompt,
        answer: aiQueries.answer,
        proposal: aiQueries.proposal,
        proposalAppliedAt: aiQueries.proposalAppliedAt,
        status: aiQueries.status,
        createdAt: aiQueries.createdAt,
      })
      .from(aiQueries)
      // Owner is part of the lookup, not a check afterwards: a conversation id is a UUID
      // that could be held from a log or a shared link, and who is asking is the only
      // thing that should decide whether it reads.
      .where(and(eq(aiQueries.userId, userId), eq(aiQueries.conversationId, conversationId)))
      .orderBy(asc(aiQueries.createdAt))
      .limit(Math.min(limit, 100));

    return rows.map((r) => ({
      ...r,
      proposal: r.proposal ?? null,
      proposalAppliedAt: r.proposalAppliedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async pendingProposal(userId: string, queryId: string) {
    const [row] = await db
      .select({ websiteId: aiQueries.websiteId, proposal: aiQueries.proposal })
      .from(aiQueries)
      .where(and(
        eq(aiQueries.id, queryId),
        eq(aiQueries.userId, userId),
        isNotNull(aiQueries.proposal),
        // Already-applied drafts are not pending, which is what stops a double-create.
        isNull(aiQueries.proposalAppliedAt),
      ))
      .limit(1);

    return row?.proposal ? { websiteId: row.websiteId, proposal: row.proposal } : null;
  }

  async markProposalApplied(userId: string, queryId: string): Promise<boolean> {
    // The `isNull` in the predicate is the race guard: two concurrent confirms both read
    // a pending draft, and only the first update matches.
    const rows = await db
      .update(aiQueries)
      .set({ proposalAppliedAt: new Date() })
      .where(and(
        eq(aiQueries.id, queryId),
        eq(aiQueries.userId, userId),
        isNull(aiQueries.proposalAppliedAt),
      ))
      .returning({ id: aiQueries.id });
    return rows.length > 0;
  }

  async conversations(userId: string, websiteId: WebsiteId, limit: number) {
    /*
     * One row per thread. `min(created_at)` picks the opening question as the title —
     * `first_value` would need a window and a subquery for the same answer, and the
     * opening question is what a thread is about.
     */
    const rows = await sql`
      SELECT DISTINCT ON (conversation_id)
             conversation_id AS id,
             first_value(prompt) OVER (
               PARTITION BY conversation_id ORDER BY created_at ASC
             ) AS title,
             count(*) OVER (PARTITION BY conversation_id) AS message_count,
             max(created_at) OVER (PARTITION BY conversation_id) AS last_message_at
        FROM ai_queries
       WHERE user_id = ${userId}::uuid
         AND website_id = ${websiteId}::uuid
         AND conversation_id IS NOT NULL
       ORDER BY conversation_id, created_at ASC
    `;

    return (rows as Record<string, unknown>[])
      .map((r) => ({
        id: String(r.id),
        title: String(r.title ?? "Untitled").slice(0, 120),
        messageCount: Number(r.message_count ?? 0),
        lastMessageAt: new Date(r.last_message_at as string).toISOString(),
      }))
      // Newest thread first. Ordering in SQL would fight the DISTINCT ON, which must
      // order by the partition key first.
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
      .slice(0, Math.min(limit, 50));
  }

  async costReport(input: { since: Date; limit: number; websiteId?: string }): Promise<AiCostRow[]> {
    const where = input.websiteId
      ? and(gte(aiQueries.createdAt, input.since), eq(aiQueries.websiteId, input.websiteId))
      : gte(aiQueries.createdAt, input.since);

    const rows = await db
      .select({
        id: aiQueries.id,
        userId: aiQueries.userId,
        websiteId: aiQueries.websiteId,
        prompt: aiQueries.prompt,
        model: aiQueries.model,
        inputTokens: aiQueries.inputTokens,
        outputTokens: aiQueries.outputTokens,
        estimatedCostUsd: aiQueries.estimatedCostUsd,
        executionTimeMs: aiQueries.executionTimeMs,
        status: aiQueries.status,
        createdAt: aiQueries.createdAt,
      })
      .from(aiQueries)
      .where(where)
      .orderBy(desc(aiQueries.createdAt))
      .limit(Math.min(input.limit, 500));

    return rows.map((r) => ({
      ...r,
      // The prompt is shown to an operator, so it is trimmed here rather than in the UI.
      prompt: r.prompt.slice(0, 300),
      inputTokens: r.inputTokens ?? 0,
      outputTokens: r.outputTokens ?? 0,
      estimatedCostUsd: r.estimatedCostUsd ?? 0,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
