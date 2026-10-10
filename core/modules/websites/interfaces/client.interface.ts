/**
 * Clients: an account's own customers — an agency's clients, a platform's tenants —
 * each grouping some of that account's websites.
 *
 * Part of the websites module because a client is only ever a way of grouping and
 * governing websites: its feature switches are applied to its sites when the tracker
 * resolves them, and its one in-module limit counts them.
 */

import type { CreateWebsiteInput, UpdateWebsiteInput, Website } from "./website.interface";

export const CLIENT_STATUSES = ["active", "suspended", "archived"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

/**
 * Features a client can have switched off. `analytics` off stops collection entirely —
 * every other feature rides on the same tracker.
 */
export const CLIENT_FEATURES = ["analytics", "heatmaps", "replays", "funnels", "automations", "errors"] as const;
export type ClientFeature = (typeof CLIENT_FEATURES)[number];

/**
 * Caps on a client's usage; `null` is uncapped.
 *
 * `max_websites` is enforced by this module. The usage caps are counted per calendar
 * month, and enforced where ingest quota already is — the gateway in managed Cloud.
 */
export const CLIENT_LIMITS = ["max_websites", "max_monthly_events", "max_replays", "max_heatmaps"] as const;
export type ClientLimit = (typeof CLIENT_LIMITS)[number];

export type Client = {
  id: string;
  ownerId: string;
  name: string;
  /** The caller's own id for this tenant; unique per owner. */
  externalId: string | null;
  company: string;
  email: string;
  websiteUrl: string;
  note: string;
  status: ClientStatus;
  /** Every feature, resolved: a switch never stored reads as on. */
  featuresEnabled: Record<ClientFeature, boolean>;
  /** Every limit, resolved: one never stored reads as `null`. */
  limits: Record<ClientLimit, number | null>;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export type ClientWithWebsites = Client & { websites: Website[] };

export type CreateClientInput = {
  name: string;
  externalId?: string | null;
  company?: string;
  email?: string;
  websiteUrl?: string;
  note?: string;
  status?: ClientStatus;
  featuresEnabled?: Partial<Record<ClientFeature, boolean>>;
  limits?: Partial<Record<ClientLimit, number | null>>;
  metadata?: Record<string, unknown>;
};

/** Absent leaves a field alone. Switches and limits merge into what is stored. */
export type UpdateClientInput = Partial<CreateClientInput>;

export type Page = { limit: number; offset: number };
export type PageOf<T> = { items: T[]; hasMore: boolean };

/** Persistence for clients and the client side of `websites.client_id`. */
export interface ClientRepository {
  create(ownerId: string, input: CreateClientInput): Promise<Client>;
  findById(clientId: string): Promise<Client | null>;
  findByExternalId(ownerId: string, externalId: string): Promise<Client | null>;
  list(ownerId: string, page: Page): Promise<Client[]>;
  update(clientId: string, input: UpdateClientInput): Promise<Client | null>;
  /** Sites are not deleted: their `client_id` is cleared in the same transaction. */
  delete(clientId: string): Promise<boolean>;

  /** One owner's websites, oldest first, optionally only one client's. */
  listWebsites(ownerId: string, filter: { clientId?: string } & Page): Promise<Website[]>;
  /** Websites per client, for a page of clients at once. */
  websitesOfClients(clientIds: string[]): Promise<Website[]>;
  countWebsites(clientId: string): Promise<number>;
}

/** Why a client operation was refused. Routes map each to a status. */
export type ClientFailure =
  | "not_found"
  | "website_not_found"
  | "website_limit_reached"
  | "external_id_taken";

export class ClientOperationError extends Error {
  constructor(readonly reason: ClientFailure) {
    super(reason);
  }
}

/**
 * Managing clients and their websites, on behalf of one owner.
 *
 * Every method takes the owner and treats a client or website the owner does not own
 * exactly like one that does not exist, so an id from another account learns nothing.
 * Consumed by the agency dashboard routes and by the management API.
 */
export interface ClientDirectory {
  listClients(ownerId: string, page: Page): Promise<PageOf<ClientWithWebsites>>;
  getClient(ownerId: string, clientId: string): Promise<ClientWithWebsites | null>;
  getClientByExternalId(ownerId: string, externalId: string): Promise<ClientWithWebsites | null>;

  /**
   * Create a client, and optionally its first website.
   *
   * Idempotent on `externalId`: when the owner already has a client with it, that
   * client comes back with `created: false` and nothing is written — a retried signup
   * handler must not make a second tenant.
   */
  createClient(
    ownerId: string,
    input: CreateClientInput,
    website?: Omit<CreateWebsiteInput, "clientId">,
  ): Promise<{ client: ClientWithWebsites; created: boolean }>;

  updateClient(ownerId: string, clientId: string, input: UpdateClientInput): Promise<ClientWithWebsites | null>;

  /** `deleteWebsites` also deletes the client's sites and everything they collected. */
  deleteClient(ownerId: string, clientId: string, opts?: { deleteWebsites?: boolean }): Promise<boolean>;

}

/**
 * An owner's websites, for callers acting as that owner without a dashboard session.
 *
 * The dashboard has its own routes with member roles; this surface is owner-only.
 */
export interface OwnedWebsites {
  listWebsites(ownerId: string, filter: { clientId?: string } & Page): Promise<PageOf<Website>>;
  getWebsite(ownerId: string, websiteId: string): Promise<Website | null>;
  /** A `clientId` is checked against the owner and the client's `max_websites`. */
  createWebsite(ownerId: string, input: CreateWebsiteInput): Promise<Website>;
  updateWebsite(ownerId: string, websiteId: string, input: UpdateWebsiteInput): Promise<Website | null>;
  deleteWebsite(ownerId: string, websiteId: string): Promise<boolean>;
}
