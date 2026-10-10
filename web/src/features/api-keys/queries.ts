import { useQuery } from '@tanstack/react-query';

import { apiKeyKeys, fetchApiCatalogue } from './api';

export function useApiCatalogue() {
  return useQuery({
    queryKey: apiKeyKeys.catalogue,
    queryFn: fetchApiCatalogue,
    staleTime: Infinity,
  });
}
