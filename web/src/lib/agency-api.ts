import api from './api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgencyClientFeatures {
  analytics: boolean;
  heatmaps: boolean;
  replays: boolean;
  funnels: boolean;
  automations: boolean;
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
  createdAt: string;
  updatedAt: string;
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

// ─── Client API ───────────────────────────────────────────────────────────────

export async function listClients(): Promise<AgencyClient[]> {
  const response = await api.get('/user/agency/clients');
  const data = response.data?.clients || response.data?.data || response.data || [];
  return Array.isArray(data) ? data.map(mapClient) : [];
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
  if (req.featuresEnabled !== undefined) payload.features_enabled = req.featuresEnabled;
  const response = await api.patch(`/user/agency/clients/${id}`, payload);
  const raw = response.data?.client || response.data?.data || response.data;
  return mapClient(raw);
}

export async function deleteClient(id: string): Promise<void> {
  await api.delete(`/user/agency/clients/${id}`);
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
