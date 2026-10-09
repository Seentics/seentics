import { describe, it, expect, beforeEach } from "bun:test";
import type { CreateWebsiteInput, UpdateWebsiteInput, Website } from "../interfaces";
import {
  CLIENT_FEATURES,
  CLIENT_LIMITS,
  ClientOperationError,
  type Client,
  type ClientRepository,
  type CreateClientInput,
  type Page,
  type UpdateClientInput,
} from "../interfaces/client.interface";
import { ClientService } from "../services/client.service";

const OWNER = "owner-a";
const OTHER = "owner-b";

let seq = 0;
const nextId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

function site(ownerId: string, clientId: string | null = null): Website {
  return {
    id: nextId(), ownerId, name: "s", url: "s.example", trackingId: "t", isActive: true, isVerified: false,
    automationEnabled: true, funnelEnabled: true, errorsEnabled: true, heatmapEnabled: true,
    heatmapIncludePatterns: null, heatmapExcludePatterns: null, heatmapLayoutEnabled: true,
    replayEnabled: true, replaySamplingRate: 1, replayIncludePatterns: null, replayExcludePatterns: null,
    maskAllText: false, maskTextPatterns: null, verificationToken: "v", publicShareId: null, clientId,
    settings: {} as Website["settings"], createdAt: new Date(seq * 1000), updatedAt: new Date(seq * 1000),
  };
}

/** In-memory clients and sites, sharing one site map with the website writes below. */
class FakeClients implements ClientRepository {
  clients = new Map<string, Client>();
  constructor(readonly sites: Map<string, Website>) {}
  /** Simulates the race where another request inserted the same external id first. */
  raceOnNextCreate: Client | null = null;

  async create(ownerId: string, input: CreateClientInput): Promise<Client> {
    if (this.raceOnNextCreate) {
      this.clients.set(this.raceOnNextCreate.id, this.raceOnNextCreate);
      this.raceOnNextCreate = null;
      throw Object.assign(new Error("duplicate"), { code: "23505" });
    }
    const features = Object.fromEntries(CLIENT_FEATURES.map((f) => [f, input.featuresEnabled?.[f] !== false]));
    const limits = Object.fromEntries(CLIENT_LIMITS.map((l) => [l, input.limits?.[l] ?? null]));
    const c: Client = {
      id: nextId(), ownerId, name: input.name, externalId: input.externalId ?? null, company: "", email: "",
      websiteUrl: "", note: "", status: input.status ?? "active", featuresEnabled: features as Client["featuresEnabled"],
      limits: limits as Client["limits"], metadata: {}, createdAt: new Date(), updatedAt: new Date(),
    };
    this.clients.set(c.id, c);
    return c;
  }
  async findById(id: string) { return this.clients.get(id) ?? null; }
  async findByExternalId(ownerId: string, ext: string) {
    return [...this.clients.values()].find((c) => c.ownerId === ownerId && c.externalId === ext) ?? null;
  }
  async list(ownerId: string, page: Page) {
    return [...this.clients.values()].filter((c) => c.ownerId === ownerId).slice(page.offset, page.offset + page.limit);
  }
  async update(id: string, input: UpdateClientInput) {
    const c = this.clients.get(id);
    if (!c) return null;
    const next: Client = {
      ...c,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      featuresEnabled: { ...c.featuresEnabled, ...(input.featuresEnabled ?? {}) } as Client["featuresEnabled"],
      limits: { ...c.limits, ...(input.limits ?? {}) } as Client["limits"],
    };
    this.clients.set(id, next);
    return next;
  }
  async delete(id: string) {
    for (const s of this.sites.values()) if (s.clientId === id) s.clientId = null; // ON DELETE SET NULL
    return this.clients.delete(id);
  }
  async listWebsites(ownerId: string, f: { clientId?: string } & Page) {
    return [...this.sites.values()]
      .filter((s) => s.ownerId === ownerId && (!f.clientId || s.clientId === f.clientId))
      .slice(f.offset, f.offset + f.limit);
  }
  async websitesOfClients(ids: string[]) { return [...this.sites.values()].filter((s) => s.clientId && ids.includes(s.clientId)); }
  async countWebsites(id: string) { return [...this.sites.values()].filter((s) => s.clientId === id).length; }
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

describe("ClientService.createClient", () => {
  it("creates the client and its first site, filed under it", async () => {
    const { client, created } = await service.createClient(OWNER, { name: "Acme", externalId: "t-1" }, { name: "Acme", url: "acme.app.com" });
    expect(created).toBe(true);
    expect(client.websites).toHaveLength(1);
    expect(client.websites[0]!.clientId).toBe(client.id);
  });

  it("is idempotent on external_id: a retry returns the same client and writes nothing", async () => {
    const first = await service.createClient(OWNER, { name: "Acme", externalId: "t-1" }, { name: "Acme", url: "acme.app.com" });
    const again = await service.createClient(OWNER, { name: "Acme", externalId: "t-1" }, { name: "Acme", url: "acme.app.com" });
    expect(again.created).toBe(false);
    expect(again.client.id).toBe(first.client.id);
    expect(sites.size).toBe(1);
  });

  it("returns the winner's client when two retries race on the unique index", async () => {
    const winner = await repo.create(OWNER, { name: "Acme", externalId: "t-race" });
    repo.clients.delete(winner.id);
    repo.raceOnNextCreate = winner;
    const result = await service.createClient(OWNER, { name: "Acme", externalId: "t-race" });
    expect(result.created).toBe(false);
    expect(result.client.id).toBe(winner.id);
  });

  it("scopes external_id to the owner", async () => {
    await service.createClient(OWNER, { name: "A", externalId: "same" });
    const b = await service.createClient(OTHER, { name: "B", externalId: "same" });
    expect(b.created).toBe(true);
  });
});

describe("ownership", () => {
  it("treats another owner's client exactly like a missing one", async () => {
    const { client } = await service.createClient(OWNER, { name: "A" });
    expect(await service.getClient(OTHER, client.id)).toBeNull();
    expect(await service.updateClient(OTHER, client.id, { name: "x" })).toBeNull();
    expect(await service.deleteClient(OTHER, client.id)).toBe(false);
    expect(repo.clients.has(client.id)).toBe(true);
  });

  it("will not file another owner's site under a client", async () => {
    const { client } = await service.createClient(OWNER, { name: "A" });
    const foreign = site(OTHER);
    sites.set(foreign.id, foreign);
    await expect(service.assignWebsite(OWNER, client.id, foreign.id)).rejects.toEqual(
      new ClientOperationError("website_not_found"),
    );
    expect(foreign.clientId).toBeNull();
  });

  it("will not create a site under another owner's client", async () => {
    const { client } = await service.createClient(OTHER, { name: "B" });
    await expect(service.createWebsite(OWNER, { name: "s", url: "s.example", clientId: client.id })).rejects.toEqual(
      new ClientOperationError("not_found"),
    );
  });
});

describe("max_websites", () => {
  it("refuses a site past the client's cap, through every way of adding one", async () => {
    const { client } = await service.createClient(OWNER, { name: "A", limits: { max_websites: 1 } }, { name: "1", url: "one.example" });
    await expect(service.createWebsite(OWNER, { name: "2", url: "two.example", clientId: client.id })).rejects.toEqual(
      new ClientOperationError("website_limit_reached"),
    );
    const loose = site(OWNER);
    sites.set(loose.id, loose);
    await expect(service.assignWebsite(OWNER, client.id, loose.id)).rejects.toEqual(
      new ClientOperationError("website_limit_reached"),
    );
    await expect(service.updateWebsite(OWNER, loose.id, { clientId: client.id })).rejects.toEqual(
      new ClientOperationError("website_limit_reached"),
    );
  });

  it("does not count a site already filed under the client against it", async () => {
    const { client } = await service.createClient(OWNER, { name: "A", limits: { max_websites: 1 } }, { name: "1", url: "one.example" });
    const filed = await service.assignWebsite(OWNER, client.id, client.websites[0]!.id);
    expect(filed.clientId).toBe(client.id);
  });
});

describe("tracker cache invalidation", () => {
  it("fires when a client's switches change, since the tracker row carries them", async () => {
    const { client } = await service.createClient(OWNER, { name: "A" });
    changes = 0;
    await service.updateClient(OWNER, client.id, { featuresEnabled: { replays: false } });
    expect(changes).toBe(1);
  });

  it("fires when a site moves between clients, and not for an unrelated edit", async () => {
    const { client } = await service.createClient(OWNER, { name: "A" });
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
  it("keeps the sites, ungrouped, by default", async () => {
    const { client } = await service.createClient(OWNER, { name: "A" }, { name: "1", url: "one.example" });
    await service.deleteClient(OWNER, client.id);
    expect(deletedSites).toEqual([]);
    expect([...sites.values()][0]!.clientId).toBeNull();
  });

  it("deletes the sites through the normal delete when asked", async () => {
    const { client } = await service.createClient(OWNER, { name: "A" }, { name: "1", url: "one.example" });
    await service.deleteClient(OWNER, client.id, { deleteWebsites: true });
    expect(deletedSites).toHaveLength(1);
    expect(sites.size).toBe(0);
  });
});

describe("listing", () => {
  it("reports has_more from one extra row, without a count query", async () => {
    for (let i = 0; i < 3; i++) await service.createClient(OWNER, { name: `c${i}` });
    const first = await service.listClients(OWNER, { limit: 2, offset: 0 });
    expect(first.items).toHaveLength(2);
    expect(first.hasMore).toBe(true);
    const last = await service.listClients(OWNER, { limit: 2, offset: 2 });
    expect(last.items).toHaveLength(1);
    expect(last.hasMore).toBe(false);
  });
});
