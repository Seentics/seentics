/**
 * The setup guide's two reads beyond this module's settings: whether any client has a
 * member, and the gateway's custom domain for the owner.
 */

import { sql } from "../../../db";
import type { SetupSignalRepository } from "../interfaces";

export class PostgresSetupSignalRepository implements SetupSignalRepository {
  async hasClientMember(ownerId: string): Promise<boolean> {
    const [row] = await sql<{ ok: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM client_members WHERE owner_id = ${ownerId}::uuid) AS ok
    `;
    return Boolean(row?.ok);
  }

  /**
   * `agency_custom_domains` is the gateway's table (gateway/db/sql/046), read here and never
   * written. A self-hosted Core runs without the gateway, so the table may not exist: asked
   * first rather than caught, so a missing table is not an error in the logs.
   */
  async customDomain(ownerId: string): Promise<{ hostname: string; state: string } | null> {
    const [exists] = await sql<{ ok: boolean }[]>`SELECT to_regclass('public.agency_custom_domains') IS NOT NULL AS ok`;
    if (!exists?.ok) return null;
    const [row] = await sql<{ hostname: string; state: string }[]>`
      SELECT hostname, state FROM agency_custom_domains WHERE owner_user_id = ${ownerId}::uuid
    `;
    return row ?? null;
  }
}
