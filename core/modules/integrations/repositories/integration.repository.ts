import { sql } from "../../../db";
import type { ConnectionView, DeliveryStatus, DeliveryView, ProviderId } from "../interfaces";

/** Newest deliveries kept per connection; older ones are trimmed as new ones are written. */
export const DELIVERIES_KEPT_PER_CONNECTION = 200;

/** A stored connection, credentials still sealed. Never leaves the module. */
export type StoredConnection = {
  id: string;
  website_id: string;
  provider: ProviderId;
  credentials: string;
  config: Record<string, unknown>;
  enabled: boolean;
};

const VIEW_COLUMNS = sql`
  provider, enabled, status, config, credentials_hint, consecutive_failures, last_error,
  last_attempt_at, last_success_at, created_at, updated_at
`;

export async function listConnectionViews(websiteId: string): Promise<ConnectionView[]> {
  const rows = await sql<ConnectionView[]>`
    SELECT ${VIEW_COLUMNS} FROM integration_connections WHERE website_id = ${websiteId}::uuid
  `;
  return [...rows];
}

export async function getConnectionView(websiteId: string, provider: string): Promise<ConnectionView | null> {
  const [row] = await sql<ConnectionView[]>`
    SELECT ${VIEW_COLUMNS} FROM integration_connections
    WHERE website_id = ${websiteId}::uuid AND provider = ${provider}
  `;
  return row ?? null;
}

export async function getStoredConnection(websiteId: string, provider: string): Promise<StoredConnection | null> {
  const [row] = await sql<StoredConnection[]>`
    SELECT id, website_id, provider, credentials, config, enabled FROM integration_connections
    WHERE website_id = ${websiteId}::uuid AND provider = ${provider}
  `;
  return row ?? null;
}

/** Connections that should receive a lead: enabled, on this website. */
export async function listEnabledConnections(websiteId: string): Promise<StoredConnection[]> {
  const rows = await sql<StoredConnection[]>`
    SELECT id, website_id, provider, credentials, config, enabled FROM integration_connections
    WHERE website_id = ${websiteId}::uuid AND enabled
    ORDER BY created_at
  `;
  return [...rows];
}

/** Create the connection or replace the existing one, resetting its failure state. */
export async function upsertConnection(input: {
  websiteId: string; provider: string; credentials: string; hint: string; config: Record<string, unknown>;
}): Promise<void> {
  await sql`
    INSERT INTO integration_connections (website_id, provider, credentials, credentials_hint, config)
    VALUES (${input.websiteId}::uuid, ${input.provider}, ${input.credentials}, ${input.hint}, ${JSON.stringify(input.config)}::jsonb)
    ON CONFLICT (website_id, provider) DO UPDATE SET
      credentials = EXCLUDED.credentials,
      credentials_hint = EXCLUDED.credentials_hint,
      config = EXCLUDED.config,
      enabled = TRUE,
      status = 'active',
      consecutive_failures = 0,
      last_error = NULL,
      updated_at = NOW()
  `;
}

/** Change config and/or the enabled switch. Turning it on clears a previous failure. */
export async function updateConnection(
  websiteId: string,
  provider: string,
  patch: { enabled?: boolean; config?: Record<string, unknown> },
): Promise<boolean> {
  const rows = await sql`
    UPDATE integration_connections SET
      enabled = COALESCE(${patch.enabled ?? null}::boolean, enabled),
      config = COALESCE(${patch.config ? JSON.stringify(patch.config) : null}::jsonb, config),
      status = CASE WHEN ${patch.enabled === true} THEN 'active' ELSE status END,
      consecutive_failures = CASE WHEN ${patch.enabled === true} THEN 0 ELSE consecutive_failures END,
      last_error = CASE WHEN ${patch.enabled === true} THEN NULL ELSE last_error END,
      updated_at = NOW()
    WHERE website_id = ${websiteId}::uuid AND provider = ${provider}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function deleteConnection(websiteId: string, provider: string): Promise<boolean> {
  const rows = await sql`
    DELETE FROM integration_connections
    WHERE website_id = ${websiteId}::uuid AND provider = ${provider}
    RETURNING id
  `;
  return rows.length > 0;
}

/**
 * Record how a delivery went, and keep the connection's health in step.
 *
 * Success zeroes the failure streak. A failure raises it, and at `disableAfter` — or at once
 * when `disableNow` (a refused credential) — the connection is switched off and marked
 * `error`, so a revoked key stops costing a request per lead. A skip changes nothing about
 * health: a lead without consent is the connection working as designed.
 */
export async function recordDelivery(input: {
  connectionId: string;
  websiteId: string;
  contactId: string | null;
  status: DeliveryStatus;
  attempts: number;
  httpStatus: number | null;
  error: string | null;
  durationMs: number;
  disableAfter: number;
  disableNow: boolean;
}): Promise<{ disabled: boolean }> {
  return sql.begin(async (tx) => {
    await tx`
      INSERT INTO integration_deliveries
        (connection_id, website_id, contact_id, status, attempt_count, http_status, error, duration_ms)
      VALUES (${input.connectionId}::uuid, ${input.websiteId}::uuid, ${input.contactId}::uuid, ${input.status},
              ${input.attempts}, ${input.httpStatus}, ${input.error}, ${input.durationMs})
    `;

    // Trim in the same transaction; the (connection_id, created_at) index makes this a short range scan.
    await tx`
      DELETE FROM integration_deliveries
      WHERE connection_id = ${input.connectionId}::uuid
        AND id NOT IN (
          SELECT id FROM integration_deliveries
          WHERE connection_id = ${input.connectionId}::uuid
          ORDER BY created_at DESC LIMIT ${DELIVERIES_KEPT_PER_CONNECTION}
        )
    `;

    if (input.status === "skipped") return { disabled: false };

    if (input.status === "success") {
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
        last_error = ${input.error},
        last_attempt_at = NOW(),
        enabled = CASE WHEN ${input.disableNow} OR consecutive_failures + 1 >= ${input.disableAfter} THEN FALSE ELSE enabled END,
        status = CASE WHEN ${input.disableNow} OR consecutive_failures + 1 >= ${input.disableAfter} THEN 'error' ELSE status END
      WHERE id = ${input.connectionId}::uuid
      RETURNING enabled
    `;
    return { disabled: row ? !row.enabled : false };
  });
}

export async function recentDeliveries(websiteId: string, limit: number): Promise<DeliveryView[]> {
  const rows = await sql<DeliveryView[]>`
    SELECT d.id, c.provider, d.contact_id, d.status, d.attempt_count, d.http_status, d.error, d.duration_ms, d.created_at
    FROM integration_deliveries d
    JOIN integration_connections c ON c.id = d.connection_id
    WHERE d.website_id = ${websiteId}::uuid
    ORDER BY d.created_at DESC
    LIMIT ${limit}
  `;
  return [...rows];
}

export async function countConnections(): Promise<number> {
  const [row] = await sql<[{ c: number }]>`SELECT COUNT(*)::int AS c FROM integration_connections`;
  return row?.c ?? 0;
}

export async function purgeDeliveriesBefore(websiteId: string, cutoff: Date): Promise<number> {
  const rows = await sql`
    DELETE FROM integration_deliveries
    WHERE website_id = ${websiteId}::uuid AND created_at < ${cutoff}
    RETURNING id
  `;
  return rows.length;
}
