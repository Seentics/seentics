import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiKeyKeys, createApiKey, revokeApiKey } from './api';

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
