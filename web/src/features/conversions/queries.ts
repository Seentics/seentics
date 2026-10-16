/** Query keys and read hooks for Conversions. */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { conversionsApi } from './api';
import type { ConversionEventFilters } from './types';

/** Every key descends from `all`, so a write can invalidate the whole feature at once. */
export const conversionKeys = {
  all:          ['conversions'] as const,
  destinations: (websiteId: string) => [...conversionKeys.all, 'destinations', websiteId] as const,
  events:       (websiteId: string, filters: ConversionEventFilters) => [...conversionKeys.all, 'events', websiteId, filters] as const,
  summary:      (websiteId: string, days: number) => [...conversionKeys.all, 'summary', websiteId, days] as const,
};

const STALE_MS = 30_000;

export function useDestinations(websiteId: string) {
  return useQuery({
    queryKey: conversionKeys.destinations(websiteId),
    queryFn: () => conversionsApi.destinations(websiteId),
    enabled: !!websiteId,
    staleTime: STALE_MS,
  });
}

export function useConversionEvents(websiteId: string, filters: ConversionEventFilters, enabled = true) {
  return useQuery({
    queryKey: conversionKeys.events(websiteId, filters),
    queryFn: () => conversionsApi.events(websiteId, filters),
    enabled: enabled && !!websiteId,
    staleTime: STALE_MS,
    // A sent event settles within seconds; keep the list current while the page is open.
    refetchInterval: 15_000,
    placeholderData: keepPreviousData,
  });
}

export function useConversionSummary(websiteId: string, days: number, enabled = true) {
  return useQuery({
    queryKey: conversionKeys.summary(websiteId, days),
    queryFn: () => conversionsApi.summary(websiteId, days),
    enabled: enabled && !!websiteId,
    staleTime: STALE_MS,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });
}
