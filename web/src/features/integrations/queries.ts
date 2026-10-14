/** Query keys, options and read hooks for the integrations feature. */
import { queryOptions, useQuery } from '@tanstack/react-query';
import { integrationsApi } from './api';
import type { DeliveryFilters } from './types';

const isValidId = (id: string) => !!id;

export const integrationKeys = {
  all:        ['integrations'] as const,
  overview:   (websiteId: string) => [...integrationKeys.all, 'overview', websiteId] as const,
  deliveries: (websiteId: string) => [...integrationKeys.all, 'deliveries', websiteId] as const,
};

export const integrationsQueryOptions = (websiteId: string) =>
  queryOptions({
    queryKey: integrationKeys.overview(websiteId),
    queryFn: () => integrationsApi.overview(websiteId),
    enabled: isValidId(websiteId),
    staleTime: 30_000,
  });

/** The kinds of destination, and the ones this site has added. */
export function useIntegrations(websiteId: string) {
  return useQuery(integrationsQueryOptions(websiteId));
}

/**
 * The delivery log refreshes while the page is open: a test send or a retry should show up in
 * it, and a pending delivery turns into a result without a reload.
 */
export function useIntegrationDeliveries(websiteId: string, filters: DeliveryFilters = {}) {
  return useQuery({
    queryKey: [...integrationKeys.deliveries(websiteId), filters],
    queryFn: () => integrationsApi.deliveries(websiteId, filters),
    enabled: isValidId(websiteId),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}
