import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { demoWebsiteKeys, isDemo } from '@/lib/demo';
import type {
  ApiCatalogue,
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
  if (isDemo(websiteId)) return demoWebsiteKeys();
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






