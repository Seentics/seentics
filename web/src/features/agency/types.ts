/** Domain types for the agency feature. */

export interface ClientUser {
  id: string;
  userId: string;
  name: string;
  email: string;
  company?: string;
  status: 'active' | 'suspended';
  featuresEnabled: {
    analytics: boolean;
    heatmaps: boolean;
    replays: boolean;
    funnels: boolean;
    automations: boolean;
  };
  limits?: {
    maxMonthlyEvents?: number;
    maxReplays?: number;
    maxHeatmaps?: number;
    maxWebsites?: number;
  };
  createdAt: string;
}

export interface CreateClientUserRequest {
  name: string;
  email: string;
  password?: string;
  company?: string;
  features?: Partial<ClientUser['featuresEnabled']>;
  limits?: ClientUser['limits'];
}

export interface CreateClientUserResponse {
  client: ClientUser;
  user: { id: string; name: string; email: string; role: string; createdAt: string };
  tempPassword?: string;
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

export interface PortalToken {
  id: string;
  clientId: string;
  token?: string;
  expiresAt: string;
  createdAt: string;
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

export interface WhiteLabelSettings {
  userId: string;
  brandName: string;
  logoUrl: string;
  primaryColor: string;
  supportEmail: string;
  customDomain: string;
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
