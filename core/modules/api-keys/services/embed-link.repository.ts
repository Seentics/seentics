/** Persistence for embed links: plain row reads and writes, no policy. */

import { and, desc, eq, isNull } from "drizzle-orm";
import { db, embedLinks } from "../../../db";
import { normalizeSections, type EmbedSection } from "../interfaces/embed-sections";
import type { EmbedLinkRecord, EmbedTarget } from "../interfaces";

export interface EmbedLinkRepository {
  /** `null` when the target already has a live link (the unique index refused it). */
  insert(ownerId: string, target: EmbedTarget, sections: EmbedSection[]): Promise<EmbedLinkRecord | null>;
  findLive(target: EmbedTarget): Promise<EmbedLinkRecord | null>;
  findLiveById(linkId: string): Promise<EmbedLinkRecord | null>;
  listLive(ownerId: string): Promise<EmbedLinkRecord[]>;
  setSections(linkId: string, sections: EmbedSection[]): Promise<EmbedLinkRecord | null>;
  /** The revoked link's owner, or `null` when it was unknown or already revoked. */
  markRevoked(linkId: string): Promise<{ ownerId: string } | null>;
}

function toRecord(row: typeof embedLinks.$inferSelect): EmbedLinkRecord {
  return {
    id: row.id,
    ownerId: row.ownerId,
    scope: row.websiteId ? "website" : "client",
    targetId: (row.websiteId ?? row.clientId)!,
    sections: normalizeSections(row.sections),
    createdAt: row.createdAt,
  };
}

const forTarget = (t: EmbedTarget) =>
  t.websiteId ? eq(embedLinks.websiteId, t.websiteId) : eq(embedLinks.clientId, t.clientId!);

export const postgresEmbedLinkRepository: EmbedLinkRepository = {
  async insert(ownerId, target, sections) {
    const [row] = await db
      .insert(embedLinks)
      .values({ ownerId, websiteId: target.websiteId ?? null, clientId: target.clientId ?? null, sections })
      .onConflictDoNothing()
      .returning();
    return row ? toRecord(row) : null;
  },
  async findLive(target) {
    const [row] = await db.select().from(embedLinks).where(and(forTarget(target), isNull(embedLinks.revokedAt))).limit(1);
    return row ? toRecord(row) : null;
  },
  async findLiveById(linkId) {
    const [row] = await db.select().from(embedLinks).where(and(eq(embedLinks.id, linkId), isNull(embedLinks.revokedAt))).limit(1);
    return row ? toRecord(row) : null;
  },
  async listLive(ownerId) {
    const rows = await db
      .select()
      .from(embedLinks)
      .where(and(eq(embedLinks.ownerId, ownerId), isNull(embedLinks.revokedAt)))
      .orderBy(desc(embedLinks.createdAt));
    return rows.map(toRecord);
  },
  async setSections(linkId, sections) {
    const [row] = await db
      .update(embedLinks)
      .set({ sections })
      .where(and(eq(embedLinks.id, linkId), isNull(embedLinks.revokedAt)))
      .returning();
    return row ? toRecord(row) : null;
  },
  async markRevoked(linkId) {
    const rows = await db
      .update(embedLinks)
      .set({ revokedAt: new Date() })
      .where(and(eq(embedLinks.id, linkId), isNull(embedLinks.revokedAt)))
      .returning({ ownerId: embedLinks.ownerId });
    return rows[0] ?? null;
  },
};
