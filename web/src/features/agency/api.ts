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
  CustomDomain,
  EmbedLink,
  EmbedSection,
  IssuedClientUserLink,
  PortalLink,
  UpdateClientRequest,
  WhiteLabelPatch,
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

// ─── Client access (Agency plan) ──────────────────────────────────────────────
// Core's agency module (modules/agency): white label, client users with magic links, and each
// client's anonymous portal link. The custom domain is the gateway's. All of it takes the Agency
// plan; without it every call answers 403 AGENCY_PLAN_REQUIRED.

type WireClientUser = {
  id: string;
  client_id: string;
  email: string;
  name: string;
  status: ClientUser['status'];
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
  link_expires_at: string | null;
};

type WirePortalLink = {
  id: string;
  client_id: string;
  token: string;
  portal_url: string;
  expires_at: string;
  created_at: string;
};

type WireIssued = { client_user: WireClientUser; link: WirePortalLink };

type WireWhiteLabel = {
  brand_name: string;
  logo_url: string;
  primary_color: string;
  support_email: string;
  footer_text: string;
  hide_seentics: boolean;
  updated_at: string | null;
};

type WireCustomDomain = {
  hostname: string;
  state: CustomDomain['state'];
  reason: string | null;
  cname_target: string;
  ownership_verification: CustomDomain['ownershipVerification'];
  created_at: string;
  updated_at: string;
  last_checked_at: string | null;
};

function mapClientUser(u: WireClientUser): ClientUser {
  return {
    id: u.id, clientId: u.client_id, email: u.email, name: u.name, status: u.status,
    createdAt: u.created_at, updatedAt: u.updated_at, lastSeenAt: u.last_seen_at, linkExpiresAt: u.link_expires_at,
  };
}

function mapPortalLink(l: WirePortalLink): PortalLink {
  return { id: l.id, clientId: l.client_id, token: l.token, portalUrl: l.portal_url, expiresAt: l.expires_at, createdAt: l.created_at };
}

const mapIssued = (r: WireIssued): IssuedClientUserLink => ({ clientUser: mapClientUser(r.client_user), link: mapPortalLink(r.link) });

function mapWhiteLabel(w: WireWhiteLabel): WhiteLabelSettings {
  return {
    brandName: w.brand_name, logoUrl: w.logo_url, primaryColor: w.primary_color, supportEmail: w.support_email,
    footerText: w.footer_text, hideSeentics: w.hide_seentics, updatedAt: w.updated_at,
  };
}

function mapCustomDomain(d: WireCustomDomain): CustomDomain {
  return {
    hostname: d.hostname, state: d.state, reason: d.reason, cnameTarget: d.cname_target,
    ownershipVerification: d.ownership_verification, createdAt: d.created_at, updatedAt: d.updated_at,
    lastCheckedAt: d.last_checked_at,
  };
}

/** Newest first; `clientId` narrows to one client's. */
export async function listClientUsers(clientId?: string): Promise<ClientUser[]> {
  const response = await api.get<{ data: WireClientUser[] }>('/user/agency/client-users', {
    params: clientId ? { client_id: clientId } : {},
  });
  return response.data.data.map(mapClientUser);
}

/** Invites the person and returns their first magic link: the only time it can be shown. */
export async function createClientUser(req: CreateClientUserRequest): Promise<IssuedClientUserLink> {
  const body = { client_id: req.clientId, email: req.email, ...(req.name ? { name: req.name } : {}) };
  const response = await api.post<{ data: WireIssued }>('/user/agency/client-users', body);
  return mapIssued(response.data.data);
}

/** A fresh magic link; every earlier one stops working. Refused (409) for a revoked user. */
export async function resendClientUserLink(id: string): Promise<IssuedClientUserLink> {
  const response = await api.post<{ data: WireIssued }>(`/user/agency/client-users/${id}/resend`);
  return mapIssued(response.data.data);
}

/** Stops every link the user has, at once. */
export async function revokeClientUser(id: string): Promise<ClientUser> {
  const response = await api.post<{ data: WireClientUser }>(`/user/agency/client-users/${id}/revoke`);
  return mapClientUser(response.data.data);
}

export async function deleteClientUser(id: string): Promise<void> {
  await api.delete(`/user/agency/client-users/${id}`);
}

/** The client's anonymous 7-day link. Making one stops any earlier one. */
export async function createPortalLink(clientId: string): Promise<PortalLink> {
  const response = await api.post<{ data: WirePortalLink }>(`/user/agency/clients/${clientId}/portal-token`);
  return mapPortalLink(response.data.data);
}

export async function revokePortalLink(clientId: string): Promise<void> {
  await api.delete(`/user/agency/clients/${clientId}/portal-token`);
}

export async function getWhiteLabel(): Promise<WhiteLabelSettings> {
  const response = await api.get<{ data: WireWhiteLabel }>('/user/agency/white-label');
  return mapWhiteLabel(response.data.data);
}

/** Partial: absent fields keep their value, `''` clears a text field. */
export async function updateWhiteLabel(req: WhiteLabelPatch): Promise<WhiteLabelSettings> {
  const body: Record<string, unknown> = {};
  if (req.brandName !== undefined) body.brand_name = req.brandName;
  if (req.logoUrl !== undefined) body.logo_url = req.logoUrl;
  if (req.primaryColor !== undefined) body.primary_color = req.primaryColor;
  if (req.supportEmail !== undefined) body.support_email = req.supportEmail;
  if (req.footerText !== undefined) body.footer_text = req.footerText;
  if (req.hideSeentics !== undefined) body.hide_seentics = req.hideSeentics;
  const response = await api.patch<{ data: WireWhiteLabel }>('/user/agency/white-label', body);
  return mapWhiteLabel(response.data.data);
}

export async function getCustomDomain(): Promise<CustomDomain | null> {
  const response = await api.get<{ data: WireCustomDomain | null }>('/user/agency/custom-domain');
  return response.data.data ? mapCustomDomain(response.data.data) : null;
}

/** Claims `hostname` for the portal, replacing any earlier one. */
export async function setCustomDomain(hostname: string): Promise<CustomDomain> {
  const response = await api.put<{ data: WireCustomDomain }>('/user/agency/custom-domain', { hostname });
  return mapCustomDomain(response.data.data);
}

/** Asks Cloudflare again now, rather than waiting for the gateway's own next check. */
export async function refreshCustomDomain(): Promise<CustomDomain> {
  const response = await api.post<{ data: WireCustomDomain }>('/user/agency/custom-domain/refresh');
  return mapCustomDomain(response.data.data);
}

export async function removeCustomDomain(): Promise<void> {
  await api.delete('/user/agency/custom-domain');
}

/**
 * The link to hand a client: on the agency's own domain once it serves, else on Seentics' host as
 * Core built it. A pending domain would be a dead link, so it is never used early.
 */
export function portalLinkUrl(link: Pick<PortalLink, 'token' | 'portalUrl'>, domain: CustomDomain | null | undefined): string {
  return domain?.state === 'active' ? `https://${domain.hostname}/client-portal/${link.token}` : link.portalUrl;
}

/** Why the custom domain could not be saved, in words, from the gateway's error codes. */
export function customDomainError(e: unknown): string {
  const response = (e as { response?: { status?: number; data?: { error?: string; message?: string } } })?.response;
  const code = response?.data?.error;
  if (code === 'invalid_hostname') return response?.data?.message || 'That is not a hostname you can use. Try one like reports.youragency.com.';
  if (code === 'hostname_taken') return 'That hostname is already in use by another account.';
  if (code === 'custom_domains_unavailable' || response?.status === 503) return 'Custom domains are unavailable right now. Please try again later.';
  if (code === 'custom_domain_provider_error' || response?.status === 502) return 'Our certificate provider could not take the domain just now. Please try again in a few minutes.';
  if (response?.status === 429) return 'Too many domain changes in the last hour. Please wait a while and try again.';
  if (response?.status === 404) return 'There is no custom domain to check. Add one first.';
  return response?.data?.message || (e as Error)?.message || 'Something went wrong';
}
