/**
 * Clients: an agency's own customers, each grouping some of that account's websites.
 *
 * Part of the websites module because a client is only ever a way of grouping and
 * governing websites: its collection switches are applied to its sites when the tracker
 * resolves them. The agency workspace (`modules/agency`) is its one HTTP surface and reaches
 * it only through `ClientDirectory` and `OwnedWebsites`.
 */

import type { CreateWebsiteInput, UpdateWebsiteInput, Website } from "./website.interface";
import { normalizeHostname } from "../lib/hostname";

/** `archived` and `suspended` both stop the client's sites collecting (tracker-website.repository.ts). */
export const CLIENT_STATUSES = ["active", "suspended", "archived"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

/**
 * What the tracker may collect for a client's sites (`clients.collect_features`). `analytics`
 * off stops collection entirely — every other feature rides on the same tracker.
 */
export const COLLECT_FEATURES = ["analytics", "heatmaps", "replays", "funnels", "automations", "errors"] as const;
export type CollectFeature = (typeof COLLECT_FEATURES)[number];

/**
 * The dashboard pages a client user may open, each `off`, `view` or `edit`
 * (`clients.dashboard_features`). Stored and validated now; enforcement arrives with client
 * sign-in (docs/agency-workspace.md, phase 2). Mirrored by the gateway's route map.
 */
export const DASHBOARD_FEATURES = [
  "overview",
  "events",
  "paths",
  "revenue",
  "recordings",
  "heatmaps",
  "funnels",
  "goals",
  "automations",
  "leads",
  "conversions",
  "ai",
  "errors",
  "privacy",
] as const;
export type DashboardFeature = (typeof DASHBOARD_FEATURES)[number];

export const FEATURE_ACCESS = ["off", "view", "edit"] as const;
export type FeatureAccess = (typeof FEATURE_ACCESS)[number];

export type Client = {
  id: string;
  ownerId: string;
  name: string;
  company: string;
  notes: string;
  status: ClientStatus;
  /** Every switch, resolved: one never stored reads as on. */
  collectFeatures: Record<CollectFeature, boolean>;
  /** Every page, resolved: one never stored reads as `off`. */
  dashboardFeatures: Record<DashboardFeature, FeatureAccess>;
  createdAt: Date;
  updatedAt: Date;
};

export type ClientWithWebsites = Client & { websites: Website[] };

export type CreateClientInput = {
  name: string;
  company?: string;
  notes?: string;
  status?: ClientStatus;
  collectFeatures?: Partial<Record<CollectFeature, boolean>>;
};

/**
 * Absent leaves a field alone. Collection switches merge into what is stored; dashboard
 * features replace it, since the agency always saves the whole matrix.
 */
export type UpdateClientInput = Partial<CreateClientInput> & {
  dashboardFeatures?: Partial<Record<DashboardFeature, FeatureAccess>>;
};

/** Offset paging, kept for the management API's website list. */
export type Page = { limit: number; offset: number };
export type PageOf<T> = { items: T[]; hasMore: boolean };

/** Where a cursor page resumes: the last row of the previous page, newest first. */
export type CursorPosition = { createdAt: Date; id: string };
export type CursorPage = { limit: number; after?: CursorPosition };

export type ClientListFilter = { status?: ClientStatus; q?: string };
/** `unassigned` keeps only sites in no client; it wins over `clientId`. */
export type WebsiteListFilter = { clientId?: string; unassigned?: boolean; q?: string };

/** Persistence for clients and the client side of `websites.client_id`. */
export interface ClientRepository {
  create(ownerId: string, input: CreateClientInput): Promise<Client>;
  findById(clientId: string): Promise<Client | null>;
  /** Newest first; `page.limit` rows at most (callers ask for one extra to learn `hasMore`). */
  list(ownerId: string, filter: ClientListFilter, page: CursorPage): Promise<Client[]>;
  update(clientId: string, input: UpdateClientInput): Promise<Client | null>;
  /** Sites are not deleted: their `client_id` is cleared in the same transaction. */
  delete(clientId: string): Promise<boolean>;

  /** One owner's websites, oldest first, optionally only one client's. */
  listWebsites(ownerId: string, filter: { clientId?: string } & Page): Promise<Website[]>;
  /** One owner's websites, newest first, by cursor. */
  pageWebsites(ownerId: string, filter: WebsiteListFilter, page: CursorPage): Promise<Website[]>;
  /** Every website the owner has, oldest first — the overview's scope. */
  allWebsites(ownerId: string): Promise<Website[]>;
  /** Websites per client, for a page of clients at once. */
  websitesOfClients(clientIds: string[]): Promise<Website[]>;
  /** Record that the site's tracker has been seen. `false` when it was already marked. */
  markVerified(websiteId: string): Promise<boolean>;
}

/** Why a client operation was refused. Routes map each to a status. */
export type ClientFailure = "not_found" | "website_not_found";

export class ClientOperationError extends Error {
  constructor(readonly reason: ClientFailure) {
    super(reason);
  }
}

/**
 * Managing clients, on behalf of one owner.
 *
 * Every method takes the owner and treats a client the owner does not own exactly like one
 * that does not exist, so an id from another account learns nothing.
 */
export interface ClientDirectory {
  listClients(ownerId: string, filter: ClientListFilter, page: CursorPage): Promise<PageOf<ClientWithWebsites>>;
  getClient(ownerId: string, clientId: string): Promise<ClientWithWebsites | null>;
  createClient(ownerId: string, input: CreateClientInput): Promise<ClientWithWebsites>;
  updateClient(ownerId: string, clientId: string, input: UpdateClientInput): Promise<ClientWithWebsites | null>;
  /** The client's sites are kept, ungrouped. */
  deleteClient(ownerId: string, clientId: string): Promise<boolean>;
}

/**
 * An owner's websites, for callers acting as that owner without a dashboard session: the
 * agency workspace (behind the gateway) and the management API (behind an account key).
 *
 * The dashboard has its own routes with member roles; this surface is owner-only.
 */
export interface OwnedWebsites {
  listWebsites(ownerId: string, filter: { clientId?: string } & Page): Promise<PageOf<Website>>;
  pageWebsites(ownerId: string, filter: WebsiteListFilter, page: CursorPage): Promise<PageOf<Website>>;
  allWebsites(ownerId: string): Promise<Website[]>;
  getWebsite(ownerId: string, websiteId: string): Promise<Website | null>;
  /** A `clientId` must be the owner's. Plan limits are the gateway's, not checked here. */
  createWebsite(ownerId: string, input: CreateWebsiteInput): Promise<Website>;
  /** A `clientId` moves the site; it must be the owner's, and `null` ungroups it. */
  updateWebsite(ownerId: string, websiteId: string, input: UpdateWebsiteInput): Promise<Website | null>;
  deleteWebsite(ownerId: string, websiteId: string): Promise<boolean>;
  /** Mark the site's tracker as seen (`websites.is_verified`). */
  markVerified(ownerId: string, websiteId: string): Promise<void>;
}

/**
 * The tag that installs the tracker on a site. Here rather than in a presenter so every
 * surface that hands out an install snippet — the management API, the agency workspace —
 * prints the same one.
 */
export function trackingSnippet(scriptUrl: string, websiteId: string): string {
  return `<script defer data-website-id="${websiteId}" src="${scriptUrl}"></script>`;
}

/** Whether a site address — a bare host or a URL — is one a website can be created with. */
export function isSiteAddress(raw: string): boolean {
  try {
    normalizeHostname(raw);
    return true;
  } catch {
    return false;
  }
}
