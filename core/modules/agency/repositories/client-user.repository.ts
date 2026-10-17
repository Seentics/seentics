/** Persistence for client users. Every statement is scoped by `owner_id`. */

import { sql } from "../../../db";
import type { ClientUser, ClientUserRepository, ClientUserStatus } from "../interfaces";
import { toDate, toDateOrNull } from "./row-dates";

type Row = {
  id: string;
  owner_id: string;
  client_id: string;
  email: string;
  name: string;
  status: ClientUserStatus;
  created_at: string | Date;
  updated_at: string | Date;
  last_seen_at: string | Date | null;
  link_expires_at: string | Date | null;
};

function toClientUser(r: Row): ClientUser {
  return {
    id: r.id,
    ownerId: r.owner_id,
    clientId: r.client_id,
    email: r.email,
    name: r.name,
    status: r.status,
    createdAt: toDate(r.created_at),
    updatedAt: toDate(r.updated_at),
    lastSeenAt: toDateOrNull(r.last_seen_at),
    linkExpiresAt: toDateOrNull(r.link_expires_at),
  };
}

export class PostgresClientUserRepository implements ClientUserRepository {
  async list(ownerId: string, filter: { clientId?: string }): Promise<ClientUser[]> {
    const clientId = filter.clientId ?? null;
    const rows = await sql<Row[]>`
      SELECT u.*,
        (SELECT MAX(t.expires_at) FROM agency_portal_tokens t
          WHERE t.client_user_id = u.id AND t.revoked_at IS NULL AND t.expires_at > NOW()) AS link_expires_at
      FROM agency_client_users u
      WHERE u.owner_id = ${ownerId}::uuid AND (${clientId}::uuid IS NULL OR u.client_id = ${clientId}::uuid)
      ORDER BY u.created_at DESC
    `;
    return rows.map(toClientUser);
  }

  async findById(ownerId: string, id: string): Promise<ClientUser | null> {
    const [row] = await sql<Row[]>`
      SELECT u.*,
        (SELECT MAX(t.expires_at) FROM agency_portal_tokens t
          WHERE t.client_user_id = u.id AND t.revoked_at IS NULL AND t.expires_at > NOW()) AS link_expires_at
      FROM agency_client_users u
      WHERE u.owner_id = ${ownerId}::uuid AND u.id = ${id}::uuid
    `;
    return row ? toClientUser(row) : null;
  }

  async insert(ownerId: string, input: { clientId: string; email: string; name: string }): Promise<ClientUser | null> {
    const [row] = await sql<Row[]>`
      INSERT INTO agency_client_users (owner_id, client_id, email, name)
      VALUES (${ownerId}::uuid, ${input.clientId}::uuid, ${input.email.toLowerCase()}, ${input.name})
      ON CONFLICT (client_id, email) DO NOTHING
      RETURNING *, NULL::timestamptz AS link_expires_at
    `;
    return row ? toClientUser(row) : null;
  }

  async setStatus(ownerId: string, id: string, status: ClientUserStatus): Promise<boolean> {
    const rows = await sql`
      UPDATE agency_client_users SET status = ${status}, updated_at = NOW()
      WHERE owner_id = ${ownerId}::uuid AND id = ${id}::uuid
      RETURNING id
    `;
    return rows.length > 0;
  }

  async delete(ownerId: string, id: string): Promise<boolean> {
    const rows = await sql`
      DELETE FROM agency_client_users WHERE owner_id = ${ownerId}::uuid AND id = ${id}::uuid RETURNING id
    `;
    return rows.length > 0;
  }
}
