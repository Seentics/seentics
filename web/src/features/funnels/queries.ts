/**
 * Funnel hooks, moved out of the analytics module.
 *
 * They lived in `lib/analytics-api.ts` purely because that file had become the place
 * things went. Funnels are their own domain with their own endpoints, and a module that
 * accumulates unrelated features is the shape the architecture doc warns against.
 */
import { useQuery } from '@tanstack/react-query';

import { isValidId } from '@/lib/utils';


import { getDashboardFunnelsAnalytics, fetchDashboardFunnelList, getDashboardFunnel, getDashboardFunnelAnalytics } from '@/lib/funnels-dashboard';
import type {
  DashboardFunnel as Funnel,
  DashboardFunnelStep as FunnelStep,
  FunnelListSummary,
  FunnelAnalyticsItem,
  FunnelAnalyticsResponse,
} from '@/lib/funnels-dashboard';
import { analyticsKeys } from '@/features/analytics/queries';

export type { Funnel, FunnelStep, FunnelListSummary, FunnelAnalyticsItem, FunnelAnalyticsResponse };



// React Query hooks for funnels
export const useFunnels = (websiteId: string) => {
  return useQuery<Funnel[]>({
    queryKey: [...analyticsKeys.all, 'funnels', websiteId],
    queryFn: () => fetchDashboardFunnelList(websiteId),
    enabled: isValidId(websiteId),
    staleTime: 5 * 60 * 1000,
  });
};

export const useFunnel = (websiteId: string, funnelId: string) => {
  return useQuery<Funnel>({
    queryKey: [...analyticsKeys.all, 'funnel', websiteId, funnelId],
    queryFn: () => getDashboardFunnel(websiteId, funnelId),
    enabled: isValidId(websiteId) && !!funnelId,
    staleTime: 5 * 60 * 1000,
  });
};

const funnelAnalyticsQuery = (funnelId: string, dateRange: number, websiteId?: string) => ({
  queryKey: [...analyticsKeys.all, 'funnel-analytics', funnelId, dateRange, websiteId ?? ''] as const,
  queryFn: () => getDashboardFunnelAnalytics(funnelId, dateRange, websiteId),
  enabled: !!funnelId,
  staleTime: 2 * 60 * 1000,
});

export const useFunnelAnalytics = (funnelId: string, dateRange: number = 7, websiteId?: string) => {
  return useQuery<FunnelAnalyticsResponse>(funnelAnalyticsQuery(funnelId, dateRange, websiteId));
};

/** One list report fetch; row cells read the same response without their own requests. */
export const useFunnelsAnalytics = (funnelIds: string[], dateRange = 7, websiteId = '') => {
  return useQuery({
    queryKey: [...analyticsKeys.all, 'funnel-analytics', 'batch', dateRange, websiteId, [...funnelIds].sort()],
    queryFn: () => getDashboardFunnelsAnalytics(websiteId, dateRange),
    enabled: isValidId(websiteId) && funnelIds.length > 0,
    staleTime: 2 * 60_000,
  });
};
