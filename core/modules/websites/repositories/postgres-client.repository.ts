import { and, asc, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { clients, db, websites } from "../../../db";
import {
  COLLECT_FEATURES,
  DASHBOARD_FEATURES,
  FEATURE_ACCESS,
  type Client,
  type ClientListFilter,
  type ClientRepository,
  type ClientStatus,
  type CollectFeature,
  type CreateClientInput,
  type CursorPage,
  type DashboardFeature,
  type FeatureAccess,
  type Page,
  type UpdateClientInput,
  type WebsiteListFilter,
} from "../interfaces/client.interface";
import type { Website } from "../interfaces";
import { toDomain as websiteToDomain } from "./postgres-website.repository";

type ClientRow = typeof clients.$inferSelect;

/** Stored switches → every switch; one never stored is on. */
function resolveCollect(stored: Record<string, boolean> | null): Record<CollectFeature, boolean> {
  const out = {} as Record<CollectFeature, boolean>;
  for (const f of COLLECT_FEATURES) out[f] = stored?.[f] !== false;
  return out;
}

/** Stored access → every page; one never stored (or stored as nonsense) is `off`. */
function resolveDashboard(stored: Record<string, string> | null): Record<DashboardFeature, FeatureAccess> {
  const out = {} as Record<DashboardFeature, FeatureAccess>;
  for (const f of DASHBOARD_FEATURES) {
    const v = stored?.[f];
    out[f] = FEATURE_ACCESS.includes(v as FeatureAccess) ? (v as FeatureAccess) : "off";
  }
  return out;
}

function toDomain(row: ClientRow): Client {
  return {
    id: row.id,
    ownerId: row.userId,
    name: row.name,
    company: row.company,
    notes: row.note,
    status: row.status as ClientStatus,
    collectFeatures: resolveCollect(row.collectFeatures),
    dashboardFeatures: resolveDashboard(row.dashboardFeatures),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** `%term%` with the LIKE wildcards in the term escaped, so `50%` searches for "50%". */
function containing(q: string): string {
  return `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

type CreatedAt = typeof clients.createdAt | typeof websites.createdAt;
type Id = typeof clients.id | typeof websites.id;

/**
 * `created_at` to the millisecond — what a cursor can carry, since it round-trips through a
 * JS `Date`. Ordering and the cursor comparison both use it, so two rows created in the same
 * millisecond are told apart by id alone and neither is skipped at a page boundary.
 */
const ms = (createdAt: CreatedAt) => sql`date_trunc('milliseconds', ${createdAt})`;

/** Rows strictly after the cursor in (created_at DESC, id DESC) order. */
function afterCursor(createdAt: CreatedAt, id: Id, page: CursorPage): SQL | undefined {
  if (!page.after) return undefined;
  const at = page.after.createdAt.toISOString();
  return sql`(${ms(createdAt)} < ${at}::timestamptz OR (${ms(createdAt)} = ${at}::timestamptz AND ${id} < ${page.after.id}::uuid))`;
}

const newestFirst = (createdAt: CreatedAt, id: Id) => [sql`${ms(createdAt)} DESC`, desc(id)];

export class PostgresClientRepository implements ClientRepository {
  async create(ownerId: string, input: CreateClientInput): Promise<Client> {
    const [row] = await db
      .insert(clients)
      .values({
        userId: ownerId,
        name: input.name.trim(),
        company: input.company ?? "",
        note: input.notes ?? "",
        status: input.status ?? "active",
        collectFeatures: compact(input.collectFeatures ?? {}),
      })
      .returning();
    return toDomain(row!);
  }

  async findById(clientId: string): Promise<Client | null> {
    const [row] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    return row ? toDomain(row) : null;
  }

  async list(ownerId: string, filter: ClientListFilter, page: CursorPage): Promise<Client[]> {
    const q = filter.q?.trim();
    const rows = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.userId, ownerId),
          filter.status ? eq(clients.status, filter.status) : undefined,
          q ? or(ilike(clients.name, containing(q)), ilike(clients.company, containing(q))) : undefined,
          afterCursor(clients.createdAt, clients.id, page),
        ),
      )
      .orderBy(...newestFirst(clients.createdAt, clients.id))
      .limit(page.limit);
    return rows.map(toDomain);
  }

  async update(clientId: string, input: UpdateClientInput): Promise<Client | null> {
    const current = await this.findById(clientId);
    if (!current) return null;

    const patch: Partial<typeof clients.$inferInsert> = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.company !== undefined) patch.company = input.company;
    if (input.notes !== undefined) patch.note = input.notes;
    if (input.status !== undefined) patch.status = input.status;
    // Merged rather than replaced, so switching one feature off is a one-key request.
    if (input.collectFeatures !== undefined) {
      patch.collectFeatures = compact({ ...current.collectFeatures, ...input.collectFeatures });
    }
    // Replaced, minus the `off`s: absent already reads as off.
    if (input.dashboardFeatures !== undefined) {
      patch.dashboardFeatures = Object.fromEntries(
        Object.entries(input.dashboardFeatures).filter(([, v]) => v && v !== "off"),
      ) as Record<string, string>;
    }
    if (Object.keys(patch).length === 0) return current;

    const [row] = await db
      .update(clients)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(clients.id, clientId))
      .returning();
    return row ? toDomain(row) : null;
  }

  /** The client's sites stay, ungrouped — cleared here, as `websites.client_id` has no foreign key. */
  async delete(clientId: string): Promise<boolean> {
    return db.transaction(async (tx) => {
      await tx.update(websites).set({ clientId: null, updatedAt: new Date() }).where(eq(websites.clientId, clientId));
      const rows = await tx.delete(clients).where(eq(clients.id, clientId)).returning({ id: clients.id });
      return rows.length > 0;
    });
  }

  async listWebsites(ownerId: string, filter: { clientId?: string } & Page): Promise<Website[]> {
    const where = filter.clientId
      ? and(eq(websites.userId, ownerId), eq(websites.clientId, filter.clientId))
      : eq(websites.userId, ownerId);
    const rows = await db
      .select()
      .from(websites)
      .where(where)
      .orderBy(asc(websites.createdAt), asc(websites.id))
      .limit(filter.limit)
      .offset(filter.offset);
    return rows.map(websiteToDomain);
  }

  async pageWebsites(ownerId: string, filter: WebsiteListFilter, page: CursorPage): Promise<Website[]> {
    const q = filter.q?.trim();
    const rows = await db
      .select()
      .from(websites)
      .where(
        and(
          eq(websites.userId, ownerId),
          filter.unassigned ? isNull(websites.clientId) : filter.clientId ? eq(websites.clientId, filter.clientId) : undefined,
          q ? or(ilike(websites.name, containing(q)), ilike(websites.url, containing(q))) : undefined,
          afterCursor(websites.createdAt, websites.id, page),
        ),
      )
      .orderBy(...newestFirst(websites.createdAt, websites.id))
      .limit(page.limit);
    return rows.map(websiteToDomain);
  }

  async allWebsites(ownerId: string): Promise<Website[]> {
    const rows = await db
      .select()
      .from(websites)
      .where(eq(websites.userId, ownerId))
      .orderBy(asc(websites.createdAt), asc(websites.id));
    return rows.map(websiteToDomain);
  }

  async websitesOfClients(clientIds: string[]): Promise<Website[]> {
    if (clientIds.length === 0) return [];
    const rows = await db
      .select()
      .from(websites)
      .where(inArray(websites.clientId, clientIds))
      .orderBy(asc(websites.createdAt));
    return rows.map(websiteToDomain);
  }

  async markVerified(websiteId: string): Promise<boolean> {
    const rows = await db
      .update(websites)
      .set({ isVerified: true, updatedAt: new Date() })
      .where(and(eq(websites.id, websiteId), eq(websites.isVerified, false)))
      .returning({ id: websites.id });
    return rows.length > 0;
  }
}

/** Store only the switches that are off: "absent is on" keeps old rows right as features are added. */
function compact(features: Partial<Record<CollectFeature, boolean>>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(features)) if (v === false) out[k] = false;
  return out;
}
