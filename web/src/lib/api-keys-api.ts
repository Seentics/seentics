import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from './api';

/**
 * API keys and the public API reference.
 *
 * The reference is fetched rather than hard-coded: the server owns the catalogue and a
 * test there compares it against the router, so a page built from it cannot document an
 * endpoint that does not exist or miss one that does.
 */

export interface ApiKey {
  id: string;
  name: string;
  /** First 16 characters — enough to recognise a key in a log. */
  prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
}

/** What creation returns: the key, plus the one and only sight of its secret. */
export interface CreatedApiKey extends ApiKey {
  secret: string;
}

export interface ApiScopeInfo {
  scope: string;
  description: string;
}

export interface ApiParam {
  name: string;
  description: string;
  default?: string;
}

export interface ApiEndpoint {
  path: string;
  method: 'GET';
  group: string;
  summary: string;
  scope: string;
  params: ApiParam[];
}

export interface ApiCatalogue {
  meta: { base_path: string; auth: string; count: number };
  data: ApiEndpoint[];
}

export const apiKeyKeys = {
  all: ['api-keys'] as const,
  list: (websiteId: string) => ['api-keys', websiteId] as const,
  scopes: ['api-keys', 'scopes'] as const,
  catalogue: ['api-catalogue'] as const,
};

export async function fetchApiKeys(websiteId: string): Promise<ApiKey[]> {
  const res = await api.get(`/websites/${websiteId}/api-keys`);
  return (res.data?.data ?? []) as ApiKey[];
}

export async function fetchApiScopes(): Promise<ApiScopeInfo[]> {
  const res = await api.get('/websites/scopes');
  return (res.data?.data ?? []) as ApiScopeInfo[];
}

export async function createApiKey(
  websiteId: string,
  name: string,
  scopes: string[],
): Promise<CreatedApiKey> {
  const res = await api.post(`/websites/${websiteId}/api-keys`, { name, scopes });
  return res.data?.data as CreatedApiKey;
}

export async function revokeApiKey(websiteId: string, keyId: string): Promise<void> {
  await api.delete(`/websites/${websiteId}/api-keys/${keyId}`);
}

export async function fetchApiCatalogue(): Promise<ApiCatalogue> {
  const res = await api.get('/raw/v1/catalogue');
  return res.data as ApiCatalogue;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useApiKeys(websiteId: string) {
  return useQuery({
    queryKey: apiKeyKeys.list(websiteId),
    queryFn: () => fetchApiKeys(websiteId),
    enabled: !!websiteId,
  });
}

export function useApiScopes() {
  return useQuery({
    queryKey: apiKeyKeys.scopes,
    queryFn: fetchApiScopes,
    // The scope vocabulary changes when the product does, not while a page is open.
    staleTime: Infinity,
  });
}

export function useApiCatalogue() {
  return useQuery({
    queryKey: apiKeyKeys.catalogue,
    queryFn: fetchApiCatalogue,
    staleTime: Infinity,
  });
}

export function useCreateApiKey(websiteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, scopes }: { name: string; scopes: string[] }) =>
      createApiKey(websiteId, name, scopes),
    onSuccess: () => qc.invalidateQueries({ queryKey: apiKeyKeys.list(websiteId) }),
  });
}

export function useRevokeApiKey(websiteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) => revokeApiKey(websiteId, keyId),
    onSuccess: () => qc.invalidateQueries({ queryKey: apiKeyKeys.list(websiteId) }),
  });
}

// ─── Reference helpers ────────────────────────────────────────────────────────

/**
 * A copy-paste `curl` for one endpoint.
 *
 * The website id is substituted and the key is left as a placeholder rather than the
 * real secret — a reference someone screenshots should not carry a live credential.
 */
export function curlFor(
  endpoint: ApiEndpoint,
  basePath: string,
  origin: string,
  websiteId: string,
): string {
  const path = endpoint.path.replace(':website_id', websiteId);
  const query = endpoint.params
    .filter(p => p.default !== undefined)
    .map(p => `${p.name}=${p.default}`)
    .join('&');

  const url = `${origin}${basePath}${path}${query ? `?${query}` : ''}`;
  return `curl -H "X-API-Key: $SEENTICS_API_KEY" \\\n  "${url}"`;
}

/** Endpoints grouped for the reference, preserving the catalogue's order. */
export function groupEndpoints(endpoints: ApiEndpoint[]): Array<[string, ApiEndpoint[]]> {
  const groups = new Map<string, ApiEndpoint[]>();
  for (const e of endpoints) {
    const list = groups.get(e.group);
    if (list) list.push(e);
    else groups.set(e.group, [e]);
  }
  return [...groups.entries()];
}
