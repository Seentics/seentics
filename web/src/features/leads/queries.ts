/** Query keys, options and read hooks for the leads feature. */
import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query';
import { leadsApi } from './api';
import type { ContactFilters } from './types';

const isValidId = (id: string) => !!id;

/** Every key descends from `all`, so a mutation can invalidate the whole feature at once. */
export const leadKeys = {
  all:      ['leads'] as const,
  lists:    () => [...leadKeys.all, 'list'] as const,
  list:     (websiteId: string, filters: ContactFilters) => [...leadKeys.lists(), websiteId, filters] as const,
  details:  () => [...leadKeys.all, 'detail'] as const,
  detail:   (websiteId: string, contactId: string) => [...leadKeys.details(), websiteId, contactId] as const,
  stats:    (websiteId: string) => [...leadKeys.all, 'stats', websiteId] as const,
};

const STALE_MS = 30_000;

export const contactsQueryOptions = (websiteId: string, filters: ContactFilters) =>
  queryOptions({
    queryKey: leadKeys.list(websiteId, filters),
    queryFn: () => leadsApi.listContacts(websiteId, filters),
    enabled: isValidId(websiteId),
    staleTime: STALE_MS,
    // Paging and typing in the search box should not flash the table empty.
    placeholderData: keepPreviousData,
  });

export function useContacts(websiteId: string, filters: ContactFilters) {
  return useQuery(contactsQueryOptions(websiteId, filters));
}

export function useContact(websiteId: string, contactId: string | null) {
  return useQuery({
    queryKey: leadKeys.detail(websiteId, contactId ?? ''),
    queryFn: () => leadsApi.getContact(websiteId, contactId ?? ''),
    enabled: isValidId(websiteId) && !!contactId,
    staleTime: STALE_MS,
  });
}

export function useLeadStats(websiteId: string) {
  return useQuery({
    queryKey: leadKeys.stats(websiteId),
    queryFn: () => leadsApi.stats(websiteId),
    enabled: isValidId(websiteId),
    staleTime: STALE_MS,
  });
}
