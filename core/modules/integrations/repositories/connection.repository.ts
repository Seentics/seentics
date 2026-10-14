import { sql } from "../../../db";
import type { ConnectionView, ProviderId } from "../interfaces";

/** A stored connection, credentials still sealed. Never leaves the module. */
export type StoredConnection = {
  id: string;
  website_id: string;
  provider: ProviderId;
  name: string;
  credentials: string;
  config: Record<string, unknown>;
  enabled: boolean;
};

const VIEW_COLUMNS = sql`
  c.id, c.provider, c.name, c.enabled, c.status, c.config, c.credentials_hint, c.consecutive_failures,
  c.last_error, c.last_attempt_at, c.last_success_at, c.created_at, c.updated_at,
  (SELECT COUNT(*)::int FROM integration_deliveries d WHERE d.connection_id = c.id AND d.status = 'pending') AS pending_count
`;

export async function listConnectionViews(websiteId: string): Promise<ConnectionView[]> {
  const rows = await sql<ConnectionView[]>`
    SELECT ${VIEW_COLUMNS} FROM integration_connections c
    WHERE c.website_id = ${websiteId}::uuid
    ORDER BY c.created_at
  `;
  return [...rows];
}

export async function getConnectionView(websiteId: string, id: string): Promise<ConnectionView | null> {
  const [row] = await sql<ConnectionView[]>`
    SELECT ${VIEW_COLUMNS} FROM integration_connections c
    WHERE c.website_id = ${websiteId}::uuid AND c.id = ${id}::uuid
  `;
  return row ?? null;
}

export async function getStoredConnection(websiteId: string, id: string): Promise<StoredConnection | null> {
  const [row] = await sql<StoredConnection[]>`
    SELECT id, website_id, provider, name, credentials, config, enabled FROM integration_connections
    WHERE website_id = ${websiteId}::uuid AND id = ${id}::uuid
  `;
  return row ?? null;
}

export async function countConnectionsOf(websiteId: string): Promise<number> {
  const [row] = await sql<[{ c: number }]>`
    SELECT COUNT(*)::int AS c FROM integration_connections WHERE website_id = ${websiteId}::uuid
  `;
  return row?.c ?? 0;
}

/** Every connection on every website; boot-time sanity check only. */
export async function countConnections(): Promise<number> {
  const [row] = await sql<[{ c: number }]>`SELECT COUNT(*)::int AS c FROM integration_connections`;
  return row?.c ?? 0;
}

/** The id is chosen by the caller because the credentials are sealed against it. */
export async function insertConnection(input: {
  id: string; websiteId: string; provider: string; name: string; credentials: string; hint: string; config: Record<string, unknown>;
}): Promise<void> {
  await sql`
    INSERT INTO integration_connections (id, website_id, provider, name, credentials, credentials_hint, config)
    VALUES (${input.id}::uuid, ${input.websiteId}::uuid, ${input.provider}, ${input.name}, ${input.credentials},
            ${input.hint}, ${JSON.stringify(input.config)}::jsonb)
  `;
}

export type ConnectionPatch = {
  name?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
  /** Replaces the stored secret; also clears a previous failure, since the cause may be gone. */
  credentials?: { sealed: string; hint: string };
};

/**
 * Change a connection. Switching it on, or giving it new credentials, clears its failure
 * state: both are the owner's answer to why it stopped. New credentials turn it on unless the
 * same patch says otherwise.
 */
export async function updateConnection(websiteId: string, id: string, patch: ConnectionPatch): Promise<boolean> {
  const reset = patch.enabled === true || patch.credentials !== undefined;
  const enabled = patch.enabled ?? (patch.credentials !== undefined ? true : null);
  const rows = await sql`
    UPDATE integration_connections SET
      name = COALESCE(${patch.name ?? null}, name),
      enabled = COALESCE(${enabled}::boolean, enabled),
      config = COALESCE(${patch.config ? JSON.stringify(patch.config) : null}::jsonb, config),
      credentials = COALESCE(${patch.credentials?.sealed ?? null}, credentials),
      credentials_hint = COALESCE(${patch.credentials?.hint ?? null}, credentials_hint),
      status = CASE WHEN ${reset} THEN 'active' ELSE status END,
      consecutive_failures = CASE WHEN ${reset} THEN 0 ELSE consecutive_failures END,
      last_error = CASE WHEN ${reset} THEN NULL ELSE last_error END,
      updated_at = NOW()
    WHERE website_id = ${websiteId}::uuid AND id = ${id}::uuid
    RETURNING id
  `;
  return rows.length > 0;
}

export async function deleteConnection(websiteId: string, id: string): Promise<boolean> {
  const rows = await sql`
    DELETE FROM integration_connections
    WHERE website_id = ${websiteId}::uuid AND id = ${id}::uuid
    RETURNING id
  `;
  return rows.length > 0;
}
