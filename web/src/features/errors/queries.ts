/** Query keys, options and read hooks for the errors feature. */
import { queryOptions, useQuery } from '@tanstack/react-query';
import { errorsApi } from './api';
import type { ErrorGroupFilters } from './types';

const isValidId = (id: string) => !!id && id !== 'demo';

/**
 * Key factory. Every key descends from `all`, so a mutation can invalidate the whole
 * feature, just its lists, or one group, without a caller ever writing a raw key array.
 */
export const errorKeys = {
  all:     ['errors'] as const,
  lists:   () => [...errorKeys.all, 'list'] as const,
  list:    (websiteId: string, filters: ErrorGroupFilters) =>
    [...errorKeys.lists(), websiteId, filters] as const,
  details: () => [...errorKeys.all, 'detail'] as const,
  detail:  (websiteId: string, fingerprint: string, days: number) =>
    [...errorKeys.details(), websiteId, fingerprint, days] as const,
};

/**
 * Errors are not live data. A fault from five seconds ago is no more actionable than one
 * from five minutes ago, and this page is read while someone works through a list — so
 * no refetch interval, and a window long enough that moving between a group and the list
 * behind it does not re-query.
 */
const STALE_MS = 60_000;

export const errorGroupsQueryOptions = (websiteId: string, filters: ErrorGroupFilters) =>
  queryOptions({
    queryKey: errorKeys.list(websiteId, filters),
    queryFn:  () => errorsApi.listGroups(websiteId, filters),
    enabled:  isValidId(websiteId),
    staleTime: STALE_MS,
  });

export const errorGroupQueryOptions = (websiteId: string, fingerprint: string, days: number) =>
  queryOptions({
    queryKey: errorKeys.detail(websiteId, fingerprint, days),
    queryFn:  () => errorsApi.getGroup(websiteId, fingerprint, days),
    enabled:  isValidId(websiteId) && !!fingerprint,
    staleTime: STALE_MS,
  });

export function useErrorGroups(websiteId: string, filters: ErrorGroupFilters) {
  return useQuery(errorGroupsQueryOptions(websiteId, filters));
}

export function useErrorGroup(websiteId: string, fingerprint: string | null, days: number) {
  return useQuery(errorGroupQueryOptions(websiteId, fingerprint ?? '', days));
}
