/** Query keys, options and read hooks for a form's submissions. */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { submissionsApi } from './api';
import type { SubmissionFilters } from './types';

/** Every key descends from `all`, so a mutation can invalidate the whole feature at once. */
export const submissionKeys = {
  all:     ['submissions'] as const,
  lists:   () => [...submissionKeys.all, 'list'] as const,
  list:    (websiteId: string, automationId: string, filters: SubmissionFilters) =>
    [...submissionKeys.lists(), websiteId, automationId, filters] as const,
  summary: (websiteId: string, automationId: string) => [...submissionKeys.all, 'summary', websiteId, automationId] as const,
};

const STALE_MS = 30_000;

export function useSubmissions(websiteId: string, automationId: string, filters: SubmissionFilters, enabled = true) {
  return useQuery({
    queryKey: submissionKeys.list(websiteId, automationId, filters),
    queryFn: () => submissionsApi.list(websiteId, automationId, filters),
    enabled: enabled && !!websiteId && !!automationId,
    staleTime: STALE_MS,
    // A delivery turns from pending to delivered while the page is open.
    refetchInterval: 20_000,
    // Paging and typing in the search box should not flash the table empty.
    placeholderData: keepPreviousData,
  });
}

export function useFormSummary(websiteId: string, automationId: string, enabled = true) {
  return useQuery({
    queryKey: submissionKeys.summary(websiteId, automationId),
    queryFn: () => submissionsApi.summary(websiteId, automationId),
    enabled: enabled && !!websiteId && !!automationId,
    staleTime: STALE_MS,
  });
}
