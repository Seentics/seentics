/** Query keys, options and read hooks for the analytics feature. */
import { useQuery } from '@tanstack/react-query';
import { isDemo, demoAnalyticsData } from '@/lib/demo';
import { isValidId } from '@/lib/utils';
import api from '@/lib/api';
import { dashboardRefreshMs } from './format';
import { previousRange, rangeKey, toRangeSpec, type AnalyticsRange } from './range';
import {
  getCustomEventsStats,
  getDailyStats,
  getDashboardData,
  getDimensionsBulk,
  getGeolocationBreakdown,
  getGoalStats,
  getHourlyStats,
  getLiveVisitors,
  getTopBrowsers,
  getTopCities,
  getTopCountries,
  getTopDevices,
  getTopLanguages,
  getTopOS,
  getTopPages,
  getTopReferrers,
  getTopResolutions,
  getVisitorInsights,
} from './api';
import type { AnalyticsFilters, GetDailyStatsResponse, GetHourlyStatsResponse, GetTopBrowsersResponse, GetTopCountriesResponse, GetTopDevicesResponse, GetTopOSResponse, GetTopPagesResponse, GetTopReferrersResponse, GetVisitorInsightsResponse } from './types';

// Query Keys
export const analyticsKeys = {
  all: ['analytics'] as const,
  dashboard: (websiteId: string, range: AnalyticsRange) => [...analyticsKeys.all, 'dashboard', websiteId, rangeKey(range)] as const,
  topPages: (websiteId: string, range: AnalyticsRange, filters: AnalyticsFilters = {}) => [...analyticsKeys.all, 'top-pages', websiteId, rangeKey(range), filters] as const,
  topReferrers: (websiteId: string, range: AnalyticsRange, filters: AnalyticsFilters = {}) => [...analyticsKeys.all, 'top-referrers', websiteId, rangeKey(range), filters] as const,
  topCountries: (websiteId: string, range: AnalyticsRange, filters: AnalyticsFilters = {}) => [...analyticsKeys.all, 'top-countries', websiteId, rangeKey(range), filters] as const,
  topBrowsers: (websiteId: string, range: AnalyticsRange, filters: AnalyticsFilters = {}) => [...analyticsKeys.all, 'top-browsers', websiteId, rangeKey(range), filters] as const,
  topDevices: (websiteId: string, range: AnalyticsRange, filters: AnalyticsFilters = {}) => [...analyticsKeys.all, 'top-devices', websiteId, rangeKey(range), filters] as const,
  topOS: (websiteId: string, range: AnalyticsRange, filters: AnalyticsFilters = {}) => [...analyticsKeys.all, 'top-os', websiteId, rangeKey(range), filters] as const,
  dimensionsBulk: (websiteId: string, range: AnalyticsRange, filters: AnalyticsFilters = {}) => [...analyticsKeys.all, 'dimensions-bulk', websiteId, rangeKey(range), filters] as const,
  liveVisitors: (websiteId: string) => [...analyticsKeys.all, 'live-visitors', websiteId] as const,
  trafficSummary: (websiteId: string, range: AnalyticsRange) => [...analyticsKeys.all, 'traffic-summary', websiteId, rangeKey(range)] as const,
  hourlyStats: (websiteId: string, range: AnalyticsRange, filters: AnalyticsFilters = {}) => [...analyticsKeys.all, 'hourly-stats', websiteId, rangeKey(range), filters] as const,
  activityTrends: (websiteId: string) => [...analyticsKeys.all, 'activity-trends', websiteId] as const,
  dailyStats: (websiteId: string, range: AnalyticsRange, filters: AnalyticsFilters = {}) => [...analyticsKeys.all, 'daily-stats', websiteId, rangeKey(range), filters] as const,
  goalStats: (websiteId: string, range: AnalyticsRange) => [...analyticsKeys.all, 'goal-stats', websiteId, rangeKey(range)] as const,
  customEvents: (websiteId: string, range: AnalyticsRange) => [...analyticsKeys.all, 'custom-events', websiteId, rangeKey(range)] as const,
  topResolutions: (websiteId: string, range: AnalyticsRange) => [...analyticsKeys.all, 'top-resolutions', websiteId, rangeKey(range)] as const,
  visitorInsights: (websiteId: string, range: AnalyticsRange) => [...analyticsKeys.all, 'visitor-insights', websiteId, rangeKey(range)] as const,
};

// Dashboard Data - returns comprehensive data with enhanced metrics
export const useDashboardData = (websiteId: string, range: AnalyticsRange = 7, filters: AnalyticsFilters = {}) => {
  return useQuery({
    queryKey: ['dashboard', websiteId, rangeKey(range), filters],
    queryFn: () => getDashboardData(websiteId, range, filters),
    enabled: isValidId(websiteId),
    // Scaled to the range rather than fixed — see `dashboardRefreshMs`.
    refetchInterval: dashboardRefreshMs(toRangeSpec(range).days),
    refetchOnWindowFocus: true,
    staleTime: Math.floor(dashboardRefreshMs(toRangeSpec(range).days) / 2),
  });
};

// Public Dashboard Data - used for shared/public dashboards
export const usePublicDashboardData = (publicId: string, days: number = 7) => {
  return useQuery({
    queryKey: ['public-dashboard', publicId, days],
    queryFn: async () => {
      const response = await api.get(`/analytics/public/dashboard/${publicId}`, {
        params: { days: days.toString() }
      });
      return response.data;
    },
    enabled: !!publicId,
  });
};

export const useTopLanguages = (websiteId: string, range: AnalyticsRange = 7) => {
  return useQuery({
    queryKey: [...analyticsKeys.all, 'top-languages', websiteId, rangeKey(range)],
    queryFn: () => getTopLanguages(websiteId, range),
    enabled: isValidId(websiteId),
    staleTime: 5 * 60 * 1000,
  });
};

export const useTopCities = (websiteId: string, range: AnalyticsRange = 7) => {
  return useQuery({
    queryKey: [...analyticsKeys.all, 'top-cities', websiteId, rangeKey(range)],
    queryFn: () => getTopCities(websiteId, range),
    enabled: isValidId(websiteId),
    staleTime: 5 * 60 * 1000,
  });
};

// Top Pages Hook
export const useTopPages = (websiteId: string, range: AnalyticsRange = 7, filters: AnalyticsFilters = {}) => {
  return useQuery<GetTopPagesResponse>({
    queryKey: analyticsKeys.topPages(websiteId, range, filters),
    queryFn: () => getTopPages(websiteId, range, filters),
    enabled: isValidId(websiteId),
    staleTime: 5 * 60 * 1000,
  });
};

// Top Referrers Hook
export const useTopReferrers = (websiteId: string, range: AnalyticsRange = 7, filters: AnalyticsFilters = {}) => {
  return useQuery<GetTopReferrersResponse>({
    queryKey: analyticsKeys.topReferrers(websiteId, range, filters),
    queryFn: () => getTopReferrers(websiteId, range, filters),
    enabled: isValidId(websiteId),
    staleTime: 5 * 60 * 1000,
  });
};

// Top Countries Hook
export const useTopCountries = (websiteId: string, range: AnalyticsRange = 7, filters: AnalyticsFilters = {}) => {
  return useQuery<GetTopCountriesResponse>({
    queryKey: analyticsKeys.topCountries(websiteId, range, filters),
    queryFn: () => getTopCountries(websiteId, range, filters),
    enabled: isValidId(websiteId),
    staleTime: 5 * 60 * 1000,
  });
};

// Top Browsers Hook
export const useTopBrowsers = (websiteId: string, range: AnalyticsRange = 7, filters: AnalyticsFilters = {}) => {
  return useQuery<GetTopBrowsersResponse>({
    queryKey: analyticsKeys.topBrowsers(websiteId, range, filters),
    queryFn: () => getTopBrowsers(websiteId, range, filters),
    enabled: isValidId(websiteId),
    staleTime: 5 * 60 * 1000,
  });
};

// Top Devices Hook
export const useTopDevices = (websiteId: string, range: AnalyticsRange = 7, filters: AnalyticsFilters = {}) => {
  return useQuery<GetTopDevicesResponse>({
    queryKey: analyticsKeys.topDevices(websiteId, range, filters),
    queryFn: () => getTopDevices(websiteId, range, filters),
    enabled: isValidId(websiteId),
    staleTime: 5 * 60 * 1000,
  });
};

// Top OS Hook
export const useTopOS = (websiteId: string, range: AnalyticsRange = 7, filters: AnalyticsFilters = {}) => {
  return useQuery<GetTopOSResponse>({
    queryKey: analyticsKeys.topOS(websiteId, range, filters),
    queryFn: () => getTopOS(websiteId, range, filters),
    enabled: isValidId(websiteId),
    staleTime: 5 * 60 * 1000,
  });
};

// Single hook that fetches all 6 dimension breakdowns in one request
export const useDimensionsBulk = (websiteId: string, range: AnalyticsRange = 7, filters: AnalyticsFilters = {}, enabled = true) => {
  return useQuery({
    queryKey: analyticsKeys.dimensionsBulk(websiteId, range, filters),
    queryFn:  () => getDimensionsBulk(websiteId, range, filters),
    enabled:  enabled && isValidId(websiteId),
    staleTime: 5 * 60 * 1000,
  });
};

// Top Resolutions Hook
export const useTopResolutions = (websiteId: string, range: AnalyticsRange = 7) => {
  return useQuery<any>({
    queryKey: analyticsKeys.topResolutions(websiteId, range),
    queryFn: () => getTopResolutions(websiteId, range),
    enabled: isValidId(websiteId),
    staleTime: 5 * 60 * 1000,
  });
};

// Live Visitors Hook
export const useLiveVisitors = (websiteId: string) => {
  return useQuery<number>({
    queryKey: analyticsKeys.liveVisitors(websiteId),
    queryFn: () => getLiveVisitors(websiteId),
    enabled: isValidId(websiteId),
    staleTime: 12_000,
    refetchInterval: 15_000,
  });
};

// Hourly Stats Hook
export const useHourlyStats = (websiteId: string, range: AnalyticsRange = 1, filters: AnalyticsFilters = {}) => {
  return useQuery<GetHourlyStatsResponse>({
    queryKey: analyticsKeys.hourlyStats(websiteId, range, filters),
    queryFn: () => getHourlyStats(websiteId, range, filters),
    enabled: isValidId(websiteId),
    staleTime: 5 * 60 * 1000,
  });
};

// Daily Stats Hook
export const useDailyStats = (websiteId: string, range: AnalyticsRange = 30, filters: AnalyticsFilters = {}) => {
  return useQuery<GetDailyStatsResponse>({
    queryKey: analyticsKeys.dailyStats(websiteId, range, filters),
    queryFn: () => getDailyStats(websiteId, range, filters),
    enabled: isValidId(websiteId),
    staleTime: 10 * 60 * 1000, // 10 minutes for daily stats
  });
};

// Custom Events Hook
export const useCustomEvents = (websiteId: string, range: AnalyticsRange = 30, enabled = true, filters: AnalyticsFilters = {}) => {
  return useQuery({
    queryKey: [...analyticsKeys.customEvents(websiteId, range), filters],
    queryFn: () => getCustomEventsStats(websiteId, range, filters),
    enabled: enabled && isValidId(websiteId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

// Goal Stats Hook
export const useGoalStats = (websiteId: string, range: AnalyticsRange = 30, enabled = true, filters: AnalyticsFilters = {}) => {
  return useQuery({
    queryKey: [...analyticsKeys.goalStats(websiteId, range), filters],
    queryFn: () => getGoalStats(websiteId, range, filters),
    enabled: enabled && isValidId(websiteId),
  });
};

// Visitor Insights Hook
export const useVisitorInsights = (websiteId: string, range: AnalyticsRange = 7, enabled = true, filters: AnalyticsFilters = {}) => {
  return useQuery<GetVisitorInsightsResponse>({
    queryKey: [...analyticsKeys.visitorInsights(websiteId, range), filters],
    queryFn: () => getVisitorInsights(websiteId, range, filters),
    enabled: enabled && isValidId(websiteId),
    staleTime: 10 * 60 * 1000, // 10 minutes for insights
  });
};

// Geolocation Hook
export const useGeolocationBreakdown = (websiteId: string, range: AnalyticsRange = 7, enabled = true, filters: AnalyticsFilters = {}) => {
  return useQuery({
    queryKey: [...analyticsKeys.all, 'geolocation-breakdown', websiteId, rangeKey(range), filters],
    queryFn: () => getGeolocationBreakdown(websiteId, range, filters),
    enabled: enabled && isValidId(websiteId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
};

/**
 * The daily series of the period before `range` — same number of days, ending the day before
 * it starts — for the comparison overlay. Asked for by its own dates (./range `previousRange`)
 * and zero-filled by the server, so day N lines up with day N; it used to fetch twice the range
 * and slice it by index, which shifted on every empty day and failed outright past 182 days.
 */
export const usePreviousPeriodDailyStats = (
  websiteId: string,
  range: AnalyticsRange = 7,
  enabled: boolean = true,
  filters: AnalyticsFilters = {},
) => {
  const previous = previousRange(range);
  return useQuery<GetDailyStatsResponse>({
    queryKey: [...analyticsKeys.all, 'previous-daily-stats', websiteId, rangeKey(previous), filters],
    queryFn: async () => {
      if (isDemo(websiteId)) {
        const demo = demoAnalyticsData().dailyStats as any;
        const stats = (demo?.daily_stats || []).sort(
          (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        return {
          ...demo,
          daily_stats: stats.map((s: any) => ({
            ...s,
            views: Math.max(0, Math.round(s.views * (0.7 + Math.random() * 0.4))),
            unique: Math.max(0, Math.round(s.unique * (0.7 + Math.random() * 0.4))),
          })),
        };
      }
      return getDailyStats(websiteId, previous, filters);
    },
    enabled: isValidId(websiteId) && enabled,
    staleTime: 10 * 60 * 1000,
  });
};
