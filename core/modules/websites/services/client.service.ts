import type { CreateWebsiteInput, UpdateWebsiteInput, Website, WebsiteMutations } from "../interfaces";
import {
  ClientOperationError,
  type Client,
  type ClientDirectory,
  type ClientRepository,
  type ClientWithWebsites,
  type CreateClientInput,
  type OwnedWebsites,
  type Page,
  type PageOf,
  type UpdateClientInput,
} from "../interfaces/client.interface";
import { log } from "../../../platform/observability/logger";

const client_log = log.child({ category: "clients" });

/** Postgres unique_violation. */
const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(e: unknown): boolean {
  return (e as { code?: unknown })?.code === UNIQUE_VIOLATION;
}

/** One extra row tells us whether there is a next page without a second COUNT query. */
function pageOf<T>(rows: T[], page: Page): PageOf<T> {
  return { items: rows.slice(0, page.limit), hasMore: rows.length > page.limit };
}

type SiteWrites = Pick<WebsiteMutations, "create" | "update" | "delete">;
type SiteReads = { findById(websiteId: string): Promise<Website | null> };

/**
 * Clients, and an owner's websites as seen by callers acting for that owner.
 *
 * Every lookup is by owner: a client or site belonging to someone else answers exactly
 * like one that does not exist.
 *
 * `onChanged` runs after anything that alters what the tracker resolves for a site — a
 * client's status or switches, or a site moving between clients — because the tracker's
 * cached row carries the client's switches already applied.
 */
export class ClientService implements ClientDirectory, OwnedWebsites {
  constructor(
    private readonly clients: ClientRepository,
    private readonly siteReads: SiteReads,
    private readonly siteWrites: SiteWrites,
    private readonly onChanged: () => void,
  ) {}

  // ─── Clients ──────────────────────────────────────────────────────────────

  async listClients(ownerId: string, page: Page): Promise<PageOf<ClientWithWebsites>> {
    const rows = await this.clients.list(ownerId, { limit: page.limit + 1, offset: page.offset });
    const { items, hasMore } = pageOf(rows, page);
    return { items: await this.withWebsites(items), hasMore };
  }

  async getClient(ownerId: string, clientId: string): Promise<ClientWithWebsites | null> {
    const client = await this.ownedClient(ownerId, clientId);
    return client ? (await this.withWebsites([client]))[0]! : null;
  }

  async getClientByExternalId(ownerId: string, externalId: string): Promise<ClientWithWebsites | null> {
    const client = await this.clients.findByExternalId(ownerId, externalId);
    return client ? (await this.withWebsites([client]))[0]! : null;
  }

  async createClient(
    ownerId: string,
    input: CreateClientInput,
    website?: Omit<CreateWebsiteInput, "clientId">,
  ): Promise<{ client: ClientWithWebsites; created: boolean }> {
    if (input.externalId) {
      const existing = await this.getClientByExternalId(ownerId, input.externalId);
      if (existing) return { client: existing, created: false };
    }

    let client: Client;
    try {
      client = await this.clients.create(ownerId, input);
    } catch (e) {
      // Two retries of the same signup racing: the loser returns the winner's client.
      if (isUniqueViolation(e) && input.externalId) {
        const existing = await this.getClientByExternalId(ownerId, input.externalId);
        if (existing) return { client: existing, created: false };
      }
      throw e;
    }
    client_log.info({ msg: "client_created", client_id: client.id, owner_id: ownerId });

    if (website) {
      await this.createWebsite(ownerId, { ...website, clientId: client.id });
    }
    return { client: (await this.withWebsites([client]))[0]!, created: true };
  }

  async updateClient(ownerId: string, clientId: string, input: UpdateClientInput): Promise<ClientWithWebsites | null> {
    if (!(await this.ownedClient(ownerId, clientId))) return null;
    let updated: Client | null;
    try {
      updated = await this.clients.update(clientId, input);
    } catch (e) {
      if (isUniqueViolation(e)) throw new ClientOperationError("external_id_taken");
      throw e;
    }
    if (!updated) return null;
    this.onChanged();
    client_log.info({ msg: "client_updated", client_id: clientId, fields: Object.keys(input) });
    return (await this.withWebsites([updated]))[0]!;
  }

  async deleteClient(ownerId: string, clientId: string, opts: { deleteWebsites?: boolean } = {}): Promise<boolean> {
    if (!(await this.ownedClient(ownerId, clientId))) return false;
    if (opts.deleteWebsites) {
      // One at a time through the normal delete, which erases each site's collected data.
      for (const site of await this.clients.websitesOfClients([clientId])) {
        await this.siteWrites.delete(site.id);
      }
    }
    const deleted = await this.clients.delete(clientId);
    if (deleted) {
      this.onChanged();
      client_log.info({ msg: "client_deleted", client_id: clientId, websites_deleted: !!opts.deleteWebsites });
    }
    return deleted;
  }

  async assignWebsite(ownerId: string, clientId: string, websiteId: string): Promise<Website> {
    const client = await this.ownedClient(ownerId, clientId);
    if (!client) throw new ClientOperationError("not_found");
    const site = await this.getWebsite(ownerId, websiteId);
    if (!site) throw new ClientOperationError("website_not_found");
    if (site.clientId === clientId) return site;
    await this.assertRoomFor(client);
    const updated = await this.siteWrites.update(websiteId, { clientId });
    this.onChanged();
    return updated!;
  }

  async unassignWebsite(ownerId: string, clientId: string, websiteId: string): Promise<boolean> {
    if (!(await this.ownedClient(ownerId, clientId))) return false;
    const site = await this.getWebsite(ownerId, websiteId);
    if (!site || site.clientId !== clientId) return false;
    await this.siteWrites.update(websiteId, { clientId: null });
    this.onChanged();
    return true;
  }

  // ─── Websites ─────────────────────────────────────────────────────────────

  async listWebsites(ownerId: string, filter: { clientId?: string } & Page): Promise<PageOf<Website>> {
    const rows = await this.clients.listWebsites(ownerId, { ...filter, limit: filter.limit + 1 });
    return pageOf(rows, filter);
  }

  async getWebsite(ownerId: string, websiteId: string): Promise<Website | null> {
    const site = await this.siteReads.findById(websiteId);
    return site && site.ownerId === ownerId ? site : null;
  }

  async createWebsite(ownerId: string, input: CreateWebsiteInput): Promise<Website> {
    if (input.clientId) {
      const client = await this.ownedClient(ownerId, input.clientId);
      if (!client) throw new ClientOperationError("not_found");
      await this.assertRoomFor(client);
    }
    return this.siteWrites.create(ownerId, input);
  }

  async updateWebsite(ownerId: string, websiteId: string, input: UpdateWebsiteInput): Promise<Website | null> {
    const site = await this.getWebsite(ownerId, websiteId);
    if (!site) return null;
    const movesClient = input.clientId !== undefined && input.clientId !== site.clientId;
    if (movesClient && input.clientId) {
      const client = await this.ownedClient(ownerId, input.clientId);
      if (!client) throw new ClientOperationError("not_found");
      await this.assertRoomFor(client);
    }
    const updated = await this.siteWrites.update(websiteId, input);
    if (movesClient) this.onChanged();
    return updated;
  }

  async deleteWebsite(ownerId: string, websiteId: string): Promise<boolean> {
    if (!(await this.getWebsite(ownerId, websiteId))) return false;
    return this.siteWrites.delete(websiteId);
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private async ownedClient(ownerId: string, clientId: string): Promise<Client | null> {
    const client = await this.clients.findById(clientId);
    return client && client.ownerId === ownerId ? client : null;
  }

  private async assertRoomFor(client: Client): Promise<void> {
    const max = client.limits.max_websites;
    if (max === null) return;
    if ((await this.clients.countWebsites(client.id)) >= max) {
      throw new ClientOperationError("website_limit_reached");
    }
  }

  private async withWebsites(list: Client[]): Promise<ClientWithWebsites[]> {
    const sites = await this.clients.websitesOfClients(list.map((c) => c.id));
    return list.map((c) => ({ ...c, websites: sites.filter((s) => s.clientId === c.id) }));
  }
}
