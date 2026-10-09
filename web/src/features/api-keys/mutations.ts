import { useMutation, useQueryClient } from '@tanstack/react-query';

import { demoMutationGuard } from '@/lib/demo';
import { apiKeyKeys, createApiKey, revokeApiKey } from './api';

/** The demo site refuses writes with the usual notice, like every other demo mutation. */
class DemoRefused extends Error {}

export function useCreateApiKey(websiteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, scopes }: { name: string; scopes: string[] }) => {
      if (demoMutationGuard(websiteId)) throw new DemoRefused('Changes are not saved in demo mode.');
      return createApiKey(websiteId, name, scopes);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: apiKeyKeys.list(websiteId) }),
  });
}

export function useRevokeApiKey(websiteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (keyId: string) => {
      if (demoMutationGuard(websiteId)) throw new DemoRefused('Changes are not saved in demo mode.');
      return revokeApiKey(websiteId, keyId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: apiKeyKeys.list(websiteId) }),
  });
}
