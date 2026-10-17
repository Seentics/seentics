/** Domain types for the agency feature. */

export type ClientUserStatus = 'invited' | 'active' | 'revoked';

/**
 * A client's contact, invited to that one client's read-only portal. Not a Seentics login: there
 * is no password, only magic links. `invited` until the first link is opened, then `active`;
 * `revoked` stops every link at once.
 */
export interface ClientUser {
  id: string;
  clientId: string;
  email: string;
  name: string;
  status: ClientUserStatus;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string | null;
  /** When the user's newest live link expires; `null` when there is none. */
  linkExpiresAt: string | null;
}

export interface CreateClientUserRequest {
  clientId: string;
  email: string;
  name?: string;
}

/**
 * A portal link just made. `token` (and the URL built on it) is in the response that made it and
 * nowhere else: only its hash is stored, so the link is shown once.
 */
export interface PortalLink {
  id: string;
  clientId: string;
  token: string;
  /** On Seentics' own host; `portalLinkUrl` swaps in the agency's domain once it is active. */
  portalUrl: string;
  expiresAt: string;
  createdAt: string;
}

/** Inviting a client user, or resending their link: the user, and their fresh link. */
export interface IssuedClientUserLink {
  clientUser: ClientUser;
  link: PortalLink;
}

/** Switched off per client, on top of each site's own settings. */
export interface AgencyClientFeatures {
  analytics: boolean;
  heatmaps: boolean;
  replays: boolean;
  funnels: boolean;
  automations: boolean;
  errors: boolean;
}

/** `null` is uncapped. Usage caps count per calendar month. */
export interface ClientLimits {
  maxWebsites: number | null;
  maxMonthlyEvents: number | null;
  maxReplays: number | null;
  maxHeatmaps: number | null;
}

/** A site filed under a client, with the snippet that installs it. */
export interface ClientWebsite {
  id: string;
  clientId: string | null;
  name: string;
  url: string;
  trackingId: string;
  isActive: boolean;
  snippet: string;
  createdAt: string;
}

export interface AgencyClient {
  id: string;
  /** Your own id for this tenant — what the management API looks clients up by. */
  externalId: string | null;
  name: string;
  company: string;
  email: string;
  websiteUrl: string;
  status: 'active' | 'suspended' | 'archived';
  note: string;
  featuresEnabled: AgencyClientFeatures;
  limits: ClientLimits;
  metadata: Record<string, unknown>;
  websites: ClientWebsite[];
  createdAt: string;
  updatedAt: string;
}

/** What an account key may do: manage clients and websites, and read their data. */
export type AccountScope = 'websites:read' | 'websites:write' | 'analytics:read' | 'replays:read' | 'heatmaps:read';

/** A management-API key. `key` is present only in the response that created it. */
export interface AgencyAPIKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: AccountScope[];
  key?: string;
  lastUsed: string | null;
  createdAt: string;
}

/** The brand an agency's clients see on the portal. Text fields are `''` when unset. */
export interface WhiteLabelSettings {
  brandName: string;
  /** `''` or an https URL. */
  logoUrl: string;
  /** `#rrggbb`. */
  primaryColor: string;
  supportEmail: string;
  footerText: string;
  hideSeentics: boolean;
  /** `null` while the agency has never saved (the defaults are showing). */
  updatedAt: string | null;
}

export type WhiteLabelPatch = Partial<Omit<WhiteLabelSettings, 'updatedAt'>>;

export type CustomDomainState = 'pending_dns' | 'pending_certificate' | 'active' | 'failed';

/**
 * The agency's own hostname for the client portal (reports.youragency.com), served by the gateway:
 * the agency adds a CNAME to `cnameTarget` (and the TXT record, when Cloudflare asks for one), then
 * the certificate is issued and the state turns `active`.
 */
export interface CustomDomain {
  hostname: string;
  state: CustomDomainState;
  /** Why it is stuck or failed, in words; `null` when there is nothing to say. */
  reason: string | null;
  cnameTarget: string;
  ownershipVerification: { name: string; type: string; value: string } | null;
  createdAt: string;
  updatedAt: string;
  lastCheckedAt: string | null;
}

/** What opening a portal link shows: the client, its websites, what it may read and the agency's brand. */
export interface PortalSession {
  client: { id: string; name: string; company: string; status: string; featuresEnabled: Record<string, boolean> };
  websites: { id: string; name: string; url: string }[];
  sections: EmbedSection[];
  brand: PortalBrand;
  clientUser: { name: string; email: string } | null;
  expiresAt: string;
  embedUrl: string;
}

/** The brand as a client sees it (no owner, no domain). */
export interface PortalBrand {
  brandName: string;
  logoUrl: string;
  primaryColor: string;
  supportEmail: string;
  footerText: string;
  hideSeentics: boolean;
}

export type CreateClientRequest = Pick<
  AgencyClient,
  'name' | 'company' | 'email' | 'websiteUrl' | 'status' | 'note' | 'featuresEnabled'
> & {
  externalId?: string | null;
  limits?: ClientLimits;
  /** Create the client's first website in the same call; the response carries its tracking snippet. */
  website?: { name: string; url: string };
};

export type UpdateClientRequest = Partial<Omit<CreateClientRequest, 'website'>>;

/**
 * A permanent, revocable link to a read-only analytics dashboard, for one website or for a
 * whole client (all its websites). Anyone holding the link can see that data, so it is a secret.
 */
/** What an embed link can show. Analytics is on by default; the others are opted into. */
export type EmbedSection = 'analytics' | 'recordings' | 'heatmaps';

export type EmbedLink = {
  id: string;
  scope: 'website' | 'client';
  targetId: string;
  targetName: string;
  token: string;
  /** Absolute from the server; fixtures may give a path, resolved against the page origin. */
  embedUrl: string;
  /** Which sections the link shows. Changing them changes access at once, with the same URL. */
  sections: EmbedSection[];
  createdAt: string;
};
