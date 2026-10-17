import api from '@/lib/api';
import type {
  AgencyErrorBody,
  AgencyWebsite,
  Branding,
  BrandingInput,
  Client,
  ClientFeatures,
  ClientDetail,
  ClientInput,
  ClientListFilters,
  CreatedWebsite,
  Domain,
  Embed,
  EmbedInput,
  EmbedSection,
  ListResponse,
  Overview,
  Setup,
  SetupStep,
  Usage,
  UsageRow,
  Verification,
  WebsiteInput,
  WebsiteInstall,
  WebsiteListFilters,
  WebsitePatch,
} from './types';

/**
 * The agency workspace's whole API: every call goes through `call(method, path)` with the path
 * written exactly as `agency-api-spec.ts` documents it (`/agency/clients/:id`), so the parity test
 * can read this file and fail when the dashboard uses an endpoint the reference does not show.
 */

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface CallOptions {
  params?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
}

/** `/agency/clients/:id` with `{ id: 'c1' }` → `/agency/clients/c1`. */
export function fillPath(path: string, params: Record<string, string> = {}): string {
  return path.replace(/:([a-zA-Z_]+)/g, (_, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`Missing path parameter "${name}" for ${path}`);
    return encodeURIComponent(value);
  });
}

function cleanQuery(query: CallOptions['query']): Record<string, string | number | boolean> | undefined {
  if (!query) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') out[k] = v;
  return out;
}

const newKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/** The raw response body. Every POST carries a fresh Idempotency-Key, as the API asks. */
async function call<T>(method: Method, path: string, opts: CallOptions = {}): Promise<T> {
  const response = await api.request<T>({
    method,
    url: fillPath(path, opts.params),
    params: cleanQuery(opts.query),
    data: opts.body,
    headers: method === 'POST' ? { 'Idempotency-Key': newKey() } : undefined,
  });
  return response.data;
}

const one = async <T>(p: Promise<{ data: T }>): Promise<T> => (await p).data;

// ─── Errors ───────────────────────────────────────────────────────────────────

export interface AgencyError {
  status: number | null;
  code: string;
  message: string;
  details?: unknown;
}

/** Any failure from these calls, as `{status, code, message}` read from the API's error envelope. */
export function agencyError(e: unknown): AgencyError {
  const response = (e as { response?: { status?: number; data?: Partial<AgencyErrorBody> & { message?: string } } })?.response;
  const body = response?.data?.error;
  const status = response?.status ?? null;
  if (body && typeof body === 'object') {
    return { status, code: body.code, message: body.message || 'Something went wrong', details: body.details };
  }
  return { status, code: status === 503 ? 'unavailable' : 'unknown', message: (e as Error)?.message || 'Something went wrong' };
}

/** A sentence to show for a failure, with the codes the workspace can explain better than the server. */
export function errorMessage(e: unknown): string {
  const err = agencyError(e);
  switch (err.code) {
    case 'agency_plan_required': return 'This needs the Agency plan.';
    case 'rate_limited': return 'Too many requests. Please wait a moment and try again.';
    case 'idempotency_conflict': return 'That request was already sent with different details. Please try again.';
    case 'provider_error': return 'Our provider could not complete that just now. Please try again in a few minutes.';
    default: return err.message;
  }
}

/** The custom-domain failures in words, including the 503 the gateway sends when domains are switched off. */
export function domainErrorMessage(e: unknown): string {
  const err = agencyError(e);
  if (err.status === 503) return 'Custom domains are unavailable right now. Please try again later.';
  if (err.code === 'conflict') return 'That hostname is already in use by another account.';
  if (err.code === 'validation_failed') return err.message || 'That is not a hostname you can use. Try one like reports.youragency.com.';
  if (err.code === 'provider_error' || err.status === 502) return 'Our certificate provider could not take the domain just now. Please try again in a few minutes.';
  if (err.code === 'rate_limited' || err.status === 429) return 'Too many domain changes in the last hour. Please wait a while and try again.';
  if (err.code === 'not_found') return 'There is no custom domain to check. Add one first.';
  return err.message;
}

// ─── Overview & setup ─────────────────────────────────────────────────────────

export const getOverview = (period = '30d') =>
  one(call<{ data: Overview }>('GET', '/agency/overview', { query: { period } }));

export const dismissAlert = (id: string) =>
  call<unknown>('POST', '/agency/alerts/:id/dismiss', { params: { id } }).then(() => undefined);

/** The steps (the server's `{ steps }`), with the count done. */
export const getSetup = async (): Promise<Setup> => {
  const { steps } = await one(call<{ data: { steps: SetupStep[] } }>('GET', '/agency/setup'));
  return { steps, completed: steps.filter(s => s.done).length, total: steps.length };
};

// ─── Clients ──────────────────────────────────────────────────────────────────

export const listClients = (filters: ClientListFilters = {}, cursor?: string | null) =>
  call<ListResponse<Client>>('GET', '/agency/clients', { query: { status: filters.status, q: filters.q, cursor, limit: 50 } });

export const getClient = (id: string) => one(call<{ data: ClientDetail }>('GET', '/agency/clients/:id', { params: { id } }));

export const createClient = (body: ClientInput & { name: string }) =>
  one(call<{ data: Client }>('POST', '/agency/clients', { body }));

export const updateClient = (id: string, body: ClientInput) =>
  one(call<{ data: Client }>('PATCH', '/agency/clients/:id', { params: { id }, body }));

export const archiveClient = (id: string) =>
  one(call<{ data: Client }>('POST', '/agency/clients/:id/archive', { params: { id } }));

export const unarchiveClient = (id: string) =>
  one(call<{ data: Client }>('POST', '/agency/clients/:id/unarchive', { params: { id } }));

/** Deletes the client; its websites stay, no longer assigned. */
export const deleteClient = (id: string) =>
  call<unknown>('DELETE', '/agency/clients/:id', { params: { id }, query: { confirm: true } }).then(() => undefined);

export const listClientWebsites = (id: string) =>
  call<ListResponse<AgencyWebsite>>('GET', '/agency/clients/:id/websites', { params: { id }, query: { limit: 100 } });

/** Answers `{ website, install }`; read here as the site with its install. */
export const addClientWebsite = async (id: string, body: Omit<WebsiteInput, 'client_id'>): Promise<CreatedWebsite> => {
  const { website, install } = await one(call<{ data: { website: AgencyWebsite; install: WebsiteInstall } }>(
    'POST', '/agency/clients/:id/websites', { params: { id }, body },
  ));
  return { ...website, install };
};

export const getClientFeatures = (id: string) =>
  one(call<{ data: { features: ClientFeatures } }>('GET', '/agency/clients/:id/features', { params: { id } })).then(d => d.features);

export const setClientFeatures = (id: string, features: ClientFeatures) =>
  one(call<{ data: { features: ClientFeatures } }>('PUT', '/agency/clients/:id/features', { params: { id }, body: { features } }))
    .then(d => d.features);

// ─── Websites ─────────────────────────────────────────────────────────────────

export const listWebsites = (filters: WebsiteListFilters = {}, cursor?: string | null) =>
  call<ListResponse<AgencyWebsite>>('GET', '/agency/websites', {
    query: { client_id: filters.client_id, unassigned: filters.unassigned ? true : undefined, q: filters.q, cursor, limit: 50 },
  });

export const getWebsite = (id: string) => one(call<{ data: AgencyWebsite }>('GET', '/agency/websites/:id', { params: { id } }));

/** The site alone: its install is read with `getInstall`. */
export const createWebsite = (body: WebsiteInput): Promise<CreatedWebsite> => one(call<{ data: AgencyWebsite }>('POST', '/agency/websites', { body }));

/** Renames a site or moves it: `client_id: null` takes it out of any client. */
export const updateWebsite = (id: string, body: WebsitePatch) =>
  one(call<{ data: AgencyWebsite }>('PATCH', '/agency/websites/:id', { params: { id }, body }));

export const deleteWebsite = (id: string) =>
  call<unknown>('DELETE', '/agency/websites/:id', { params: { id } }).then(() => undefined);

export const getInstall = (id: string) =>
  one(call<{ data: WebsiteInstall }>('GET', '/agency/websites/:id/install', { params: { id } }));

export const verifyWebsite = (id: string) =>
  one(call<{ data: Verification }>('POST', '/agency/websites/:id/verify', { params: { id } }));

// ─── Branding & domain ────────────────────────────────────────────────────────

export const getBranding = () => one(call<{ data: Branding }>('GET', '/agency/branding'));

export const updateBranding = (body: BrandingInput) => one(call<{ data: Branding }>('PUT', '/agency/branding', { body }));

/** `null` when the agency has no custom domain. */
export const getDomain = () => one(call<{ data: Domain | null }>('GET', '/agency/domain'));

export const setDomain = (hostname: string) => one(call<{ data: Domain }>('PUT', '/agency/domain', { body: { hostname } }));

export const refreshDomain = () => one(call<{ data: Domain }>('POST', '/agency/domain/refresh'));

export const removeDomain = () => call<unknown>('DELETE', '/agency/domain').then(() => undefined);

// ─── Embeds ───────────────────────────────────────────────────────────────────

export const listEmbeds = (filters: { scope?: Embed['scope']; target_id?: string } = {}) =>
  call<ListResponse<Embed>>('GET', '/agency/embeds', { query: { ...filters, limit: 100 } });

export const createEmbed = (body: EmbedInput) => one(call<{ data: Embed }>('POST', '/agency/embeds', { body }));

export const updateEmbed = (id: string, sections: EmbedSection[]) =>
  one(call<{ data: Embed }>('PATCH', '/agency/embeds/:id', { params: { id }, body: { sections } }));

export const deleteEmbed = (id: string) => call<unknown>('DELETE', '/agency/embeds/:id', { params: { id } }).then(() => undefined);

// ─── Usage ────────────────────────────────────────────────────────────────────

export const getUsage = () => one(call<{ data: Usage }>('GET', '/agency/usage'));

export const listClientUsage = (cursor?: string | null) =>
  call<ListResponse<UsageRow>>('GET', '/agency/usage/clients', { query: { cursor, limit: 50 } });

export const listWebsiteUsage = (clientId?: string, cursor?: string | null) =>
  call<ListResponse<UsageRow>>('GET', '/agency/usage/websites', { query: { client_id: clientId, cursor, limit: 50 } });
