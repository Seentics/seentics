/** Query keys, options and read hooks for the analytics feature. */
import { useQuery } from '@tanstack/react-query';
import { isDemo, demoAnalyticsData, demoRealtimeData, demoCustomEvents, demoGeolocation } from '@/lib/demo';
import { isValidId } from '@/lib/utils';
import api from '@/lib/api';
import { dashboardRefreshMs, getUserTimezone, normalizeRecentActivityApiPayload } from './format';
import {
  getCustomEventsStats,
  getDailyStats,
  getDashboardData,
  getDimensionsBulk,
  getGeolocationBreakdown,
  getHourlyStats,
  getLiveVisitors,
  getRealtimeData,
  getRealtimeGeoData,
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
import type {
  AnalyticsFilters,
  BrowserStat,
  CountryStat,
  CustomEventsStats,
  DailyStat,
  DashboardData,
  DeviceStat,
  GeolocationData,
  GetDailyStatsResponse,
  GetHourlyStatsResponse,
  GetTopBrowsersResponse,
  GetTopCountriesResponse,
  GetTopDevicesResponse,
  GetTopOSResponse,
  GetTopPagesResponse,
  GetTopReferrersResponse,
  GetVisitorInsightsResponse,
  HourlyStat,
  OSStat,
  PageStat,
  RealtimeData,
  RealtimeGeoResponse,
  RealtimeGeoVisitor,
  RealtimeMinute,
  ReferrerStat,
  TopVisitor,
  UseRecentActivityOptions,
  VisitorInsightsData,
} from './types';

// Query Keys
export const analyticsKeys = {
  all: ['analytics'] as const,
  dashboard: (websiteId: string, days: number) => [...analyticsKeys.all, 'dashboard', websiteId, days] as const,
  topPages: (websiteId: string, days: number, filters: AnalyticsFilters = {}) => [...analyticsKeys.all, 'top-pages', websiteId, days, filters] as const,
  topReferrers: (websiteId: string, days: number, filters: AnalyticsFilters = {}) => [...analyticsKeys.all, 'top-referrers', websiteId, days, filters] as const,
  topCountries: (websiteId: string, days: number, filters: AnalyticsFilters = {}) => [...analyticsKeys.all, 'top-countries', websiteId, days, filters] as const,
  topBrowsers: (websiteId: string, days: number, filters: AnalyticsFilters = {}) => [...analyticsKeys.all, 'top-browsers', websiteId, days, filters] as const,
  topDevices: (websiteId: string, days: number, filters: AnalyticsFilters = {}) => [...analyticsKeys.all, 'top-devices', websiteId, days, filters] as const,
  topOS: (websiteId: string, days: number, filters: AnalyticsFilters = {}) => [...analyticsKeys.all, 'top-os', websiteId, days, filters] as const,
  dimensionsBulk: (websiteId: string, days: number, filters: AnalyticsFilters = {}) => [...analyticsKeys.all, 'dimensions-bulk', websiteId, days, filters] as const,
  liveVisitors: (websiteId: string) => [...analyticsKeys.all, 'live-visitors', websiteId] as const,
  trafficSummary: (websiteId: string, days: number) => [...analyticsKeys.all, 'traffic-summary', websiteId, days] as const,
  hourlyStats: (websiteId: string, days: number, filters: AnalyticsFilters = {}) => [...analyticsKeys.all, 'hourly-stats', websiteId, days, filters] as const,
  activityTrends: (websiteId: string) => [...analyticsKeys.all, 'activity-trends', websiteId] as const,
  dailyStats: (websiteId: string, days: number, filters: AnalyticsFilters = {}) => [...analyticsKeys.all, 'daily-stats', websiteId, days, filters] as const,
  goalStats: (websiteId: string, days: number) => [...analyticsKeys.all, 'goal-stats', websiteId, days] as const,
  customEvents: (websiteId: string, days: number) => [...analyticsKeys.all, 'custom-events', websiteId, days] as const,
  topResolutions: (websiteId: string, days: number) => [...analyticsKeys.all, 'top-resolutions', websiteId, days] as const,
  visitorInsights: (websiteId: string, days: number) => [...analyticsKeys.all, 'visitor-insights', websiteId, days] as const,
};

// Dashboard Data - returns comprehensive data with enhanced metrics
export const useDashboardData = (websiteId: string, days: number = 7, filters: AnalyticsFilters = {}) => {
  return useQuery({
    queryKey: ['dashboard', websiteId, days, filters],
    queryFn: () => getDashboardData(websiteId, days, filters),
    enabled: isValidId(websiteId),
    // Scaled to the range rather than fixed — see `dashboardRefreshMs`.
    refetchInterval: dashboardRefreshMs(days),
    refetchOnWindowFocus: true,
    staleTime: Math.floor(dashboardRefreshMs(days) / 2),
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

export const useRealtimeData = (websiteId: string) => {
  return useQuery<RealtimeData>({
    queryKey: ['realtime', websiteId],
    queryFn: () => getRealtimeData(websiteId),
    enabled: isValidId(websiteId),
    refetchInterval: 15_000,
    staleTime: 12_000,
  });
};

export const useTopLanguages = (websiteId: string, days: number = 7) => {
  return useQuery({
    queryKey: [...analyticsKeys.all, 'top-languages', websiteId, days],
    queryFn: () => getTopLanguages(websiteId, days),
    enabled: isValidId(websiteId),
    staleTime: 5 * 60 * 1000,
  });
};

export const useTopCities = (websiteId: string, days: number = 7) => {
  return useQuery({
    queryKey: [...analyticsKeys.all, 'top-cities', websiteId, days],
    queryFn: () => getTopCities(websiteId, days),
    enabled: isValidId(websiteId),
    staleTime: 5 * 60 * 1000,
  });
};

// Top Pages Hook
export const useTopPages = (websiteId: string, days: number = 7, filters: AnalyticsFilters = {}) => {
  return useQuery<GetTopPagesResponse>({
    queryKey: analyticsKeys.topPages(websiteId, days, filters),
    queryFn: () => getTopPages(websiteId, days, filters),
    enabled: isValidId(websiteId),
    staleTime: 5 * 60 * 1000,
  });
};

// Top Referrers Hook
export const useTopReferrers = (websiteId: string, days: number = 7, filters: AnalyticsFilters = {}) => {
  return useQuery<GetTopReferrersResponse>({
    queryKey: analyticsKeys.topReferrers(websiteId, days, filters),
    queryFn: () => getTopReferrers(websiteId, days, filters),
    enabled: isValidId(websiteId),
    staleTime: 5 * 60 * 1000,
  });
};

// Top Countries Hook
export const useTopCountries = (websiteId: string, days: number = 7, filters: AnalyticsFilters = {}) => {
  return useQuery<GetTopCountriesResponse>({
    queryKey: analyticsKeys.topCountries(websiteId, days, filters),
    queryFn: () => getTopCountries(websiteId, days, filters),
    enabled: isValidId(websiteId),
    staleTime: 5 * 60 * 1000,
  });
};

// Top Browsers Hook
export const useTopBrowsers = (websiteId: string, days: number = 7, filters: AnalyticsFilters = {}) => {
  return useQuery<GetTopBrowsersResponse>({
    queryKey: analyticsKeys.topBrowsers(websiteId, days, filters),
    queryFn: () => getTopBrowsers(websiteId, days, filters),
    enabled: isValidId(websiteId),
    staleTime: 5 * 60 * 1000,
  });
};

// Top Devices Hook
export const useTopDevices = (websiteId: string, days: number = 7, filters: AnalyticsFilters = {}) => {
  return useQuery<GetTopDevicesResponse>({
    queryKey: analyticsKeys.topDevices(websiteId, days, filters),
    queryFn: () => getTopDevices(websiteId, days, filters),
    enabled: isValidId(websiteId),
    staleTime: 5 * 60 * 1000,
  });
};

// Top OS Hook
export const useTopOS = (websiteId: string, days: number = 7, filters: AnalyticsFilters = {}) => {
  return useQuery<GetTopOSResponse>({
    queryKey: analyticsKeys.topOS(websiteId, days, filters),
    queryFn: () => getTopOS(websiteId, days, filters),
    enabled: isValidId(websiteId),
    staleTime: 5 * 60 * 1000,
  });
};

// Single hook that fetches all 6 dimension breakdowns in one request
export const useDimensionsBulk = (websiteId: string, days: number = 7, filters: AnalyticsFilters = {}) => {
  return useQuery({
    queryKey: analyticsKeys.dimensionsBulk(websiteId, days, filters),
    queryFn:  () => getDimensionsBulk(websiteId, days, filters),
    enabled:  isValidId(websiteId),
    staleTime: 5 * 60 * 1000,
  });
};

// Top Resolutions Hook
export const useTopResolutions = (websiteId: string, days: number = 7) => {
  return useQuery<any>({
    queryKey: analyticsKeys.topResolutions(websiteId, days),
    queryFn: () => getTopResolutions(websiteId, days),
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
export const useHourlyStats = (websiteId: string, days: number = 1, filters: AnalyticsFilters = {}) => {
  return useQuery<GetHourlyStatsResponse>({
    queryKey: analyticsKeys.hourlyStats(websiteId, days, filters),
    queryFn: () => getHourlyStats(websiteId, days, filters),
    enabled: isValidId(websiteId),
    staleTime: 5 * 60 * 1000,
  });
};

// Daily Stats Hook
export const useDailyStats = (websiteId: string, days: number = 30, filters: AnalyticsFilters = {}) => {
  return useQuery<GetDailyStatsResponse>({
    queryKey: analyticsKeys.dailyStats(websiteId, days, filters),
    queryFn: () => getDailyStats(websiteId, days, filters),
    enabled: isValidId(websiteId),
    staleTime: 10 * 60 * 1000, // 10 minutes for daily stats
  });
};

// Custom Events Hook
export const useCustomEvents = (websiteId: string, days: number = 30) => {
  return useQuery({
    queryKey: analyticsKeys.customEvents(websiteId, days),
    queryFn: () => getCustomEventsStats(websiteId, days),
    enabled: isValidId(websiteId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

// Goal Stats Hook
export const useGoalStats = (websiteId: string, days: number = 30) => {
  return useQuery({
    queryKey: analyticsKeys.goalStats(websiteId, days),
    queryFn: async () => {
      if (isDemo(websiteId)) {
        return demoAnalyticsData().goalStats;
      }
      const response = await api.get(`/analytics/goals-stats/${websiteId}?days=${days}&timezone=${getUserTimezone()}`);
      return response.data;
    },
    enabled: isValidId(websiteId),
  });
};

export const useRecentActivity = (websiteId: string, options?: UseRecentActivityOptions) => {
  const limit = options?.limit ?? 20;
  const withinMinutes = options?.withinMinutes;
  const refetchInterval = options?.refetchIntervalMs ?? 30000;
  const staleTime = options?.staleTimeMs ?? Math.min(15000, refetchInterval - 1);
  return useQuery({
    queryKey: ['recent-activity', websiteId, limit, withinMinutes ?? 'all'],
    queryFn: async () => {
      if (isDemo(websiteId)) {
        return demoAnalyticsData().recentActivity;
      }
      const params = new URLSearchParams({ limit: String(limit) });
      if (typeof withinMinutes === 'number' && withinMinutes > 0) {
        params.set('within_minutes', String(withinMinutes));
      }
      const response = await api.get(`/analytics/recent-activity/${websiteId}?${params.toString()}`);
      return normalizeRecentActivityApiPayload(response.data, withinMinutes);
    },
    enabled: isValidId(websiteId),
    refetchInterval,
    staleTime,
  });
};

export const useRealtimeGeoData = (websiteId: string, withinMinutes = 30) => {
  return useQuery<RealtimeGeoResponse>({
    queryKey: ['realtime-geo', websiteId, withinMinutes],
    queryFn: () => getRealtimeGeoData(websiteId, withinMinutes),
    enabled: isValidId(websiteId),
    refetchInterval: 12_000,
    staleTime: 8000,
  });
};

// Visitor Insights Hook
export const useVisitorInsights = (websiteId: string, days: number = 7) => {
  return useQuery<GetVisitorInsightsResponse>({
    queryKey: analyticsKeys.visitorInsights(websiteId, days),
    queryFn: () => getVisitorInsights(websiteId, days),
    enabled: isValidId(websiteId),
    staleTime: 10 * 60 * 1000, // 10 minutes for insights
  });
};

// Hooks
export const useGeolocationBreakdown = (websiteId: string, days: number = 7) => {
  return useQuery({
    queryKey: [...analyticsKeys.all, 'geolocation-breakdown', websiteId, days],
    queryFn: () => getGeolocationBreakdown(websiteId, days),
    enabled: isValidId(websiteId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
};

// Previous Period Daily Stats Hook — fetches 2× the date range and returns the older half
export const usePreviousPeriodDailyStats = (websiteId: string, days: number = 7, enabled: boolean = true) => {
  return useQuery<GetDailyStatsResponse>({
    queryKey: [...analyticsKeys.all, 'previous-daily-stats', websiteId, days],
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
      const response = await api.get(
        `/analytics/daily-stats/${websiteId}?days=${days * 2}&timezone=${getUserTimezone()}`
      );
      const allStats = (response.data?.daily_stats || []).sort(
        (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      const previousStats = allStats.slice(0, Math.max(allStats.length - days, 0));
      return {
        ...response.data,
        daily_stats: previousStats,
      };
    },
    enabled: isValidId(websiteId) && enabled,
    staleTime: 10 * 60 * 1000,
  });
};
