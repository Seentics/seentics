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

export interface AgencyClientFeatures {
  analytics: boolean;
  heatmaps: boolean;
  replays: boolean;
  funnels: boolean;
  automations: boolean;
}

export interface ClientLimits {
  maxMonthlyEvents: number | null;
  maxReplays: number | null;
  maxHeatmaps: number | null;
  maxWebsites: number | null;
}

export interface AgencyClient {
  id: string;
  agencyId: string;
  name: string;
  company: string;
  email: string;
  websiteUrl: string;
  status: 'active' | 'suspended' | 'archived';
  note: string;
  featuresEnabled: AgencyClientFeatures;
  limits: ClientLimits;
  createdAt: string;
  updatedAt: string;
}

export interface ClientWebsite {
  id: string;
  clientId: string;
  websiteId: string;
  createdAt: string;
}

export interface PortalToken {
  id: string;
  clientId: string;
  token?: string;
  expiresAt: string;
  createdAt: string;
}

export interface AgencyAPIKey {
  id: string;
  agencyId: string;
  name: string;
  keyPrefix: string;
  key?: string; // Only returned on creation
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

export type CreateClientRequest = Omit<AgencyClient, 'id' | 'agencyId' | 'createdAt' | 'updatedAt' | 'limits'> & {
  limits?: ClientLimits;
};

export type UpdateClientRequest = Partial<CreateClientRequest>;
