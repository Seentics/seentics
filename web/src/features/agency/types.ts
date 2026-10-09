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

export type AccountScope = 'websites:read' | 'websites:write';

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
};

export type UpdateClientRequest = Partial<CreateClientRequest>;
