import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as agencyApi from './api';
import { DOMAIN_POLL_MS } from './constants';
import type { ClientListFilters, Domain, ListResponse, WebsiteListFilters } from './types';

/**
 * React Query over `api.ts`. Every key starts with `agency`, so a write can refresh the whole
 * workspace with one invalidation: the figures on the overview, the setup progress and the lists
 * all move together when a client or a site changes.
 */

export const agencyKeys = {
  all: ['agency'] as const,
  overview: (period: string) => ['agency', 'overview', period] as const,
  setup: ['agency', 'setup'] as const,
  clients: (filters: ClientListFilters) => ['agency', 'clients', filters] as const,
  client: (id: string) => ['agency', 'client', id] as const,
  clientWebsites: (id: string) => ['agency', 'client-websites', id] as const,
  features: (id: string) => ['agency', 'features', id] as const,
  websites: (filters: WebsiteListFilters) => ['agency', 'websites', filters] as const,
  install: (id: string) => ['agency', 'install', id] as const,
  branding: ['agency', 'branding'] as const,
  domain: ['agency', 'domain'] as const,
  embeds: (filters: object) => ['agency', 'embeds', filters] as const,
  usage: ['agency', 'usage'] as const,
  clientUsage: ['agency', 'usage', 'clients'] as const,
  websiteUsage: (clientId?: string) => ['agency', 'usage', 'websites', clientId ?? 'all'] as const,
};

/** A list as one array, with "load more" while the API says there is more. */
function useCursorList<T>(key: readonly unknown[], fetch: (cursor: string | null) => Promise<ListResponse<T>>, enabled = true) {
  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetch(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: last => (last.page?.has_more ? last.page.next_cursor : undefined),
    enabled,
  });
  const items = query.data?.pages.flatMap(p => p.data) ?? [];
  return { ...query, items };
}

export const useOverview = (period = '30d') =>
  useQuery({ queryKey: agencyKeys.overview(period), queryFn: () => agencyApi.getOverview(period) });

export const useSetup = () => useQuery({ queryKey: agencyKeys.setup, queryFn: agencyApi.getSetup });

export const useClients = (filters: ClientListFilters = {}) =>
  useCursorList(agencyKeys.clients(filters), cursor => agencyApi.listClients(filters, cursor));

export const useClient = (id: string) =>
  useQuery({ queryKey: agencyKeys.client(id), queryFn: () => agencyApi.getClient(id), enabled: !!id });

export const useClientWebsites = (id: string) =>
  useQuery({ queryKey: agencyKeys.clientWebsites(id), queryFn: async () => (await agencyApi.listClientWebsites(id)).data, enabled: !!id });

export const useClientFeatures = (id: string) =>
  useQuery({ queryKey: agencyKeys.features(id), queryFn: () => agencyApi.getClientFeatures(id), enabled: !!id });

export const useWebsites = (filters: WebsiteListFilters = {}) =>
  useCursorList(agencyKeys.websites(filters), cursor => agencyApi.listWebsites(filters, cursor));

export const useInstall = (websiteId: string | null) =>
  useQuery({ queryKey: agencyKeys.install(websiteId ?? ''), queryFn: () => agencyApi.getInstall(websiteId!), enabled: !!websiteId });

export const useBranding = () => useQuery({ queryKey: agencyKeys.branding, queryFn: agencyApi.getBranding });

export const isDomainPending = (d: Domain | null | undefined) => d?.state === 'pending_dns' || d?.state === 'pending_certificate';

/** The custom domain, `null` when there is none; polled while DNS or the certificate is pending. */
export const useDomain = () =>
  useQuery({
    queryKey: agencyKeys.domain,
    queryFn: agencyApi.getDomain,
    retry: false,
    refetchInterval: query => (isDomainPending(query.state.data) ? DOMAIN_POLL_MS : false),
  });

export const useEmbeds = (filters: { scope?: 'website' | 'client'; target_id?: string } = {}) =>
  useQuery({ queryKey: agencyKeys.embeds(filters), queryFn: async () => (await agencyApi.listEmbeds(filters)).data });

export const useUsage = () => useQuery({ queryKey: agencyKeys.usage, queryFn: agencyApi.getUsage });

export const useClientUsage = () => useCursorList(agencyKeys.clientUsage, cursor => agencyApi.listClientUsage(cursor));

export const useWebsiteUsage = (clientId?: string) =>
  useCursorList(agencyKeys.websiteUsage(clientId), cursor => agencyApi.listWebsiteUsage(clientId, cursor));

/** Any workspace write: refreshes every agency query once it lands. */
export function useAgencyMutation<V, R>(fn: (v: V) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: agencyKeys.all }),
  });
}
