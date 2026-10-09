import { and, asc, count, eq, inArray } from "drizzle-orm";
import { clients, db, websites } from "../../../db";
import {
  CLIENT_FEATURES,
  CLIENT_LIMITS,
  type Client,
  type ClientFeature,
  type ClientLimit,
  type ClientRepository,
  type ClientStatus,
  type CreateClientInput,
  type Page,
  type UpdateClientInput,
} from "../interfaces/client.interface";
import type { Website } from "../interfaces";
import { toDomain as websiteToDomain } from "./postgres-website.repository";

type ClientRow = typeof clients.$inferSelect;

/** Stored switches → every switch; one never stored is on. */
function resolveFeatures(stored: Record<string, boolean> | null): Record<ClientFeature, boolean> {
  const out = {} as Record<ClientFeature, boolean>;
  for (const f of CLIENT_FEATURES) out[f] = stored?.[f] !== false;
  return out;
}

/** Stored caps → every cap; one never stored is uncapped. */
function resolveLimits(stored: Record<string, number | null> | null): Record<ClientLimit, number | null> {
  const out = {} as Record<ClientLimit, number | null>;
  for (const l of CLIENT_LIMITS) out[l] = typeof stored?.[l] === "number" ? stored[l]! : null;
  return out;
}

function toDomain(row: ClientRow): Client {
  return {
    id: row.id,
    ownerId: row.userId,
    name: row.name,
    externalId: row.externalId,
    company: row.company,
    email: row.email,
    websiteUrl: row.websiteUrl,
    note: row.note,
    status: row.status as ClientStatus,
    featuresEnabled: resolveFeatures(row.featuresEnabled),
    limits: resolveLimits(row.limits),
    metadata: row.metadata ?? {},
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PostgresClientRepository implements ClientRepository {
  async create(ownerId: string, input: CreateClientInput): Promise<Client> {
    const [row] = await db
      .insert(clients)
      .values({
        userId: ownerId,
        name: input.name.trim(),
        externalId: input.externalId ?? null,
        company: input.company ?? "",
        email: input.email ?? "",
        websiteUrl: input.websiteUrl ?? "",
        note: input.note ?? "",
        status: input.status ?? "active",
        featuresEnabled: compact(input.featuresEnabled ?? {}),
        limits: input.limits ?? {},
        metadata: input.metadata ?? {},
      })
      .returning();
    return toDomain(row!);
  }

  async findById(clientId: string): Promise<Client | null> {
    const [row] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    return row ? toDomain(row) : null;
  }

  async findByExternalId(ownerId: string, externalId: string): Promise<Client | null> {
    const [row] = await db
      .select()
      .from(clients)
      .where(and(eq(clients.userId, ownerId), eq(clients.externalId, externalId)))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async list(ownerId: string, page: Page): Promise<Client[]> {
    const rows = await db
      .select()
      .from(clients)
      .where(eq(clients.userId, ownerId))
      .orderBy(asc(clients.createdAt), asc(clients.id))
      .limit(page.limit)
      .offset(page.offset);
    return rows.map(toDomain);
  }

  async update(clientId: string, input: UpdateClientInput): Promise<Client | null> {
    const current = await this.findById(clientId);
    if (!current) return null;

    const patch: Partial<typeof clients.$inferInsert> = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.externalId !== undefined) patch.externalId = input.externalId;
    if (input.company !== undefined) patch.company = input.company;
    if (input.email !== undefined) patch.email = input.email;
    if (input.websiteUrl !== undefined) patch.websiteUrl = input.websiteUrl;
    if (input.note !== undefined) patch.note = input.note;
    if (input.status !== undefined) patch.status = input.status;
    if (input.metadata !== undefined) patch.metadata = input.metadata;
    // Merged rather than replaced, so switching one feature off is a one-key request.
    if (input.featuresEnabled !== undefined) {
      patch.featuresEnabled = compact({ ...current.featuresEnabled, ...input.featuresEnabled });
    }
    if (input.limits !== undefined) patch.limits = { ...current.limits, ...input.limits };
    if (Object.keys(patch).length === 0) return current;

    const [row] = await db
      .update(clients)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(clients.id, clientId))
      .returning();
    return row ? toDomain(row) : null;
  }

  /** The client's sites stay, ungrouped — cleared here, as the schema has no foreign keys to do it. */
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

  async websitesOfClients(clientIds: string[]): Promise<Website[]> {
    if (clientIds.length === 0) return [];
    const rows = await db
      .select()
      .from(websites)
      .where(inArray(websites.clientId, clientIds))
      .orderBy(asc(websites.createdAt));
    return rows.map(websiteToDomain);
  }

  async countWebsites(clientId: string): Promise<number> {
    const [row] = await db.select({ n: count() }).from(websites).where(eq(websites.clientId, clientId));
    return Number(row?.n ?? 0);
  }
}

/** Store only the switches that are off: "absent is on" keeps old rows right as features are added. */
function compact(features: Partial<Record<ClientFeature, boolean>>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(features)) if (v === false) out[k] = false;
  return out;
}
