import type { CreateWebsiteInput, UpdateWebsiteInput, Website, WebsiteMutations } from "../interfaces";
import {
  ClientOperationError,
  type Client,
  type ClientDirectory,
  type ClientListFilter,
  type ClientRepository,
  type ClientWithWebsites,
  type CreateClientInput,
  type CursorPage,
  type OwnedWebsites,
  type Page,
  type PageOf,
  type UpdateClientInput,
  type WebsiteListFilter,
} from "../interfaces/client.interface";
import { log } from "../../../platform/observability/logger";

const client_log = log.child({ category: "clients" });

/** One extra row tells us whether there is a next page without a second COUNT query. */
function pageOf<T>(rows: T[], limit: number): PageOf<T> {
  return { items: rows.slice(0, limit), hasMore: rows.length > limit };
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
 * cached row carries the client's switches already applied. It also clears the cached
 * website reads, which is why marking a site verified calls it.
 */
export class ClientService implements ClientDirectory, OwnedWebsites {
  constructor(
    private readonly clients: ClientRepository,
    private readonly siteReads: SiteReads,
    private readonly siteWrites: SiteWrites,
    private readonly onChanged: () => void,
  ) {}

  // ─── Clients ──────────────────────────────────────────────────────────────

  async listClients(ownerId: string, filter: ClientListFilter, page: CursorPage): Promise<PageOf<ClientWithWebsites>> {
    const rows = await this.clients.list(ownerId, filter, { ...page, limit: page.limit + 1 });
    const { items, hasMore } = pageOf(rows, page.limit);
    return { items: await this.withWebsites(items), hasMore };
  }

  async getClient(ownerId: string, clientId: string): Promise<ClientWithWebsites | null> {
    const client = await this.ownedClient(ownerId, clientId);
    return client ? (await this.withWebsites([client]))[0]! : null;
  }

  async createClient(ownerId: string, input: CreateClientInput): Promise<ClientWithWebsites> {
    const client = await this.clients.create(ownerId, input);
    client_log.info({ msg: "client_created", client_id: client.id, owner_id: ownerId });
    return { ...client, websites: [] };
  }

  async updateClient(ownerId: string, clientId: string, input: UpdateClientInput): Promise<ClientWithWebsites | null> {
    if (!(await this.ownedClient(ownerId, clientId))) return null;
    const updated = await this.clients.update(clientId, input);
    if (!updated) return null;
    this.onChanged();
    client_log.info({ msg: "client_updated", client_id: clientId, fields: Object.keys(input) });
    return (await this.withWebsites([updated]))[0]!;
  }

  async deleteClient(ownerId: string, clientId: string): Promise<boolean> {
    if (!(await this.ownedClient(ownerId, clientId))) return false;
    const deleted = await this.clients.delete(clientId);
    if (deleted) {
      this.onChanged();
      client_log.info({ msg: "client_deleted", client_id: clientId });
    }
    return deleted;
  }

  // ─── Websites ─────────────────────────────────────────────────────────────

  async listWebsites(ownerId: string, filter: { clientId?: string } & Page): Promise<PageOf<Website>> {
    const rows = await this.clients.listWebsites(ownerId, { ...filter, limit: filter.limit + 1 });
    return pageOf(rows, filter.limit);
  }

  async pageWebsites(ownerId: string, filter: WebsiteListFilter, page: CursorPage): Promise<PageOf<Website>> {
    const rows = await this.clients.pageWebsites(ownerId, filter, { ...page, limit: page.limit + 1 });
    return pageOf(rows, page.limit);
  }

  allWebsites(ownerId: string): Promise<Website[]> {
    return this.clients.allWebsites(ownerId);
  }

  async getWebsite(ownerId: string, websiteId: string): Promise<Website | null> {
    const site = await this.siteReads.findById(websiteId);
    return site && site.ownerId === ownerId ? site : null;
  }

  async createWebsite(ownerId: string, input: CreateWebsiteInput): Promise<Website> {
    if (input.clientId && !(await this.ownedClient(ownerId, input.clientId))) {
      throw new ClientOperationError("not_found");
    }
    return this.siteWrites.create(ownerId, input);
  }

  async updateWebsite(ownerId: string, websiteId: string, input: UpdateWebsiteInput): Promise<Website | null> {
    const site = await this.getWebsite(ownerId, websiteId);
    if (!site) return null;
    const movesClient = input.clientId !== undefined && input.clientId !== site.clientId;
    if (movesClient && input.clientId && !(await this.ownedClient(ownerId, input.clientId))) {
      throw new ClientOperationError("not_found");
    }
    const updated = await this.siteWrites.update(websiteId, input);
    if (movesClient) {
      this.onChanged();
      client_log.info({ msg: "website_moved", website_id: websiteId, client_id: input.clientId ?? null });
    }
    return updated;
  }

  async deleteWebsite(ownerId: string, websiteId: string): Promise<boolean> {
    if (!(await this.getWebsite(ownerId, websiteId))) return false;
    return this.siteWrites.delete(websiteId);
  }

  async markVerified(ownerId: string, websiteId: string): Promise<void> {
    if (!(await this.getWebsite(ownerId, websiteId))) return;
    if (await this.clients.markVerified(websiteId)) this.onChanged();
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private async ownedClient(ownerId: string, clientId: string): Promise<Client | null> {
    const client = await this.clients.findById(clientId);
    return client && client.ownerId === ownerId ? client : null;
  }

  private async withWebsites(list: Client[]): Promise<ClientWithWebsites[]> {
    const sites = await this.clients.websitesOfClients(list.map((c) => c.id));
    return list.map((c) => ({ ...c, websites: sites.filter((s) => s.clientId === c.id) }));
  }
}
