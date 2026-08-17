import { and, asc, isNull, lt, sql } from "drizzle-orm";
import { db, outbox } from "../../db";
import type { EventMap, EventName } from "../events";

/** A row awaiting publication, shaped for the publisher. */
export type PendingOutboxEvent = {
  id: string;
  eventType: EventName;
  payload: Record<string, unknown>;
  attempts: number;
};

/**
 * Anything that can write an outbox row: the shared `db` handle or a
 * transaction handle from `db.transaction(...)`.
 *
 * Typed structurally rather than as Drizzle's transaction type so a caller can
 * pass either without a cast. The whole point of the outbox is that the insert
 * joins the caller's transaction — accepting only `db` would defeat it.
 */
export type OutboxWriter = Pick<typeof db, "insert">;

/**
 * Enqueue a domain event for publication.
 *
 * Call this **inside the transaction that writes the business data**, passing
 * that transaction as `writer`. The event then commits atomically with the state
 * change it describes:
 *
 * ```ts
 * await db.transaction(async (tx) => {
 *   const [row] = await tx.insert(websites).values(…).returning();
 *   await enqueueEvent(tx, "website", row.id, "website.created", { … });
 * });
 * ```
 *
 * Passing the plain `db` handle works but gives up atomicity — only do that when
 * there is no surrounding transaction to join.
 */
export async function enqueueEvent<K extends EventName>(
  writer: OutboxWriter,
  aggregateType: string,
  aggregateId: string,
  eventType: K,
  payload: EventMap[K],
): Promise<void> {
  await writer.insert(outbox).values({
    aggregateType,
    aggregateId,
    eventType,
    // Dates serialize to ISO strings through jsonb and revive as strings, not
    // Dates. `reviveOccurredAt` in the publisher restores them before dispatch.
    payload: payload as unknown as Record<string, unknown>,
  });
}

/**
 * Claim a batch of unpublished events for publication.
 *
 * `FOR UPDATE SKIP LOCKED` makes this safe to run from more than one process:
 * each claims a disjoint batch instead of every worker fighting over the head of
 * the queue. Ordering by `createdAt` preserves per-aggregate causality as long
 * as a single worker handles the batch sequentially.
 *
 * Rows whose `attempts` have exceeded `maxAttempts` are left behind so a single
 * poison payload cannot stall the queue — surface those via `countFailed`.
 */
export async function claimPendingEvents(
  limit: number,
  maxAttempts: number,
): Promise<PendingOutboxEvent[]> {
  const rows = await db
    .select({
      id: outbox.id,
      eventType: outbox.eventType,
      payload: outbox.payload,
      attempts: outbox.attempts,
    })
    .from(outbox)
    .where(and(isNull(outbox.publishedAt), lt(outbox.attempts, maxAttempts)))
    .orderBy(asc(outbox.createdAt))
    .limit(limit)
    .for("update", { skipLocked: true });

  return rows.map((r) => ({
    id: r.id,
    eventType: r.eventType as EventName,
    payload: r.payload,
    attempts: r.attempts,
  }));
}

/** Mark an event as delivered to the bus. */
export async function markPublished(id: string): Promise<void> {
  await db
    .update(outbox)
    .set({ publishedAt: new Date() })
    .where(sql`${outbox.id} = ${id}`);
}

/** Record a failed publish so the row is retried and the error is visible. */
export async function markFailed(id: string, error: string): Promise<void> {
  await db
    .update(outbox)
    .set({
      attempts: sql`${outbox.attempts} + 1`,
      // Truncated: a driver error can carry a full query text, and this column
      // is for diagnosis, not storage.
      lastError: error.slice(0, 500),
    })
    .where(sql`${outbox.id} = ${id}`);
}

/** Unpublished rows still within the retry budget — the live backlog. */
export async function countPending(maxAttempts: number): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(outbox)
    .where(and(isNull(outbox.publishedAt), lt(outbox.attempts, maxAttempts)));
  return Number(row?.c ?? 0);
}

/**
 * Rows that exhausted their retries. These will never publish on their own and
 * need operator attention — alert on a non-zero value.
 */
export async function countFailed(maxAttempts: number): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(outbox)
    .where(and(isNull(outbox.publishedAt), sql`${outbox.attempts} >= ${maxAttempts}`));
  return Number(row?.c ?? 0);
}

/**
 * Delete published rows older than `olderThan`. Published rows are kept for a
 * grace period so an operator can confirm what was delivered after an incident;
 * without pruning the table grows without bound.
 */
export async function prunePublished(olderThan: Date): Promise<number> {
  const deleted = await db
    .delete(outbox)
    .where(and(sql`${outbox.publishedAt} IS NOT NULL`, lt(outbox.publishedAt, olderThan)))
    .returning({ id: outbox.id });
  return deleted.length;
}
