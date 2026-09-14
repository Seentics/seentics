import { useQuery } from '@tanstack/react-query';

import { apiKeyKeys, fetchApiCatalogue, fetchApiKeys, fetchApiScopes } from './api';

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
