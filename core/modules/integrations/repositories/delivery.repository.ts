import { sql } from "../../../db";
import type { SubmissionDelivery } from "../../leads/interfaces";
import type { DeliveryQuery, DeliveryView, LeadPayload, ProviderId } from "../interfaces";

/** How long a claim holds a row. A crashed worker's rows come back after this. */
export const LEASE_SECONDS = 60;
/** Undelivered payloads (pending or given up on) are cleared after this many days. */
export const PAYLOAD_RETENTION_DAYS = 30;

/** A due delivery with what an attempt needs: the lead, and the destination it goes to (credentials still sealed). */
export type ClaimedDelivery = {
  id: string;
  connection_id: string;
  website_id: string;
  submission_id: string;
  automation_id: string | null;
  payload: LeadPayload | null;
  attempt_count: number;
  provider: ProviderId;
  credentials: string;
  config: Record<string, unknown>;
};

/**
 * Queue a lead for every enabled destination on its website, narrowed to `destinationIds`.
 *
 * One statement, so a lead is queued for all of its destinations or none. `ON CONFLICT`
 * makes a repeat of the same submission a no-op instead of a second delivery.
 */
export async function enqueueDeliveries(input: {
  websiteId: string;
  submissionId: string;
  automationId: string | null;
  payload: LeadPayload;
  destinationIds: readonly string[] | null;
}): Promise<number> {
  const narrow = input.destinationIds ? sql`AND c.id = ANY(${input.destinationIds as string[]}::uuid[])` : sql``;
  const rows = await sql`
    INSERT INTO integration_deliveries (connection_id, website_id, submission_id, automation_id, payload)
    SELECT c.id, c.website_id, ${input.submissionId}::uuid, ${input.automationId}::uuid, ${JSON.stringify(input.payload)}::jsonb
    FROM integration_connections c
    WHERE c.website_id = ${input.websiteId}::uuid AND c.enabled ${narrow}
    ON CONFLICT (connection_id, submission_id) DO NOTHING
    RETURNING id
  `;
  return rows.length;
}

/**
 * Take up to `limit` deliveries that are due, leasing them so no other worker takes them too.
 *
 * `SKIP LOCKED` lets several API processes poll the same table without waiting on each other,
 * and the lease (not the row lock, which ends with this statement) is what keeps a claimed row
 * away from the others while its attempt runs. Rows of a disabled destination are left alone:
 * they resume when it is switched back on.
 */
export async function claimDue(limit: number): Promise<ClaimedDelivery[]> {
  const rows = await sql<ClaimedDelivery[]>`
    WITH due AS (
      SELECT d.id FROM integration_deliveries d
      JOIN integration_connections c ON c.id = d.connection_id
      WHERE d.status = 'pending' AND d.next_attempt_at <= NOW()
        AND (d.locked_until IS NULL OR d.locked_until < NOW()) AND c.enabled
      ORDER BY d.next_attempt_at
      LIMIT ${limit}
      FOR UPDATE OF d SKIP LOCKED
    ), claimed AS (
      UPDATE integration_deliveries d
      SET locked_until = NOW() + make_interval(secs => ${LEASE_SECONDS}), updated_at = NOW()
      FROM due WHERE d.id = due.id
      RETURNING d.id, d.connection_id, d.website_id, d.submission_id, d.automation_id, d.payload, d.attempt_count
    )
    SELECT claimed.*, c.provider, c.credentials, c.config
    FROM claimed JOIN integration_connections c ON c.id = claimed.connection_id
  `;
  return [...rows];
}

/** What an attempt came to, as the row records it. */
export type AttemptResult =
  | { kind: "success"; httpStatus: number | null; error: null }
  | { kind: "skipped"; httpStatus: null; error: string }
  | { kind: "retry"; httpStatus: number | null; error: string; nextAttemptAt: Date }
  | { kind: "failed"; httpStatus: number | null; error: string; disableNow: boolean };

/**
 * Record one attempt and keep the destination's health in step.
 *
 * Success and skip finish the row and clear its payload (the lead now lives at the
 * destination, or was deliberately not sent). A retry keeps it pending for later. A terminal
 * failure keeps the payload so "Retry" can send it. Health moves only on a final outcome: a
 * success zeroes the failure streak, a terminal failure raises it, and at `disableAfter` — or
 * at once when the credential was refused — the destination is switched off, so a revoked
 * key stops costing a request per lead. A skip changes nothing: a lead without consent is
 * the destination working as designed.
 */
export async function completeAttempt(input: {
  deliveryId: string;
  connectionId: string;
  attempts: number;
  durationMs: number;
  result: AttemptResult;
  disableAfter: number;
}): Promise<{ disabled: boolean }> {
  const { result } = input;
  return sql.begin(async (tx) => {
    if (result.kind === "retry") {
      await tx`
        UPDATE integration_deliveries SET
          attempt_count = ${input.attempts}, next_attempt_at = ${result.nextAttemptAt}, locked_until = NULL,
          http_status = ${result.httpStatus}, error = ${result.error}, duration_ms = ${input.durationMs}, updated_at = NOW()
        WHERE id = ${input.deliveryId}::uuid
      `;
      await tx`
        UPDATE integration_connections SET last_attempt_at = NOW(), last_error = ${result.error}
        WHERE id = ${input.connectionId}::uuid
      `;
      return { disabled: false };
    }

    const done = result.kind === "success" || result.kind === "skipped";
    await tx`
      UPDATE integration_deliveries SET
        status = ${result.kind === "failed" ? "failed" : result.kind},
        attempt_count = ${input.attempts}, locked_until = NULL,
        payload = CASE WHEN ${done} THEN NULL ELSE payload END,
        http_status = ${result.httpStatus}, error = ${result.error}, duration_ms = ${input.durationMs},
        completed_at = NOW(), updated_at = NOW()
      WHERE id = ${input.deliveryId}::uuid
    `;

    if (result.kind === "skipped") return { disabled: false };

    if (result.kind === "success") {
      await tx`
        UPDATE integration_connections SET
          consecutive_failures = 0, status = 'active', last_error = NULL,
          last_attempt_at = NOW(), last_success_at = NOW()
        WHERE id = ${input.connectionId}::uuid
      `;
      return { disabled: false };
    }

    const [row] = await tx<{ enabled: boolean }[]>`
      UPDATE integration_connections SET
        consecutive_failures = consecutive_failures + 1,
        last_error = ${result.error},
        last_attempt_at = NOW(),
        enabled = CASE WHEN ${result.disableNow} OR consecutive_failures + 1 >= ${input.disableAfter} THEN FALSE ELSE enabled END,
        status = CASE WHEN ${result.disableNow} OR consecutive_failures + 1 >= ${input.disableAfter} THEN 'error' ELSE status END
      WHERE id = ${input.connectionId}::uuid
      RETURNING enabled
    `;
    return { disabled: row ? !row.enabled : false };
  });
}

/**
 * Queue a given-up delivery for a fresh round of attempts.
 *
 * Only a failed delivery that still has its payload qualifies, and only while its destination
 * is on: a retry queued behind a disabled destination would sit there looking active.
 */
export async function requeueFailed(websiteId: string, deliveryId: string): Promise<"requeued" | "disabled" | "not_found"> {
  const rows = await sql`
    UPDATE integration_deliveries d SET
      status = 'pending', attempt_count = 0, next_attempt_at = NOW(), locked_until = NULL,
      error = NULL, http_status = NULL, completed_at = NULL, updated_at = NOW()
    FROM integration_connections c
    WHERE d.id = ${deliveryId}::uuid AND d.website_id = ${websiteId}::uuid AND c.id = d.connection_id
      AND d.status = 'failed' AND d.payload IS NOT NULL AND c.enabled
    RETURNING d.id
  `;
  if (rows.length > 0) return "requeued";
  const [blocked] = await sql<{ enabled: boolean }[]>`
    SELECT c.enabled FROM integration_deliveries d JOIN integration_connections c ON c.id = d.connection_id
    WHERE d.id = ${deliveryId}::uuid AND d.website_id = ${websiteId}::uuid AND d.status = 'failed' AND d.payload IS NOT NULL
  `;
  return blocked && !blocked.enabled ? "disabled" : "not_found";
}

export async function recentDeliveries(websiteId: string, q: DeliveryQuery): Promise<DeliveryView[]> {
  const status = q.status ? sql`AND d.status = ${q.status}` : sql``;
  const connection = q.connectionId ? sql`AND d.connection_id = ${q.connectionId}::uuid` : sql``;
  const rows = await sql<DeliveryView[]>`
    SELECT d.id, d.connection_id, c.name AS connection_name, c.provider, d.submission_id, d.automation_id,
           d.status, d.attempt_count,
           CASE WHEN d.status = 'pending' THEN d.next_attempt_at END AS next_attempt_at,
           d.http_status, d.error, d.duration_ms, d.created_at, d.completed_at
    FROM integration_deliveries d
    JOIN integration_connections c ON c.id = d.connection_id
    WHERE d.website_id = ${websiteId}::uuid ${status} ${connection}
    ORDER BY d.created_at DESC
    LIMIT ${q.limit}
  `;
  return [...rows];
}

type StatusRow = SubmissionDelivery & { submission_id: string };

/** Delivery state for each of the given submissions, newest destination order not guaranteed. */
export async function deliveriesOfSubmissions(websiteId: string, submissionIds: readonly string[]): Promise<StatusRow[]> {
  if (submissionIds.length === 0) return [];
  const rows = await sql<StatusRow[]>`
    SELECT d.id, d.submission_id, d.connection_id, c.name AS connection_name, c.provider, d.status,
           d.attempt_count, d.error, d.completed_at
    FROM integration_deliveries d
    JOIN integration_connections c ON c.id = d.connection_id
    WHERE d.website_id = ${websiteId}::uuid AND d.submission_id = ANY(${submissionIds as string[]}::uuid[])
    ORDER BY c.created_at
  `;
  return [...rows];
}

/** Cancel what is still waiting and drop the payload of the rest. For erased submissions. */
export async function forgetSubmissions(websiteId: string, submissionIds: readonly string[]): Promise<void> {
  if (submissionIds.length === 0) return;
  await sql`
    DELETE FROM integration_deliveries
    WHERE website_id = ${websiteId}::uuid AND submission_id = ANY(${submissionIds as string[]}::uuid[]) AND status = 'pending'
  `;
  await sql`
    UPDATE integration_deliveries SET payload = NULL, updated_at = NOW()
    WHERE website_id = ${websiteId}::uuid AND submission_id = ANY(${submissionIds as string[]}::uuid[]) AND payload IS NOT NULL
  `;
}

export type PurgeCounts = { deleted: number; expired: number; scrubbed: number };

/**
 * The retention sweep for one website: drop old history, give up on leads that never went
 * out, and clear the payloads of the ones that failed for good.
 *
 * The middle step matters for privacy: a destination that stays disabled would otherwise hold
 * its pending leads — addresses and answers — forever.
 */
export async function purgeDeliveries(websiteId: string, historyCutoff: Date, payloadCutoff: Date): Promise<PurgeCounts> {
  const deleted = await sql`
    DELETE FROM integration_deliveries WHERE website_id = ${websiteId}::uuid AND created_at < ${historyCutoff} RETURNING id
  `;
  const expired = await sql`
    UPDATE integration_deliveries SET
      status = 'failed', payload = NULL, completed_at = NOW(), locked_until = NULL, updated_at = NOW(),
      error = 'Expired: not delivered within 30 days'
    WHERE website_id = ${websiteId}::uuid AND status = 'pending' AND created_at < ${payloadCutoff}
    RETURNING id
  `;
  const scrubbed = await sql`
    UPDATE integration_deliveries SET payload = NULL, updated_at = NOW()
    WHERE website_id = ${websiteId}::uuid AND status = 'failed' AND payload IS NOT NULL AND completed_at < ${payloadCutoff}
    RETURNING id
  `;
  return { deleted: deleted.length, expired: expired.length, scrubbed: scrubbed.length };
}
