import api from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

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

export type CreateClientRequest = Omit<AgencyClient, 'id' | 'agencyId' | 'createdAt' | 'updatedAt'>;
export type UpdateClientRequest = Partial<CreateClientRequest>;

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapClient(raw: any): AgencyClient {
  return {
    id: raw.id,
    agencyId: raw.agency_id || raw.agencyId || '',
    name: raw.name || '',
    company: raw.company || '',
    email: raw.email || '',
    websiteUrl: raw.website_url || raw.websiteUrl || '',
    status: raw.status || 'active',
    note: raw.note || '',
    featuresEnabled: {
      analytics: raw.features_enabled?.analytics ?? raw.featuresEnabled?.analytics ?? true,
      heatmaps: raw.features_enabled?.heatmaps ?? raw.featuresEnabled?.heatmaps ?? true,
      replays: raw.features_enabled?.replays ?? raw.featuresEnabled?.replays ?? true,
      funnels: raw.features_enabled?.funnels ?? raw.featuresEnabled?.funnels ?? true,
      automations: raw.features_enabled?.automations ?? raw.featuresEnabled?.automations ?? true,
    },
    limits: {
      maxMonthlyEvents: raw.limits?.maxMonthlyEvents ?? null,
      maxReplays: raw.limits?.maxReplays ?? null,
      maxHeatmaps: raw.limits?.maxHeatmaps ?? null,
      maxWebsites: raw.limits?.maxWebsites ?? null,
    },
    createdAt: raw.created_at || raw.createdAt || '',
    updatedAt: raw.updated_at || raw.updatedAt || '',
  };
}

function mapAPIKey(raw: any): AgencyAPIKey {
  return {
    id: raw.id,
    agencyId: raw.agency_id || raw.agencyId || '',
    name: raw.name || '',
    keyPrefix: raw.key_prefix || raw.keyPrefix || '',
    key: raw.key || undefined,
    lastUsed: raw.last_used || raw.lastUsed || null,
    createdAt: raw.created_at || raw.createdAt || '',
  };
}

function mapWhiteLabel(raw: any): WhiteLabelSettings {
  return {
    userId: raw.user_id || raw.userId || '',
    brandName: raw.brand_name || raw.brandName || '',
    logoUrl: raw.logo_url || raw.logoUrl || '',
    primaryColor: raw.primary_color || raw.primaryColor || '#6366f1',
    supportEmail: raw.support_email || raw.supportEmail || '',
    customDomain: raw.custom_domain || raw.customDomain || '',
    hideSeentics: raw.hide_seentics ?? raw.hideSeentics ?? false,
  };
}

function mapClientWebsite(raw: any): ClientWebsite {
  return {
    id: raw.id,
    clientId: raw.client_id || raw.clientId || '',
    websiteId: raw.website_id || raw.websiteId || '',
    createdAt: raw.created_at || raw.createdAt || '',
  };
}

function mapPortalToken(raw: any): PortalToken {
  return {
    id: raw.id,
    clientId: raw.client_id || raw.clientId || '',
    token: raw.token || undefined,
    expiresAt: raw.expires_at || raw.expiresAt || '',
    createdAt: raw.created_at || raw.createdAt || '',
  };
}

// ─── Client API ───────────────────────────────────────────────────────────────

export async function listClients(): Promise<AgencyClient[]> {
  const response = await api.get('/user/agency/clients');
  const data = response.data?.clients || response.data?.data || response.data || [];
  return Array.isArray(data) ? data.map(mapClient) : [];
}

export async function getClient(clientId: string): Promise<AgencyClient> {
  const response = await api.get(`/user/agency/clients/${clientId}`);
  const raw = response.data?.client || response.data?.data || response.data;
  return mapClient(raw);
}

export async function createClient(req: CreateClientRequest): Promise<AgencyClient> {
  const payload = {
    name: req.name,
    company: req.company,
    email: req.email,
    website_url: req.websiteUrl,
    status: req.status,
    note: req.note,
    features_enabled: req.featuresEnabled,
    limits: req.limits,
  };
  const response = await api.post('/user/agency/clients', payload);
  const raw = response.data?.client || response.data?.data || response.data;
  return mapClient(raw);
}

export async function updateClient(id: string, req: UpdateClientRequest): Promise<AgencyClient> {
  const payload: Record<string, unknown> = {};
  if (req.name !== undefined) payload.name = req.name;
  if (req.company !== undefined) payload.company = req.company;
  if (req.email !== undefined) payload.email = req.email;
  if (req.websiteUrl !== undefined) payload.website_url = req.websiteUrl;
  if (req.status !== undefined) payload.status = req.status;
  if (req.note !== undefined) payload.note = req.note;
  if (req.featuresEnabled !== undefined) payload.featuresEnabled = req.featuresEnabled;
  if (req.limits !== undefined) payload.limits = req.limits;
  const response = await api.patch(`/user/agency/clients/${id}`, payload);
  const raw = response.data?.client || response.data?.data || response.data;
  return mapClient(raw);
}

export async function deleteClient(id: string): Promise<void> {
  await api.delete(`/user/agency/clients/${id}`);
}

// ─── Client Websites ──────────────────────────────────────────────────────────

export async function listClientWebsites(clientId: string): Promise<ClientWebsite[]> {
  const response = await api.get(`/user/agency/clients/${clientId}/websites`);
  const data = response.data?.data || response.data || [];
  return Array.isArray(data) ? data.map(mapClientWebsite) : [];
}

export async function assignWebsite(clientId: string, websiteId: string): Promise<ClientWebsite> {
  const response = await api.post(`/user/agency/clients/${clientId}/websites`, { websiteId });
  const raw = response.data?.data || response.data;
  return mapClientWebsite(raw);
}

export async function unassignWebsite(clientId: string, websiteId: string): Promise<void> {
  await api.delete(`/user/agency/clients/${clientId}/websites/${websiteId}`);
}

export async function getClientAnalytics(clientId: string): Promise<{ client: AgencyClient; websiteIds: string[] }> {
  const response = await api.get(`/user/agency/clients/${clientId}/analytics`);
  const data = response.data?.data || response.data;
  return {
    client: mapClient(data.client),
    websiteIds: data.websiteIds || [],
  };
}

// ─── Portal Tokens ────────────────────────────────────────────────────────────

export async function generatePortalToken(clientId: string): Promise<PortalToken> {
  const response = await api.post(`/user/agency/clients/${clientId}/portal-token`);
  const raw = response.data?.data || response.data;
  return mapPortalToken(raw);
}

// ─── Agency API Keys ──────────────────────────────────────────────────────────

export async function listAgencyAPIKeys(): Promise<AgencyAPIKey[]> {
  const response = await api.get('/user/agency/api-keys');
  const data = response.data?.keys || response.data?.data || response.data || [];
  return Array.isArray(data) ? data.map(mapAPIKey) : [];
}

export async function createAgencyAPIKey(name: string): Promise<AgencyAPIKey> {
  const response = await api.post('/user/agency/api-keys', { name });
  const raw = response.data?.key || response.data?.data || response.data;
  return mapAPIKey(raw);
}

export async function deleteAgencyAPIKey(id: string): Promise<void> {
  await api.delete(`/user/agency/api-keys/${id}`);
}

// ─── White Label ──────────────────────────────────────────────────────────────

export async function getWhiteLabel(): Promise<WhiteLabelSettings> {
  const response = await api.get('/user/agency/white-label');
  const raw = response.data?.settings || response.data?.data || response.data;
  return mapWhiteLabel(raw);
}

export async function updateWhiteLabel(req: Partial<WhiteLabelSettings>): Promise<WhiteLabelSettings> {
  const payload: Record<string, unknown> = {};
  if (req.brandName !== undefined) payload.brand_name = req.brandName;
  if (req.logoUrl !== undefined) payload.logo_url = req.logoUrl;
  if (req.primaryColor !== undefined) payload.primary_color = req.primaryColor;
  if (req.supportEmail !== undefined) payload.support_email = req.supportEmail;
  if (req.customDomain !== undefined) payload.custom_domain = req.customDomain;
  if (req.hideSeentics !== undefined) payload.hide_seentics = req.hideSeentics;
  const response = await api.patch('/user/agency/white-label', payload);
  const raw = response.data?.settings || response.data?.data || response.data;
  return mapWhiteLabel(raw);
}

// ─── Client Users ─────────────────────────────────────────────────────────────

function mapClientUser(raw: any): ClientUser {
  return {
    id: raw.id,
    userId: raw.user_id || raw.userId || '',
    name: raw.name || '',
    email: raw.email || '',
    company: raw.company || undefined,
    status: raw.status || 'active',
    featuresEnabled: {
      analytics: raw.features_enabled?.analytics ?? raw.featuresEnabled?.analytics ?? true,
      heatmaps: raw.features_enabled?.heatmaps ?? raw.featuresEnabled?.heatmaps ?? true,
      replays: raw.features_enabled?.replays ?? raw.featuresEnabled?.replays ?? true,
      funnels: raw.features_enabled?.funnels ?? raw.featuresEnabled?.funnels ?? true,
      automations: raw.features_enabled?.automations ?? raw.featuresEnabled?.automations ?? true,
    },
    limits: raw.limits || undefined,
    createdAt: raw.created_at || raw.createdAt || '',
  };
}

export async function listClientUsers(): Promise<ClientUser[]> {
  const response = await api.get('/user/agency/client-users');
  const data = response.data?.data || response.data || [];
  return Array.isArray(data) ? data.map(mapClientUser) : [];
}

export async function createClientUser(req: CreateClientUserRequest): Promise<CreateClientUserResponse> {
  const response = await api.post('/user/agency/client-users', req);
  const raw = response.data?.data || response.data;
  return {
    client: mapClientUser(raw.client),
    user: raw.user,
    tempPassword: raw.tempPassword || raw.temp_password || undefined,
  };
}

export async function getClientUser(userId: string): Promise<ClientUser> {
  const response = await api.get(`/user/agency/client-users/${userId}`);
  const raw = response.data?.data || response.data;
  return mapClientUser(raw);
}

export async function deleteClientUser(userId: string): Promise<void> {
  await api.delete(`/user/agency/client-users/${userId}`);
}

export async function resetClientUserPassword(userId: string): Promise<{ tempPassword: string }> {
  const response = await api.post(`/user/agency/client-users/${userId}/reset-password`);
  const raw = response.data?.data || response.data;
  return { tempPassword: raw.tempPassword || raw.temp_password || '' };
}
