import api from '@/lib/api';
import type {
  AccountScope,
  AgencyAPIKey,
  AgencyClient,
  ClientLimits,
  ClientUser,
  ClientWebsite,
  CreateClientRequest,
  CreateClientUserRequest,
  CreateClientUserResponse,
  EmbedLink,
  EmbedSection,
  PortalToken,
  UpdateClientRequest,
  WhiteLabelSettings,
} from './types';

// ─── Wire shapes ──────────────────────────────────────────────────────────────
// What Core returns (modules/websites/lib/client-presenter.ts, api-keys/services/
// account-api-key.service.ts). Mapped once here so components read camelCase.

type WireLimits = {
  max_websites: number | null;
  max_monthly_events: number | null;
  max_replays: number | null;
  max_heatmaps: number | null;
};

type WireClientWebsite = {
  id: string;
  client_id: string | null;
  name: string;
  url: string;
  tracking_id: string;
  is_active: boolean;
  snippet: string;
  created_at: string;
};

type WireClient = {
  id: string;
  external_id: string | null;
  name: string;
  company: string;
  email: string;
  website_url: string;
  status: AgencyClient['status'];
  note: string;
  features_enabled: AgencyClient['featuresEnabled'];
  limits: WireLimits;
  metadata: Record<string, unknown>;
  websites: WireClientWebsite[];
  created_at: string;
  updated_at: string;
};

type WireAPIKey = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: AccountScope[];
  key?: string;
  last_used: string | null;
  created_at: string;
};

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapLimits(l: WireLimits): ClientLimits {
  return {
    maxWebsites: l.max_websites,
    maxMonthlyEvents: l.max_monthly_events,
    maxReplays: l.max_replays,
    maxHeatmaps: l.max_heatmaps,
  };
}

function limitsToWire(l: ClientLimits): WireLimits {
  return {
    max_websites: l.maxWebsites,
    max_monthly_events: l.maxMonthlyEvents,
    max_replays: l.maxReplays,
    max_heatmaps: l.maxHeatmaps,
  };
}

function mapClientWebsite(w: WireClientWebsite): ClientWebsite {
  return {
    id: w.id,
    clientId: w.client_id,
    name: w.name,
    url: w.url,
    trackingId: w.tracking_id,
    isActive: w.is_active,
    snippet: w.snippet,
    createdAt: w.created_at,
  };
}

function mapClient(c: WireClient): AgencyClient {
  return {
    id: c.id,
    externalId: c.external_id,
    name: c.name,
    company: c.company,
    email: c.email,
    websiteUrl: c.website_url,
    status: c.status,
    note: c.note,
    featuresEnabled: c.features_enabled,
    limits: mapLimits(c.limits),
    metadata: c.metadata,
    websites: c.websites.map(mapClientWebsite),
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  };
}

function mapAPIKey(k: WireAPIKey): AgencyAPIKey {
  return {
    id: k.id,
    name: k.name,
    keyPrefix: k.key_prefix,
    scopes: k.scopes,
    key: k.key,
    lastUsed: k.last_used,
    createdAt: k.created_at,
  };
}

/** Request body for create and update; absent fields stay absent. */
function clientToWire(req: UpdateClientRequest & { website?: CreateClientRequest['website'] }): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (req.name !== undefined) body.name = req.name;
  if (req.externalId !== undefined) body.external_id = req.externalId;
  if (req.company !== undefined) body.company = req.company;
  if (req.email !== undefined) body.email = req.email;
  if (req.websiteUrl !== undefined) body.website_url = req.websiteUrl;
  if (req.status !== undefined) body.status = req.status;
  if (req.note !== undefined) body.note = req.note;
  if (req.featuresEnabled !== undefined) body.features_enabled = req.featuresEnabled;
  if (req.limits !== undefined) body.limits = limitsToWire(req.limits);
  if (req.website !== undefined) body.website = req.website;
  return body;
}

// ─── Clients ──────────────────────────────────────────────────────────────────

export async function listClients(): Promise<AgencyClient[]> {
  const response = await api.get<{ data: WireClient[] }>('/user/agency/clients', { params: { limit: 100 } });
  return response.data.data.map(mapClient);
}

export async function getClient(clientId: string): Promise<AgencyClient> {
  const response = await api.get<{ data: WireClient }>(`/user/agency/clients/${clientId}`);
  return mapClient(response.data.data);
}

export async function createClient(req: CreateClientRequest): Promise<AgencyClient> {
  const response = await api.post<{ data: WireClient }>('/user/agency/clients', clientToWire(req));
  return mapClient(response.data.data);
}

export async function updateClient(id: string, req: UpdateClientRequest): Promise<AgencyClient> {
  const response = await api.patch<{ data: WireClient }>(`/user/agency/clients/${id}`, clientToWire(req));
  return mapClient(response.data.data);
}

/** `deleteWebsites` also deletes the client's sites and everything they collected. */
export async function deleteClient(id: string, opts: { deleteWebsites?: boolean } = {}): Promise<void> {
  await api.delete(`/user/agency/clients/${id}`, { params: opts.deleteWebsites ? { delete_websites: true } : {} });
}

/** Files a website you already have under a client, or (`clientId: null`) takes it out of any. */
async function setWebsiteClient(websiteId: string, clientId: string | null): Promise<void> {
  await api.patch(`/user/agency/websites/${websiteId}`, { client_id: clientId });
}

export const assignWebsite = (clientId: string, websiteId: string) => setWebsiteClient(websiteId, clientId);

export const unassignWebsite = (_clientId: string, websiteId: string) => setWebsiteClient(websiteId, null);

// ─── Account API keys ─────────────────────────────────────────────────────────

export async function listAgencyAPIKeys(): Promise<AgencyAPIKey[]> {
  const response = await api.get<{ data: WireAPIKey[] }>('/user/agency/api-keys');
  return response.data.data.map(mapAPIKey);
}

/** Omitting `scopes` grants every scope. */
export async function createAgencyAPIKey(name: string, scopes?: AccountScope[]): Promise<AgencyAPIKey> {
  const response = await api.post<{ data: WireAPIKey }>('/user/agency/api-keys', { name, scopes });
  return mapAPIKey(response.data.data);
}

export async function deleteAgencyAPIKey(id: string): Promise<void> {
  await api.delete(`/user/agency/api-keys/${id}`);
}

// ─── Embeds ───────────────────────────────────────────────────────────────────

type WireEmbedLink = {
  id: string;
  scope: 'website' | 'client';
  target_id: string;
  target_name: string;
  token: string;
  embed_url: string;
  sections?: EmbedSection[];
  created_at: string;
};

/**
 * The dashboard builds the link from the page it is on, keeping only the server's path and query.
 * The server's host comes from its own FRONTEND_URL setting; a wrong one there should not send
 * someone to a dead link when the embed page is served from right here.
 */
function embedPath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

function mapEmbedLink(l: WireEmbedLink): EmbedLink {
  return {
    id: l.id, scope: l.scope, targetId: l.target_id, targetName: l.target_name,
    token: l.token, embedUrl: embedPath(l.embed_url), sections: l.sections ?? ['analytics'], createdAt: l.created_at,
  };
}

export async function listEmbedLinks(): Promise<EmbedLink[]> {
  const response = await api.get<{ data: WireEmbedLink[] }>('/user/agency/embed-links');
  return response.data.data.map(mapEmbedLink);
}

/** Returns the target's existing link, or makes one — never a second. */
export async function createEmbedLink(
  target: { websiteId: string } | { clientId: string },
  sections?: EmbedSection[],
): Promise<EmbedLink> {
  const body = {
    ...('websiteId' in target ? { website_id: target.websiteId } : { client_id: target.clientId }),
    ...(sections ? { sections } : {}),
  };
  const response = await api.post<{ data: WireEmbedLink }>('/user/agency/embed-links', body);
  return mapEmbedLink(response.data.data);
}

/** Changes what a link shows. Takes effect at once, and the URL stays the same. */
export async function updateEmbedLinkSections(id: string, sections: EmbedSection[]): Promise<EmbedLink> {
  const response = await api.patch<{ data: WireEmbedLink }>(`/user/agency/embed-links/${id}`, { sections });
  return mapEmbedLink(response.data.data);
}

/** Stops the link working at once. Making another for the same target gives a new URL. */
export async function revokeEmbedLink(id: string): Promise<void> {
  await api.delete(`/user/agency/embed-links/${id}`);
}

// ─── Cloud only ───────────────────────────────────────────────────────────────
// Portal links, white-label and client logins are proprietary and served by the
// gateway, not Core; their screens show only when `isEnterprise`.

export async function generatePortalToken(clientId: string): Promise<PortalToken> {
  const response = await api.post(`/user/agency/clients/${clientId}/portal-token`);
  const raw = response.data.data;
  return { id: raw.id, clientId: raw.client_id, token: raw.token, expiresAt: raw.expires_at, createdAt: raw.created_at };
}

export async function getWhiteLabel(): Promise<WhiteLabelSettings> {
  const response = await api.get('/user/agency/white-label');
  return mapWhiteLabel(response.data.data);
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
  return mapWhiteLabel(response.data.data);
}

function mapWhiteLabel(raw: any): WhiteLabelSettings {
  return {
    userId: raw.user_id,
    brandName: raw.brand_name ?? '',
    logoUrl: raw.logo_url ?? '',
    primaryColor: raw.primary_color ?? '#6366f1',
    supportEmail: raw.support_email ?? '',
    customDomain: raw.custom_domain ?? '',
    hideSeentics: raw.hide_seentics ?? false,
  };
}

function mapClientUser(raw: any): ClientUser {
  return {
    id: raw.id,
    userId: raw.user_id,
    name: raw.name ?? '',
    email: raw.email ?? '',
    company: raw.company || undefined,
    status: raw.status ?? 'active',
    featuresEnabled: {
      analytics: raw.features_enabled?.analytics ?? true,
      heatmaps: raw.features_enabled?.heatmaps ?? true,
      replays: raw.features_enabled?.replays ?? true,
      funnels: raw.features_enabled?.funnels ?? true,
      automations: raw.features_enabled?.automations ?? true,
    },
    limits: raw.limits || undefined,
    createdAt: raw.created_at ?? '',
  };
}

export async function listClientUsers(): Promise<ClientUser[]> {
  const response = await api.get('/user/agency/client-users');
  return (response.data.data ?? []).map(mapClientUser);
}

export async function createClientUser(req: CreateClientUserRequest): Promise<CreateClientUserResponse> {
  const response = await api.post('/user/agency/client-users', req);
  const raw = response.data.data;
  return { client: mapClientUser(raw.client), user: raw.user, tempPassword: raw.temp_password };
}

export async function getClientUser(userId: string): Promise<ClientUser> {
  const response = await api.get(`/user/agency/client-users/${userId}`);
  return mapClientUser(response.data.data);
}

export async function deleteClientUser(userId: string): Promise<void> {
  await api.delete(`/user/agency/client-users/${userId}`);
}

export async function resetClientUserPassword(userId: string): Promise<{ tempPassword: string }> {
  const response = await api.post(`/user/agency/client-users/${userId}/reset-password`);
  return { tempPassword: response.data.data.temp_password };
}
