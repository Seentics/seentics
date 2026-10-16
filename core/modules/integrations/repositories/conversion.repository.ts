import { sql } from "../../../db";
import type {
  ConversionEventView,
  ConversionKind,
  ConversionPayload,
  ConversionPlatform,
  ConversionSummary,
  DestinationConfig,
  MatchKey,
} from "../interfaces/conversions";

/** How long a claim holds a row. A crashed worker's rows come back after this. */
export const CONVERSION_LEASE_SECONDS = 60;
/** The delivery log's window: rows older than this are deleted. */
export const CONVERSION_RETENTION_DAYS = 30;

export type DestinationRow = {
  id: string;
  website_id: string;
  platform: ConversionPlatform;
  name: string;
  account_ref: string;
  credentials: string;
  credentials_hint: string;
  config: DestinationConfig;
  enabled: boolean;
  status: "active" | "error";
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

// --- Destinations -------------------------------------------------------------

export async function listDestinations(websiteId: string): Promise<(DestinationRow & { sent_7d: number; failed_7d: number; last_sent_at: string | null })[]> {
  const rows = await sql<(DestinationRow & { sent_7d: number; failed_7d: number; last_sent_at: string | null })[]>`
    SELECT d.*,
      (SELECT COUNT(*)::int FROM conversion_events e WHERE e.destination_id = d.id AND e.status = 'success' AND e.created_at > NOW() - INTERVAL '7 days') AS sent_7d,
      (SELECT COUNT(*)::int FROM conversion_events e WHERE e.destination_id = d.id AND e.status = 'failed' AND e.created_at > NOW() - INTERVAL '7 days') AS failed_7d,
      (SELECT MAX(e.completed_at) FROM conversion_events e WHERE e.destination_id = d.id AND e.status = 'success') AS last_sent_at
    FROM conversion_destinations d WHERE d.website_id = ${websiteId}::uuid ORDER BY d.created_at
  `;
  return [...rows];
}

export async function getDestination(websiteId: string, id: string): Promise<DestinationRow | null> {
  const [row] = await sql<DestinationRow[]>`SELECT * FROM conversion_destinations WHERE website_id = ${websiteId}::uuid AND id = ${id}::uuid`;
  return row ?? null;
}

/** Enabled destinations for these websites, for routing events. */
export async function enabledDestinations(websiteIds: readonly string[]): Promise<DestinationRow[]> {
  if (websiteIds.length === 0) return [];
  const rows = await sql<DestinationRow[]>`
    SELECT * FROM conversion_destinations WHERE website_id = ANY(${websiteIds as string[]}::uuid[]) AND enabled
  `;
  return [...rows];
}

/** Insert with a caller-chosen id (credentials are sealed to it). False when that account is already connected. */
export async function insertDestination(input: {
  id: string; websiteId: string; platform: ConversionPlatform; name: string; accountRef: string;
  credentials: string; hint: string; config: DestinationConfig;
}): Promise<boolean> {
  const rows = await sql`
    INSERT INTO conversion_destinations (id, website_id, platform, name, account_ref, credentials, credentials_hint, config)
    VALUES (${input.id}::uuid, ${input.websiteId}::uuid, ${input.platform}, ${input.name}, ${input.accountRef},
            ${input.credentials}, ${input.hint}, ${JSON.stringify(input.config)}::jsonb)
    ON CONFLICT (website_id, platform, account_ref) DO NOTHING
    RETURNING id
  `;
  return rows.length > 0;
}

export async function updateDestination(websiteId: string, id: string, patch: {
  name?: string; enabled?: boolean; credentials?: string; hint?: string; accountRef?: string; config?: DestinationConfig;
}): Promise<boolean> {
  const sets = [sql`updated_at = NOW()`];
  if (patch.name !== undefined) sets.push(sql`name = ${patch.name}`);
  if (patch.enabled !== undefined) sets.push(sql`enabled = ${patch.enabled}`);
  // Turning a destination back on, or giving it new credentials, starts its health afresh.
  if (patch.enabled === true || patch.credentials !== undefined) sets.push(sql`status = 'active', consecutive_failures = 0, last_error = NULL`);
  if (patch.credentials !== undefined) sets.push(sql`credentials = ${patch.credentials}`);
  if (patch.hint !== undefined) sets.push(sql`credentials_hint = ${patch.hint}`);
  if (patch.accountRef !== undefined) sets.push(sql`account_ref = ${patch.accountRef}`);
  if (patch.config !== undefined) sets.push(sql`config = ${JSON.stringify(patch.config)}::jsonb`);
  const assignments = sets.reduce((all, next) => sql`${all}, ${next}`);
  const rows = await sql`UPDATE conversion_destinations SET ${assignments} WHERE website_id = ${websiteId}::uuid AND id = ${id}::uuid RETURNING id`;
  return rows.length > 0;
}

export async function deleteDestination(websiteId: string, id: string): Promise<boolean> {
  const rows = await sql`DELETE FROM conversion_destinations WHERE website_id = ${websiteId}::uuid AND id = ${id}::uuid RETURNING id`;
  return rows.length > 0;
}

export async function countDestinations(websiteIds: readonly string[]): Promise<number> {
  if (websiteIds.length === 0) return 0;
  const [row] = await sql<[{ c: number }]>`SELECT COUNT(*)::int AS c FROM conversion_destinations WHERE website_id = ANY(${websiteIds as string[]}::uuid[])`;
  return row?.c ?? 0;
}

// --- The outbox -----------------------------------------------------------------

export type QueuedConversion = {
  destinationId: string;
  websiteId: string;
  kind: ConversionKind;
  eventName: string;
  visitorId: string | null;
  matchKeys: MatchKey[];
  occurredAt: number;
  payload: ConversionPayload;
};

/** Queue conversions; a repeat of the same event for a destination is a no-op. Returns rows created. */
export async function enqueueConversions(rows: readonly QueuedConversion[]): Promise<number> {
  if (rows.length === 0) return 0;
  const values = rows.map((r) => ({
    destination_id: r.destinationId,
    website_id: r.websiteId,
    event_id: r.payload.event_id.slice(0, 200),
    kind: r.kind,
    event_name: r.eventName.slice(0, 120),
    platform_event: r.payload.platform_event.slice(0, 120),
    visitor_id: r.visitorId,
    value: r.payload.value,
    currency: r.payload.currency,
    order_id: r.payload.order_id,
    match_keys: r.matchKeys,
    payload: r.payload,
    occurred_at: new Date(r.occurredAt),
  }));
  const inserted = await sql`
    INSERT INTO conversion_events
      (destination_id, website_id, event_id, kind, event_name, platform_event, visitor_id, value, currency, order_id, match_keys, payload, occurred_at)
    SELECT v.destination_id::uuid, v.website_id::uuid, v.event_id, v.kind, v.event_name, v.platform_event, v.visitor_id,
           v.value, v.currency, v.order_id,
           ARRAY(SELECT jsonb_array_elements_text(v.match_keys)), v.payload, v.occurred_at
    FROM jsonb_to_recordset(${JSON.stringify(values)}::jsonb) AS v(
      destination_id text, website_id text, event_id text, kind text, event_name text, platform_event text, visitor_id text,
      value numeric, currency text, order_id text, match_keys jsonb, payload jsonb, occurred_at timestamptz)
    ON CONFLICT (destination_id, event_id) DO NOTHING
    RETURNING id
  `;
  return inserted.length;
}

export type ClaimedConversion = {
  id: string;
  destination_id: string;
  website_id: string;
  attempt_count: number;
  payload: ConversionPayload | null;
  platform: ConversionPlatform;
  credentials: string;
  config: DestinationConfig;
};

/** Take up to `limit` due conversions under a lease. Rows of a disabled destination wait for it. */
export async function claimDueConversions(limit: number): Promise<ClaimedConversion[]> {
  const rows = await sql<ClaimedConversion[]>`
    WITH due AS (
      SELECT e.id FROM conversion_events e
      JOIN conversion_destinations d ON d.id = e.destination_id
      WHERE e.status = 'pending' AND e.next_attempt_at <= NOW()
        AND (e.locked_until IS NULL OR e.locked_until < NOW()) AND d.enabled
      ORDER BY e.next_attempt_at
      LIMIT ${limit}
      FOR UPDATE OF e SKIP LOCKED
    ), claimed AS (
      UPDATE conversion_events e
      SET locked_until = NOW() + make_interval(secs => ${CONVERSION_LEASE_SECONDS}), updated_at = NOW()
      FROM due WHERE e.id = due.id
      RETURNING e.id, e.destination_id, e.website_id, e.attempt_count, e.payload
    )
    SELECT claimed.*, d.platform, d.credentials, d.config
    FROM claimed JOIN conversion_destinations d ON d.id = claimed.destination_id
  `;
  return [...rows];
}

export type ConversionAttemptResult =
  | { kind: "success"; httpStatus: number | null }
  | { kind: "skipped"; error: string }
  | { kind: "retry"; httpStatus: number | null; error: string; nextAttemptAt: Date }
  | { kind: "failed"; httpStatus: number | null; error: string; disableNow: boolean };

/**
 * Record one attempt, and keep the destination's health in step: a success clears its
 * failure streak, a final failure raises it, and at `disableAfter` — or at once for a refused
 * credential — the destination is switched off. A delivered or skipped event's payload is
 * cleared; a failed one keeps it for "Retry".
 */
export async function completeConversion(input: {
  id: string; destinationId: string; attempts: number; result: ConversionAttemptResult; disableAfter: number;
}): Promise<{ disabled: boolean }> {
  const { result } = input;
  return sql.begin(async (tx) => {
    if (result.kind === "retry") {
      await tx`UPDATE conversion_events SET attempt_count = ${input.attempts}, next_attempt_at = ${result.nextAttemptAt},
                 locked_until = NULL, http_status = ${result.httpStatus}, error = ${result.error}, updated_at = NOW()
               WHERE id = ${input.id}::uuid`;
      await tx`UPDATE conversion_destinations SET last_attempt_at = NOW(), last_error = ${result.error} WHERE id = ${input.destinationId}::uuid`;
      return { disabled: false };
    }
    if (result.kind === "success" || result.kind === "skipped") {
      await tx`UPDATE conversion_events SET status = ${result.kind}, attempt_count = ${input.attempts}, locked_until = NULL,
                 http_status = ${result.kind === "success" ? result.httpStatus : null}, error = ${result.kind === "skipped" ? result.error : null},
                 payload = NULL, completed_at = NOW(), updated_at = NOW()
               WHERE id = ${input.id}::uuid`;
      if (result.kind === "success") {
        await tx`UPDATE conversion_destinations SET last_attempt_at = NOW(), consecutive_failures = 0, status = 'active', last_error = NULL
                 WHERE id = ${input.destinationId}::uuid`;
      }
      return { disabled: false };
    }
    await tx`UPDATE conversion_events SET status = 'failed', attempt_count = ${input.attempts}, locked_until = NULL,
               http_status = ${result.httpStatus}, error = ${result.error}, completed_at = NOW(), updated_at = NOW()
             WHERE id = ${input.id}::uuid`;
    const [d] = await tx<{ consecutive_failures: number }[]>`
      UPDATE conversion_destinations SET last_attempt_at = NOW(), last_error = ${result.error}, status = 'error',
        consecutive_failures = consecutive_failures + 1
      WHERE id = ${input.destinationId}::uuid RETURNING consecutive_failures`;
    const disable = result.disableNow || (d?.consecutive_failures ?? 0) >= input.disableAfter;
    if (disable) await tx`UPDATE conversion_destinations SET enabled = FALSE WHERE id = ${input.destinationId}::uuid`;
    return { disabled: disable };
  });
}

/** Queue a failed event again, now. False when it is not a failed event of this site, or its data is gone. */
export async function retryConversion(websiteId: string, id: string): Promise<boolean> {
  const rows = await sql`
    UPDATE conversion_events SET status = 'pending', next_attempt_at = NOW(), attempt_count = 0, error = NULL, completed_at = NULL, updated_at = NOW()
    WHERE website_id = ${websiteId}::uuid AND id = ${id}::uuid AND status = 'failed' AND payload IS NOT NULL
    RETURNING id
  `;
  return rows.length > 0;
}

// --- The delivery log and summary -------------------------------------------------

export async function listConversionEvents(websiteId: string, q: {
  destination: string | null; status: string | null; kind: string | null; limit: number; offset: number;
}): Promise<{ rows: ConversionEventView[]; total: number }> {
  const where = sql`e.website_id = ${websiteId}::uuid
    ${q.destination ? sql`AND e.destination_id = ${q.destination}::uuid` : sql``}
    ${q.status ? sql`AND e.status = ${q.status}` : sql``}
    ${q.kind ? sql`AND e.kind = ${q.kind}` : sql``}`;
  const [rows, totals] = await Promise.all([
    sql<ConversionEventView[]>`
      SELECT e.id, e.destination_id, d.platform, e.kind, e.event_name, e.platform_event, e.status, e.error, e.attempt_count,
             e.match_keys, e.value::float8 AS value, e.currency, e.order_id, e.created_at, e.completed_at
      FROM conversion_events e JOIN conversion_destinations d ON d.id = e.destination_id
      WHERE ${where} ORDER BY e.created_at DESC, e.id LIMIT ${q.limit} OFFSET ${q.offset}
    `,
    sql<[{ c: number }]>`SELECT COUNT(*)::int AS c FROM conversion_events e WHERE ${where}`,
  ]);
  return { rows: [...rows], total: totals[0]?.c ?? 0 };
}

export async function conversionSummary(websiteId: string, days: number): Promise<ConversionSummary> {
  const since = sql`e.website_id = ${websiteId}::uuid AND e.created_at > NOW() - make_interval(days => ${days})`;
  const [[totals], byDay, [match], byKind] = await Promise.all([
    sql<[{ sent: number; accepted: number; failed: number; skipped: number; pending: number }]>`
      SELECT COUNT(*)::int AS sent,
             COUNT(*) FILTER (WHERE status = 'success')::int AS accepted,
             COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
             COUNT(*) FILTER (WHERE status = 'skipped')::int AS skipped,
             COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
      FROM conversion_events e WHERE ${since}`,
    sql<{ day: string; accepted: number; failed: number }[]>`
      SELECT to_char(date_trunc('day', e.created_at), 'YYYY-MM-DD') AS day,
             COUNT(*) FILTER (WHERE status = 'success')::int AS accepted,
             COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
      FROM conversion_events e WHERE ${since} GROUP BY 1 ORDER BY 1`,
    sql<[ConversionSummary["match"]]>`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE 'click_id' = ANY(match_keys))::int AS click_id,
             COUNT(*) FILTER (WHERE 'email' = ANY(match_keys))::int AS email,
             COUNT(*) FILTER (WHERE 'phone' = ANY(match_keys))::int AS phone,
             COUNT(*) FILTER (WHERE 'ip_ua' = ANY(match_keys))::int AS ip_ua,
             COUNT(*) FILTER (WHERE 'browser_id' = ANY(match_keys))::int AS browser_id
      FROM conversion_events e WHERE ${since}`,
    sql<{ kind: ConversionKind; accepted: number }[]>`
      SELECT kind, COUNT(*) FILTER (WHERE status = 'success')::int AS accepted
      FROM conversion_events e WHERE ${since} GROUP BY kind ORDER BY accepted DESC`,
  ]);
  return {
    totals: totals ?? { sent: 0, accepted: 0, failed: 0, skipped: 0, pending: 0 },
    by_day: [...byDay],
    match: match ?? { total: 0, click_id: 0, email: 0, phone: 0, ip_ua: 0, browser_id: 0 },
    by_kind: [...byKind],
  };
}

/** The retention sweep: the log's old rows, per website. */
export async function purgeConversionsBefore(websiteId: string, cutoff: Date): Promise<number> {
  const rows = await sql`DELETE FROM conversion_events WHERE website_id = ${websiteId}::uuid AND created_at < ${cutoff} RETURNING id`;
  return rows.length;
}
