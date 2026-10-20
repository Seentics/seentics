import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { demoMutationGuard, isDemo } from '@/lib/demo';

/**
 * Account API keys for the Developers page: the Data API and the Management API's websites
 * endpoints take them. On every plan (gateway `services/core-proxy.ts`). Core's routes:
 * `modules/api-keys/account-routes.ts`. On the demo website, reads are fixtures and writes are
 * refused with the usual demo notice (`lib/demo`).
 */
export const API_KEYS_PATH = '/user/agency/api-keys';

/** Core's `ACCOUNT_SCOPES` (modules/api-keys/interfaces/api-key.interface.ts), in its order. */
export const ACCOUNT_SCOPES = [
  'websites:read',
  'websites:write',
  'analytics:read',
  'replays:read',
  'heatmaps:read',
  'agency:read',
  'agency:write',
] as const;

export type AccountScope = (typeof ACCOUNT_SCOPES)[number];

/** `key` is present only in the response that created it. */
export interface AccountAPIKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: AccountScope[];
  key?: string;
  lastUsed: string | null;
  createdAt: string;
}

type WireAPIKey = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: AccountScope[];
  key?: string;
  last_used: string | null;
  created_at: string;
};

const fromWire = (k: WireAPIKey): AccountAPIKey => ({
  id: k.id,
  name: k.name,
  keyPrefix: k.key_prefix,
  scopes: k.scopes,
  key: k.key,
  lastUsed: k.last_used,
  createdAt: k.created_at,
});

export async function listAPIKeys(): Promise<AccountAPIKey[]> {
  const response = await api.get<{ data: WireAPIKey[] }>(API_KEYS_PATH);
  return response.data.data.map(fromWire);
}

export async function createAPIKey(name: string, scopes: AccountScope[]): Promise<AccountAPIKey> {
  const response = await api.post<{ data: WireAPIKey }>(API_KEYS_PATH, { name, scopes });
  return fromWire(response.data.data);
}

export async function deleteAPIKey(id: string): Promise<void> {
  await api.delete(`${API_KEYS_PATH}/${id}`);
}

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const DAY = 864e5;

export const demoAPIKeys = (): AccountAPIKey[] => [
  {
    id: 'demo-key-1', name: 'Reporting backend', keyPrefix: 'snt_acct_Q7vX2m',
    scopes: ['websites:read', 'websites:write', 'analytics:read', 'replays:read', 'heatmaps:read'],
    lastUsed: ago(2 * 60 * 60 * 1000), createdAt: ago(90 * DAY),
  },
  {
    id: 'demo-key-2', name: 'Weekly export', keyPrefix: 'snt_acct_b4KpR9',
    scopes: ['websites:read', 'analytics:read'],
    lastUsed: ago(3 * DAY), createdAt: ago(40 * DAY),
  },
];

const apiKeysKey = ['developer-api-keys'] as const;

export function useAPIKeys(websiteId: string) {
  return useQuery({
    queryKey: [...apiKeysKey, isDemo(websiteId)],
    queryFn: () => (isDemo(websiteId) ? demoAPIKeys() : listAPIKeys()),
    enabled: !!websiteId,
  });
}

class DemoRefused extends Error {}
export const isDemoRefusal = (e: unknown) => e instanceof DemoRefused;

function useKeyMutation<V, R>(websiteId: string, fn: (v: V) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: V) => {
      if (demoMutationGuard(websiteId)) throw new DemoRefused('demo');
      return fn(v);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: apiKeysKey }),
  });
}

export const useCreateAPIKey = (websiteId: string) =>
  useKeyMutation(websiteId, ({ name, scopes }: { name: string; scopes: AccountScope[] }) => createAPIKey(name, scopes));

export const useDeleteAPIKey = (websiteId: string) => useKeyMutation(websiteId, (id: string) => deleteAPIKey(id));
