/** Query keys, options and read hooks for a form's submissions, and the site-wide Leads page. */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { leadsApi, submissionsApi } from './api';
import type { ContactFilters, SiteSubmissionFilters, SubmissionFilters } from './types';

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

// ── Site-wide: the Leads page ────────────────────────────────────────────────


/** Kept apart from `submissionKeys` so a contact edit does not refetch every form's list; leads writes invalidate both. */
export const leadKeys = {
  all:         ['leads'] as const,
  submissions: (websiteId: string, filters: SiteSubmissionFilters) => [...leadKeys.all, 'submissions', websiteId, filters] as const,
  forms:       (websiteId: string) => [...leadKeys.all, 'forms', websiteId] as const,
  tags:        (websiteId: string) => [...leadKeys.all, 'tags', websiteId] as const,
  contacts:    (websiteId: string, filters: ContactFilters) => [...leadKeys.all, 'contacts', websiteId, filters] as const,
  contact:     (websiteId: string, contactId: string) => [...leadKeys.all, 'contact', websiteId, contactId] as const,
};

export function useSiteSubmissions(websiteId: string, filters: SiteSubmissionFilters, enabled = true) {
  return useQuery({
    queryKey: leadKeys.submissions(websiteId, filters),
    queryFn: () => leadsApi.submissions(websiteId, filters),
    enabled: enabled && !!websiteId,
    staleTime: STALE_MS,
    refetchInterval: 20_000,
    placeholderData: keepPreviousData,
  });
}

export function useContactTags(websiteId: string) {
  return useQuery({
    queryKey: leadKeys.tags(websiteId),
    queryFn: () => leadsApi.contactTags(websiteId),
    enabled: !!websiteId,
    staleTime: STALE_MS,
  });
}

export function useLeadForms(websiteId: string) {
  return useQuery({
    queryKey: leadKeys.forms(websiteId),
    queryFn: () => leadsApi.forms(websiteId),
    enabled: !!websiteId,
    staleTime: 5 * 60_000,
  });
}

export function useContacts(websiteId: string, filters: ContactFilters, enabled = true) {
  return useQuery({
    queryKey: leadKeys.contacts(websiteId, filters),
    queryFn: () => leadsApi.contacts(websiteId, filters),
    enabled: enabled && !!websiteId,
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
  });
}

export function useContact(websiteId: string, contactId: string | null) {
  return useQuery({
    queryKey: leadKeys.contact(websiteId, contactId ?? ''),
    queryFn: () => leadsApi.contact(websiteId, contactId!),
    enabled: !!websiteId && !!contactId,
    staleTime: STALE_MS,
  });
}
