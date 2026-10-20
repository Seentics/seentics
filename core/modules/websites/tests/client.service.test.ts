import { describe, it, expect, beforeEach } from "bun:test";
import type { CreateWebsiteInput, UpdateWebsiteInput, Website } from "../interfaces";
import {
  COLLECT_FEATURES,
  DASHBOARD_FEATURES,
  ClientOperationError,
  type Client,
  type ClientListFilter,
  type ClientRepository,
  type CreateClientInput,
  type CursorPage,
  type Page,
  type UpdateClientInput,
  type WebsiteListFilter,
} from "../interfaces/client.interface";
import { ClientService } from "../services/client.service";

const OWNER = "owner-a";
const OTHER = "owner-b";

let seq = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

function site(ownerId: string, clientId: string | null = null): Website {
  return {
    id: nextId(), ownerId, name: "s", url: "s.example", trackingId: "t", isActive: true, isVerified: false,
    automationEnabled: true, funnelEnabled: true, errorsEnabled: true, profile: null, heatmapEnabled: true,
    heatmapIncludePatterns: null, heatmapExcludePatterns: null, heatmapLayoutEnabled: true,
    replayEnabled: true, replaySamplingRate: 1, replayIncludePatterns: null, replayExcludePatterns: null,
    maskAllText: false, maskTextPatterns: null, verificationToken: "v", publicShareId: null, clientId,
    settings: {} as Website["settings"], createdAt: new Date(seq * 1000), updatedAt: new Date(seq * 1000),
  };
}

/** Newest first, then id descending — the repository's order — and strictly after a cursor. */
function byCursor<T extends { createdAt: Date; id: string }>(rows: T[], page: CursorPage): T[] {
  return rows
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1))
    .filter((r) => !page.after || r.createdAt < page.after.createdAt || (r.createdAt.getTime() === page.after.createdAt.getTime() && r.id < page.after.id))
    .slice(0, page.limit);
}

/** In-memory clients and sites, sharing one site map with the website writes below. */
class FakeClients implements ClientRepository {
  clients = new Map<string, Client>();
  verified: string[] = [];
  constructor(readonly sites: Map<string, Website>) {}

  async create(ownerId: string, input: CreateClientInput): Promise<Client> {
    const c: Client = {
      id: nextId(), ownerId, name: input.name, company: input.company ?? "", notes: input.notes ?? "",
      status: input.status ?? "active",
      collectFeatures: Object.fromEntries(COLLECT_FEATURES.map((f) => [f, input.collectFeatures?.[f] !== false])) as Client["collectFeatures"],
      dashboardFeatures: Object.fromEntries(DASHBOARD_FEATURES.map((f) => [f, "off"])) as Client["dashboardFeatures"],
      createdAt: new Date(++seq * 1000), updatedAt: new Date(),
    };
    this.clients.set(c.id, c);
    return c;
  }
  async findById(id: string) { return this.clients.get(id) ?? null; }
  async list(ownerId: string, filter: ClientListFilter, page: CursorPage) {
    return byCursor([...this.clients.values()].filter((c) =>
      c.ownerId === ownerId && (!filter.status || c.status === filter.status) && (!filter.q || c.name.includes(filter.q))), page);
  }
  async update(id: string, input: UpdateClientInput) {
    const c = this.clients.get(id);
    if (!c) return null;
    const next: Client = {
      ...c,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      collectFeatures: { ...c.collectFeatures, ...(input.collectFeatures ?? {}) } as Client["collectFeatures"],
      dashboardFeatures: input.dashboardFeatures
        ? ({ ...Object.fromEntries(DASHBOARD_FEATURES.map((f) => [f, "off"])), ...input.dashboardFeatures } as Client["dashboardFeatures"])
        : c.dashboardFeatures,
    };
    this.clients.set(id, next);
    return next;
  }
  async delete(id: string) {
    for (const s of this.sites.values()) if (s.clientId === id) s.clientId = null;
    return this.clients.delete(id);
  }
  async listWebsites(ownerId: string, f: { clientId?: string } & Page) {
    return [...this.sites.values()]
      .filter((s) => s.ownerId === ownerId && (!f.clientId || s.clientId === f.clientId))
      .slice(f.offset, f.offset + f.limit);
  }
  async pageWebsites(ownerId: string, f: WebsiteListFilter, page: CursorPage) {
    return byCursor([...this.sites.values()].filter((s) =>
      s.ownerId === ownerId && (f.unassigned ? s.clientId === null : !f.clientId || s.clientId === f.clientId)), page);
  }
  async allWebsites(ownerId: string) { return [...this.sites.values()].filter((s) => s.ownerId === ownerId); }
  async websitesOfClients(ids: string[]) { return [...this.sites.values()].filter((s) => s.clientId && ids.includes(s.clientId)); }
  async markVerified(id: string) {
    const s = this.sites.get(id);
    if (!s || s.isVerified) return false;
    s.isVerified = true;
    this.verified.push(id);
    return true;
  }
}

let sites: Map<string, Website>;
let repo: FakeClients;
let changes: number;
let deletedSites: string[];
let service: ClientService;

beforeEach(() => {
  sites = new Map();
  repo = new FakeClients(sites);
  changes = 0;
  deletedSites = [];
  service = new ClientService(
    repo,
    { findById: async (id) => sites.get(id) ?? null },
    {
      create: async (ownerId: string, input: CreateWebsiteInput) => {
        const s = { ...site(ownerId, input.clientId ?? null), name: input.name, url: input.url };
        sites.set(s.id, s);
        return s;
      },
      update: async (id: string, input: UpdateWebsiteInput) => {
        const s = sites.get(id);
        if (!s) return null;
        if (input.clientId !== undefined) s.clientId = input.clientId;
        return s;
      },
      delete: async (id: string) => {
        deletedSites.push(id);
        return sites.delete(id);
      },
    },
    () => { changes++; },
  );
});

describe("ownership", () => {
  it("treats another owner's client exactly like a missing one", async () => {
    const client = await service.createClient(OWNER, { name: "A" });
    expect(await service.getClient(OTHER, client.id)).toBeNull();
    expect(await service.updateClient(OTHER, client.id, { name: "x" })).toBeNull();
    expect(await service.deleteClient(OTHER, client.id)).toBe(false);
    expect(repo.clients.has(client.id)).toBe(true);
  });

  it("will not move another owner's site, nor file one under another owner's client", async () => {
    const client = await service.createClient(OWNER, { name: "A" });
    const foreign = site(OTHER);
    sites.set(foreign.id, foreign);
    expect(await service.updateWebsite(OWNER, foreign.id, { clientId: client.id })).toBeNull();
    expect(foreign.clientId).toBeNull();
    const mine = site(OWNER);
    sites.set(mine.id, mine);
    const theirs = await service.createClient(OTHER, { name: "B" });
    await expect(service.updateWebsite(OWNER, mine.id, { clientId: theirs.id })).rejects.toEqual(
      new ClientOperationError("not_found"),
    );
  });

  it("moves a site into a client, to another, and back out with updateWebsite", async () => {
    const a = await service.createClient(OWNER, { name: "A" });
    const b = await service.createClient(OWNER, { name: "B" });
    const loose = site(OWNER);
    sites.set(loose.id, loose);
    expect((await service.updateWebsite(OWNER, loose.id, { clientId: a.id }))!.clientId).toBe(a.id);
    expect((await service.updateWebsite(OWNER, loose.id, { clientId: b.id }))!.clientId).toBe(b.id);
    expect((await service.updateWebsite(OWNER, loose.id, { clientId: null }))!.clientId).toBeNull();
  });

  it("will not create a site under another owner's client, and creates any number under its own", async () => {
    const theirs = await service.createClient(OTHER, { name: "B" });
    await expect(service.createWebsite(OWNER, { name: "s", url: "s.example", clientId: theirs.id })).rejects.toEqual(
      new ClientOperationError("not_found"),
    );
    // No per-client site cap in Core any more: plan limits are the gateway's.
    const mine = await service.createClient(OWNER, { name: "A" });
    for (let i = 0; i < 3; i++) await service.createWebsite(OWNER, { name: `s${i}`, url: `s${i}.example`, clientId: mine.id });
    expect((await service.getClient(OWNER, mine.id))!.websites).toHaveLength(3);
  });

  it("marks only the owner's site verified, once, and clears caches when it does", async () => {
    const mine = site(OWNER);
    const theirs = site(OTHER);
    sites.set(mine.id, mine);
    sites.set(theirs.id, theirs);
    await service.markVerified(OWNER, theirs.id);
    expect(theirs.isVerified).toBe(false);
    await service.markVerified(OWNER, mine.id);
    await service.markVerified(OWNER, mine.id);
    expect(repo.verified).toEqual([mine.id]);
    expect(changes).toBe(1);
  });
});

describe("tracker cache invalidation", () => {
  it("fires when a client's switches or status change, since the tracker row carries them", async () => {
    const client = await service.createClient(OWNER, { name: "A" });
    changes = 0;
    await service.updateClient(OWNER, client.id, { collectFeatures: { replays: false } });
    await service.updateClient(OWNER, client.id, { status: "archived" });
    expect(changes).toBe(2);
  });

  it("fires when a site moves between clients, and not for an unrelated edit", async () => {
    const client = await service.createClient(OWNER, { name: "A" });
    const loose = site(OWNER);
    sites.set(loose.id, loose);
    changes = 0;
    await service.updateWebsite(OWNER, loose.id, { name: "renamed" });
    expect(changes).toBe(0);
    await service.updateWebsite(OWNER, loose.id, { clientId: client.id });
    expect(changes).toBe(1);
  });
});

describe("deleteClient", () => {
  it("keeps the sites, ungrouped", async () => {
    const client = await service.createClient(OWNER, { name: "A" });
    await service.createWebsite(OWNER, { name: "1", url: "one.example", clientId: client.id });
    expect(await service.deleteClient(OWNER, client.id)).toBe(true);
    expect(deletedSites).toEqual([]);
    expect([...sites.values()][0]!.clientId).toBeNull();
  });
});

describe("listing", () => {
  it("pages clients newest first by cursor, has_more from one extra row", async () => {
    for (let i = 0; i < 3; i++) await service.createClient(OWNER, { name: `c${i}` });
    const first = await service.listClients(OWNER, {}, { limit: 2 });
    expect(first.items.map((c) => c.name)).toEqual(["c2", "c1"]);
    expect(first.hasMore).toBe(true);
    const last = first.items[1]!;
    const rest = await service.listClients(OWNER, {}, { limit: 2, after: { createdAt: last.createdAt, id: last.id } });
    expect(rest.items.map((c) => c.name)).toEqual(["c0"]);
    expect(rest.hasMore).toBe(false);
  });

  it("filters websites to one client or to those in none", async () => {
    const client = await service.createClient(OWNER, { name: "A" });
    await service.createWebsite(OWNER, { name: "in", url: "in.example", clientId: client.id });
    await service.createWebsite(OWNER, { name: "out", url: "out.example" });
    expect((await service.pageWebsites(OWNER, { clientId: client.id }, { limit: 10 })).items.map((s) => s.name)).toEqual(["in"]);
    expect((await service.pageWebsites(OWNER, { unassigned: true }, { limit: 10 })).items.map((s) => s.name)).toEqual(["out"]);
  });
});
