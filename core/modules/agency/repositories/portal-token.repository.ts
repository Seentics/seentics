/** Persistence for portal tokens. Holds hashes only; a token never reaches this file. */

import { sql } from "../../../db";
import type { PortalTokenRecord, PortalTokenRepository } from "../interfaces";
import { toDate } from "./row-dates";

type Row = {
  id: string;
  owner_id: string;
  client_id: string;
  client_user_id: string | null;
  token_hash: string;
  expires_at: string | Date;
  created_at: string | Date;
};

function toRecord(r: Row): PortalTokenRecord {
  return {
    id: r.id,
    ownerId: r.owner_id,
    clientId: r.client_id,
    clientUserId: r.client_user_id,
    tokenHash: r.token_hash,
    expiresAt: toDate(r.expires_at),
    createdAt: toDate(r.created_at),
  };
}

export class PostgresPortalTokenRepository implements PortalTokenRepository {
  async insert(row: Omit<PortalTokenRecord, "id" | "createdAt">): Promise<PortalTokenRecord> {
    const [inserted] = await sql<Row[]>`
      INSERT INTO agency_portal_tokens (owner_id, client_id, client_user_id, token_hash, expires_at)
      VALUES (${row.ownerId}::uuid, ${row.clientId}::uuid, ${row.clientUserId}::uuid, ${row.tokenHash}, ${row.expiresAt.toISOString()}::timestamptz)
      RETURNING id, owner_id, client_id, client_user_id, token_hash, expires_at, created_at
    `;
    return toRecord(inserted!);
  }

  /**
   * A client user's token also has to agree with its user on owner and client: the user
   * row is the second witness, so a token row pointing at another tenant's user is dead.
   */
  async findLiveByHash(tokenHash: string): Promise<PortalTokenRecord | null> {
    const [row] = await sql<Row[]>`
      SELECT t.id, t.owner_id, t.client_id, t.client_user_id, t.token_hash, t.expires_at, t.created_at
      FROM agency_portal_tokens t
      LEFT JOIN agency_client_users u ON u.id = t.client_user_id
      WHERE t.token_hash = ${tokenHash}
        AND t.revoked_at IS NULL
        AND t.expires_at > NOW()
        AND (t.client_user_id IS NULL
             OR (u.status <> 'revoked' AND u.owner_id = t.owner_id AND u.client_id = t.client_id))
      LIMIT 1
    `;
    return row ? toRecord(row) : null;
  }

  async revokeForClientUser(ownerId: string, clientUserId: string): Promise<number> {
    const rows = await sql`
      UPDATE agency_portal_tokens SET revoked_at = NOW()
      WHERE owner_id = ${ownerId}::uuid AND client_user_id = ${clientUserId}::uuid AND revoked_at IS NULL
      RETURNING id
    `;
    return rows.length;
  }

  async revokeClientLinks(ownerId: string, clientId: string): Promise<number> {
    const rows = await sql`
      UPDATE agency_portal_tokens SET revoked_at = NOW()
      WHERE owner_id = ${ownerId}::uuid AND client_id = ${clientId}::uuid
        AND client_user_id IS NULL AND revoked_at IS NULL
      RETURNING id
    `;
    return rows.length;
  }

  async markUsed(tokenId: string, clientUserId: string | null): Promise<void> {
    await sql`UPDATE agency_portal_tokens SET last_used_at = NOW() WHERE id = ${tokenId}::uuid`;
    if (!clientUserId) return;
    await sql`
      UPDATE agency_client_users
      SET last_seen_at = NOW(), status = CASE WHEN status = 'invited' THEN 'active' ELSE status END
      WHERE id = ${clientUserId}::uuid AND status <> 'revoked'
    `;
  }
}
