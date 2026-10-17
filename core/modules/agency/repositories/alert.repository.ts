/** Persistence for the overview's alerts. Every statement is scoped to the owner. */

import { sql } from "../../../db";
import type { AgencyAlert, AlertKind, AlertRepository } from "../interfaces";
import { toDate, toDateOrNull } from "./row-dates";

type Row = {
  id: string;
  owner_id: string;
  client_id: string | null;
  website_id: string | null;
  kind: string;
  resource: string;
  period: string | Date;
  created_at: string | Date;
  dismissed_at: string | Date | null;
};

function toAlert(r: Row): AgencyAlert {
  return {
    id: r.id,
    ownerId: r.owner_id,
    clientId: r.client_id,
    websiteId: r.website_id,
    kind: r.kind as AlertKind,
    resource: r.resource,
    period: r.period instanceof Date ? r.period.toISOString().slice(0, 10) : String(r.period).slice(0, 10),
    createdAt: toDate(r.created_at),
    dismissedAt: toDateOrNull(r.dismissed_at),
  };
}

export class PostgresAlertRepository implements AlertRepository {
  async listOpen(ownerId: string, limit: number): Promise<AgencyAlert[]> {
    const rows = await sql<Row[]>`
      SELECT id, owner_id, client_id, website_id, kind, resource, period, created_at, dismissed_at
      FROM agency_alerts
      WHERE owner_id = ${ownerId}::uuid AND dismissed_at IS NULL
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit}
    `;
    return rows.map(toAlert);
  }

  /** `COALESCE` keeps the first dismissal's time, so dismissing twice is harmless. */
  async dismiss(ownerId: string, alertId: string): Promise<AgencyAlert | null> {
    const [row] = await sql<Row[]>`
      UPDATE agency_alerts SET dismissed_at = COALESCE(dismissed_at, NOW())
      WHERE id = ${alertId}::uuid AND owner_id = ${ownerId}::uuid
      RETURNING id, owner_id, client_id, website_id, kind, resource, period, created_at, dismissed_at
    `;
    return row ? toAlert(row) : null;
  }
}
