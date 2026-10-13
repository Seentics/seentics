/** Query keys, options and read hooks for the integrations feature. */
import { queryOptions, useQuery } from '@tanstack/react-query';
import { integrationsApi } from './api';

const isValidId = (id: string) => !!id;

export const integrationKeys = {
  all:        ['integrations'] as const,
  list:       (websiteId: string) => [...integrationKeys.all, 'list', websiteId] as const,
  deliveries: (websiteId: string) => [...integrationKeys.all, 'deliveries', websiteId] as const,
};

export const integrationsQueryOptions = (websiteId: string) =>
  queryOptions({
    queryKey: integrationKeys.list(websiteId),
    queryFn: () => integrationsApi.list(websiteId),
    enabled: isValidId(websiteId),
    staleTime: 30_000,
  });

export function useIntegrations(websiteId: string) {
  return useQuery(integrationsQueryOptions(websiteId));
}

/** The delivery log refreshes while the page is open: a test send should appear in it. */
export function useIntegrationDeliveries(websiteId: string) {
  return useQuery({
    queryKey: integrationKeys.deliveries(websiteId),
    queryFn: () => integrationsApi.deliveries(websiteId),
    enabled: isValidId(websiteId),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}
