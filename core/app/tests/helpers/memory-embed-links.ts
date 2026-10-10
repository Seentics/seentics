import type { EmbedLinkRecord, EmbedLinks, EmbedTarget } from "../../../modules/api-keys/interfaces";

/**
 * The real embed-link service (signing, verification, the live-link cache) over an
 * in-memory repository. Import after the `db`, `logger` and `config` mocks are installed.
 */
export async function memoryEmbedLinks(): Promise<EmbedLinks & { rows: Array<EmbedLinkRecord & { revoked: boolean }> }> {
  const { createEmbedLinkService } = await import("../../../modules/api-keys/services/embed-link.service");
  const rows: Array<EmbedLinkRecord & { revoked: boolean }> = [];
  const matches = (r: EmbedLinkRecord, t: EmbedTarget) => r.targetId === (t.websiteId ?? t.clientId) && r.scope === (t.websiteId ? "website" : "client");
  const service = createEmbedLinkService({
    async insert(ownerId, target, sections) {
      if (rows.some((r) => !r.revoked && matches(r, target))) return null;
      const row = {
        id: crypto.randomUUID(),
        ownerId,
        scope: target.websiteId ? ("website" as const) : ("client" as const),
        targetId: (target.websiteId ?? target.clientId)!,
        sections,
        createdAt: new Date(),
        revoked: false,
      };
      rows.push(row);
      return row;
    },
    findLive: async (t) => rows.find((r) => !r.revoked && matches(r, t)) ?? null,
    findLiveById: async (id) => rows.find((r) => !r.revoked && r.id === id) ?? null,
    listLive: async (ownerId) => rows.filter((r) => !r.revoked && r.ownerId === ownerId),
    async setSections(id, sections) {
      const row = rows.find((r) => !r.revoked && r.id === id);
      if (!row) return null;
      row.sections = sections;
      return row;
    },
    async markRevoked(id) {
      const row = rows.find((r) => !r.revoked && r.id === id);
      if (!row) return null;
      row.revoked = true;
      return { ownerId: row.ownerId };
    },
  });
  return Object.assign(service, { rows });
}
