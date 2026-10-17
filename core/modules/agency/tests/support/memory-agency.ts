import type {
  ClientUser,
  ClientUserRepository,
  ClientUserStatus,
  PortalTokenRecord,
  PortalTokenRepository,
  WhiteLabelRepository,
  WhiteLabelSettings,
} from "../../interfaces";

/**
 * In-memory stand-ins for the three agency repositories, with the same rules their SQL
 * has — owner scoping on every statement, and `findLiveByHash`'s four conditions — so the
 * services' tests exercise the real decisions.
 */

let seq = 0;
export const nextId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

export class MemoryWhiteLabel implements WhiteLabelRepository {
  rows = new Map<string, WhiteLabelSettings>();
  async find(ownerId: string) {
    return this.rows.get(ownerId) ?? null;
  }
  async upsert(s: WhiteLabelSettings) {
    const saved = { ...s, updatedAt: new Date() };
    this.rows.set(s.ownerId, saved);
    return saved;
  }
}

type TokenRow = PortalTokenRecord & { revokedAt: Date | null; lastUsedAt: Date | null };

/** Client users and portal tokens share state, as their tables do (the join, the cascade). */
export class MemoryClientPortal {
  users = new Map<string, Omit<ClientUser, "linkExpiresAt">>();
  tokens: TokenRow[] = [];
  now: () => Date = () => new Date();

  private linkExpiry(userId: string): Date | null {
    const live = this.tokens.filter((t) => t.clientUserId === userId && !t.revokedAt && t.expiresAt > this.now());
    return live.length ? new Date(Math.max(...live.map((t) => t.expiresAt.getTime()))) : null;
  }

  private withLink = (u: Omit<ClientUser, "linkExpiresAt">): ClientUser => ({ ...u, linkExpiresAt: this.linkExpiry(u.id) });

  readonly clientUsers: ClientUserRepository = {
    list: async (ownerId, filter) =>
      [...this.users.values()]
        .filter((u) => u.ownerId === ownerId && (!filter.clientId || u.clientId === filter.clientId))
        .reverse()
        .map(this.withLink),
    findById: async (ownerId, id) => {
      const u = this.users.get(id);
      return u && u.ownerId === ownerId ? this.withLink(u) : null;
    },
    insert: async (ownerId, input) => {
      const email = input.email.toLowerCase();
      if ([...this.users.values()].some((u) => u.clientId === input.clientId && u.email === email)) return null;
      const now = this.now();
      const u = { id: nextId(), ownerId, clientId: input.clientId, email, name: input.name, status: "invited" as ClientUserStatus, createdAt: now, updatedAt: now, lastSeenAt: null };
      this.users.set(u.id, u);
      return this.withLink(u);
    },
    setStatus: async (ownerId, id, status) => {
      const u = this.users.get(id);
      if (!u || u.ownerId !== ownerId) return false;
      u.status = status;
      return true;
    },
    delete: async (ownerId, id) => {
      const u = this.users.get(id);
      if (!u || u.ownerId !== ownerId) return false;
      this.users.delete(id);
      // ON DELETE CASCADE
      this.tokens = this.tokens.filter((t) => t.clientUserId !== id);
      return true;
    },
  };

  readonly portalTokens: PortalTokenRepository = {
    insert: async (row) => {
      const record: TokenRow = { ...row, id: nextId(), createdAt: this.now(), revokedAt: null, lastUsedAt: null };
      this.tokens.push(record);
      return record;
    },
    findLiveByHash: async (hash) => {
      const t = this.tokens.find((r) => r.tokenHash === hash);
      if (!t || t.revokedAt || t.expiresAt <= this.now()) return null;
      if (t.clientUserId) {
        const u = this.users.get(t.clientUserId);
        if (!u || u.status === "revoked" || u.ownerId !== t.ownerId || u.clientId !== t.clientId) return null;
      }
      return t;
    },
    revokeForClientUser: async (ownerId, clientUserId) => {
      const hit = this.tokens.filter((t) => t.ownerId === ownerId && t.clientUserId === clientUserId && !t.revokedAt);
      for (const t of hit) t.revokedAt = this.now();
      return hit.length;
    },
    revokeClientLinks: async (ownerId, clientId) => {
      const hit = this.tokens.filter((t) => t.ownerId === ownerId && t.clientId === clientId && !t.clientUserId && !t.revokedAt);
      for (const t of hit) t.revokedAt = this.now();
      return hit.length;
    },
    markUsed: async (tokenId, clientUserId) => {
      const t = this.tokens.find((r) => r.id === tokenId);
      if (t) t.lastUsedAt = this.now();
      const u = clientUserId ? this.users.get(clientUserId) : undefined;
      if (u && u.status !== "revoked") {
        u.lastSeenAt = this.now();
        if (u.status === "invited") u.status = "active";
      }
    },
  };
}

export type FakeClient = {
  id: string;
  ownerId: string;
  name: string;
  company: string;
  status: string;
  featuresEnabled: Record<string, boolean>;
  websites: { id: string; ownerId: string; clientId: string | null; name: string; url: string }[];
};

/** `ClientDirectory.getClient`: another owner's client reads as missing. */
export function fakeClientDirectory(clients: FakeClient[]) {
  return {
    getClient: async (ownerId: string, clientId: string) => {
      const c = clients.find((x) => x.id === clientId);
      return c && c.ownerId === ownerId ? (c as never) : null;
    },
  };
}
