import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  ApiCatalogue,
  ApiEndpoint,
  ApiKey,
  ApiScopeInfo,
  CreatedApiKey,
} from './types';


/**
 * API keys and the public API reference.
 *
 * The reference is fetched rather than hard-coded: the server owns the catalogue and a
 * test there compares it against the router, so a page built from it cannot document an
 * endpoint that does not exist or miss one that does.
 */







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
