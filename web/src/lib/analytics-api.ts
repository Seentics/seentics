import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from './api'; // Your existing axios instance
import { isDemo, demoAnalyticsData, demoRealtimeData, demoCustomEvents, demoGeolocation, demoMutationGuard } from './demo';

// =============================================================================
// TIMEZONE UTILITY
// =============================================================================

/** Returns the user's IANA timezone (e.g. "Asia/Dhaka", "America/New_York") */
const getUserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
};

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface DashboardData {
  website_id: string;
  date_range: string;
  // Core 6 stats for SummaryCards
  total_visitors: number;
  unique_visitors: number;
  /** Distinct sessions in range (pageview session count). */
  sessions?: number;
  live_visitors: number;
  page_views: number;
  session_duration: number;
  bounce_rate: number;
  /** Nested KPIs from the API (same values as top-level fields). */
  metrics?: {
    page_views?: number;
    total_visitors?: number;
    unique_visitors?: number;
    sessions?: number;
    bounce_rate?: number;
    avg_session_time?: number;
    pages_per_session?: number;
  };
  // Comparison metrics for growth indicators
  comparison?: {
    current_period?: {
      total_visitors: number;
      unique_visitors: number;
      page_views: number;
      sessions: number;
      bounce_rate: number;
      avg_session_time: number;
    };
    previous_period?: {
      total_visitors: number;
      unique_visitors: number;
      page_views: number;
      sessions: number;
      bounce_rate: number;
      avg_session_time: number;
    };
    visitor_change?: number;
    pageview_change?: number;
    session_change?: number;
    bounce_change?: number;
    duration_change?: number;
  };
}



export interface PageStat {
  page: string;
  views: number;
  unique: number;
  bounce_rate?: number;
  avg_time?: number;
  exit_rate?: number;
  engagement_rate?: number;
  scroll_depth?: number;
  load_time?: number;
}

export interface ReferrerStat {
  referrer: string;
  views: number;
  unique: number;
  bounce_rate?: number;
}

export interface CountryStat {
  country: string;
  views: number;
  unique: number;
  bounce_rate?: number;
}

export interface BrowserStat {
  browser: string;
  views: number;
  unique: number;
  bounce_rate?: number;
}

export interface DeviceStat {
  device: string;
  views: number;
  unique: number;
  bounce_rate?: number;
}

export interface OSStat {
  os: string;
  views: number;
  unique: number;
  bounce_rate?: number;
}


// New Smart Deduplication Custom Events Stats
export interface CustomEventsStats {
  events: Array<{
    event_type: string;
    count: number;
    description: string;
    common_properties: Record<string, any>;
    sample_properties: Record<string, any>;
    sample_event: Record<string, any>;
    unique_visitors: number;
    unique_sessions: number;
    engagement_rate: number;
    expected_properties: string[];
  }>;
  total_events: number;
  total_occurrences: number;
}

export interface HourlyStat {
  hour: number;
  timestamp: string;
  views: number;
  unique: number;
  hour_label: string;
}

export interface DailyStat {
  date: string;
  views: number;
  unique: number;
}


export interface TopVisitor {
  visitor_id: string;
  page_views: number;
  sessions: number;
  visits: number;
}

export interface VisitorInsightsData {
  new_visitors: number;
  returning_visitors: number;
  avg_session_duration: number;
  top_entry_pages?: Array<{ page: string; sessions: number; bounce_rate: number }>;
  top_exit_pages?: Array<{ page: string; sessions: number; exit_rate: number }>;
}

// =============================================================================
// NEW INTERFACES FOR WRAPPED RESPONSES
// =============================================================================

export interface GetVisitorInsightsResponse {
  website_id: string;
  date_range: string;
  visitor_insights: VisitorInsightsData;
}

export interface GetTopPagesResponse {
  website_id: string;
  date_range: string;
  top_pages: PageStat[];
}

export interface GetTopReferrersResponse {
  website_id: string;
  date_range: string;
  top_referrers: ReferrerStat[];
}

export interface GetTopCountriesResponse {
  website_id: string;
  date_range: string;
  top_countries: CountryStat[];
}

export interface GetTopBrowsersResponse {
  website_id: string;
  date_range: string;
  top_browsers: BrowserStat[];
}

export interface GetTopDevicesResponse {
  website_id: string;
  date_range: string;
  top_devices: DeviceStat[];
}

export interface GetTopOSResponse {
  website_id: string;
  date_range: string;
  top_os: OSStat[];
}

export interface GetHourlyStatsResponse {
  website_id: string;
  date_range: string;
  hourly_stats: HourlyStat[];
}

export interface GetDailyStatsResponse {
  website_id: string;
  date_range: string;
  daily_stats: DailyStat[];
}

// =============================================================================
// API FUNCTIONS - ALL BACKEND ENDPOINTS
// =============================================================================

// Dashboard Data - returns comprehensive data with enhanced metrics
export const useDashboardData = (websiteId: string, days: number = 7, filters: AnalyticsFilters = {}) => {
  return useQuery({
    queryKey: ['dashboard', websiteId, days, filters],
    queryFn: async () => {
      if (isDemo(websiteId)) {
        return demoAnalyticsData().dashboardData;
      }

      const params = new URLSearchParams({ days: days.toString(), timezone: getUserTimezone() });
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await api.get(`/analytics/dashboard/${websiteId}?${params.toString()}`);
      return response.data;
    },
    enabled: !!websiteId,
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    refetchOnWindowFocus: true,
    staleTime: 15 * 1000, // Consider data stale after 15 seconds
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


// Top Pages
export const getTopPages = async (websiteId: string, days: number = 7, filters: AnalyticsFilters = {}): Promise<GetTopPagesResponse> => {
  if (isDemo(websiteId)) {
    return demoAnalyticsData().topPages as any;
  }
  const params = new URLSearchParams({ days: days.toString(), timezone: getUserTimezone() });
  Object.entries(filters).forEach(([key, value]) => { if (value) params.append(key, value); });
  const response = await api.get(`/analytics/top-pages/${websiteId}?${params.toString()}`);
  return response.data;
};

// Top Referrers
export const getTopReferrers = async (websiteId: string, days: number = 7, filters: AnalyticsFilters = {}): Promise<GetTopReferrersResponse> => {
  if (isDemo(websiteId)) {
    return demoAnalyticsData().topReferrers as any;
  }
  const params = new URLSearchParams({ days: days.toString(), timezone: getUserTimezone() });
  Object.entries(filters).forEach(([key, value]) => { if (value) params.append(key, value); });
  const response = await api.get(`/analytics/top-referrers/${websiteId}?${params.toString()}`);
  return response.data;
};

// Top Countries
export const getTopCountries = async (websiteId: string, days: number = 7, filters: AnalyticsFilters = {}): Promise<GetTopCountriesResponse> => {
  if (isDemo(websiteId)) {
    return demoAnalyticsData().topCountries as any;
  }
  const params = new URLSearchParams({ days: days.toString(), timezone: getUserTimezone() });
  Object.entries(filters).forEach(([key, value]) => { if (value) params.append(key, value); });
  const response = await api.get(`/analytics/top-countries/${websiteId}?${params.toString()}`);
  return response.data;
};

// Top Browsers
export const getTopBrowsers = async (websiteId: string, days: number = 7, filters: AnalyticsFilters = {}): Promise<GetTopBrowsersResponse> => {
  if (isDemo(websiteId)) {
    return demoAnalyticsData().topBrowsers as any;
  }
  const params = new URLSearchParams({ days: days.toString(), timezone: getUserTimezone() });
  Object.entries(filters).forEach(([key, value]) => { if (value) params.append(key, value); });
  const response = await api.get(`/analytics/top-browsers/${websiteId}?${params.toString()}`);
  return response.data;
};

// Top Devices
export const getTopDevices = async (websiteId: string, days: number = 7, filters: AnalyticsFilters = {}): Promise<GetTopDevicesResponse> => {
  if (isDemo(websiteId)) {
    return demoAnalyticsData().topDevices as any;
  }
  const params = new URLSearchParams({ days: days.toString(), timezone: getUserTimezone() });
  Object.entries(filters).forEach(([key, value]) => { if (value) params.append(key, value); });
  const response = await api.get(`/analytics/top-devices/${websiteId}?${params.toString()}`);
  return response.data;
};

// Top OS
export const getTopOS = async (websiteId: string, days: number = 7, filters: AnalyticsFilters = {}): Promise<GetTopOSResponse> => {
  if (isDemo(websiteId)) {
    return demoAnalyticsData().topOS as any;
  }
  const params = new URLSearchParams({ days: days.toString(), timezone: getUserTimezone() });
  Object.entries(filters).forEach(([key, value]) => { if (value) params.append(key, value); });
  const response = await api.get(`/analytics/top-os/${websiteId}?${params.toString()}`);
  return response.data;
};

// Top Resolutions
export const getTopResolutions = async (websiteId: string, days: number = 7, limit: number = 10): Promise<any> => {
  if (isDemo(websiteId)) {
    return demoAnalyticsData().topResolutions;
  }
  const response = await api.get(`/analytics/top-resolutions/${websiteId}?days=${days}&limit=${limit}&timezone=${getUserTimezone()}`);
  return response.data;
};

// Realtime Data
export interface RealtimeMinute {
  minute: string;
  visitors: number;
  views: number;
}

export interface RealtimeData {
  active_visitors: number;
  pageviews: number;
  sessions: number;
  top_pages: Array<{ page: string; visitors: number }>;
  top_referrers: Array<{ name: string; visitors: number }>;
  top_countries: Array<{ name: string; visitors: number }>;
  top_devices: Array<{ name: string; visitors: number }>;
  top_browsers: Array<{ name: string; visitors: number }>;
  timeline: RealtimeMinute[];
}

export const getRealtimeData = async (websiteId: string): Promise<RealtimeData> => {
  if (isDemo(websiteId)) {
    return demoRealtimeData() as RealtimeData;
  }
  const response = await api.get(`/analytics/realtime/${websiteId}?timezone=${getUserTimezone()}`);
  return response.data;
};

export const useRealtimeData = (websiteId: string) => {
  return useQuery<RealtimeData>({
    queryKey: ['realtime', websiteId],
    queryFn: () => getRealtimeData(websiteId),
    enabled: !!websiteId,
    refetchInterval: 5000,
    staleTime: 4000,
  });
};

// Live Visitors
export const getLiveVisitors = async (websiteId: string): Promise<number> => {
  if (isDemo(websiteId)) {
    return Math.floor(Math.random() * 50) + 10;
  }
  const response = await api.get(`/analytics/live-visitors/${websiteId}`);
  return response.data.live_visitors || 0;
};

// Top Languages
export const getTopLanguages = async (websiteId: string, days: number = 7): Promise<any> => {
  if (isDemo(websiteId)) {
    return demoAnalyticsData().topLanguages;
  }
  const response = await api.get(`/analytics/top-languages/${websiteId}?days=${days}&timezone=${getUserTimezone()}`);
  return response.data;
};

export const useTopLanguages = (websiteId: string, days: number = 7) => {
  return useQuery({
    queryKey: [...analyticsKeys.all, 'top-languages', websiteId, days],
    queryFn: () => getTopLanguages(websiteId, days),
    enabled: !!websiteId,
    staleTime: 5 * 60 * 1000,
  });
};

// Top Cities
export const getTopCities = async (websiteId: string, days: number = 7): Promise<any> => {
  if (isDemo(websiteId)) {
    return demoAnalyticsData().topCities;
  }
  const response = await api.get(`/analytics/top-cities/${websiteId}?days=${days}&timezone=${getUserTimezone()}`);
  return response.data;
};

export const useTopCities = (websiteId: string, days: number = 7) => {
  return useQuery({
    queryKey: [...analyticsKeys.all, 'top-cities', websiteId, days],
    queryFn: () => getTopCities(websiteId, days),
    enabled: !!websiteId,
    staleTime: 5 * 60 * 1000,
  });
};

// Hourly Stats
export const getHourlyStats = async (websiteId: string, days: number = 7, filters: AnalyticsFilters = {}): Promise<GetHourlyStatsResponse> => {
  if (isDemo(websiteId)) {
    return demoAnalyticsData().hourlyStats as any;
  }
  const params = new URLSearchParams({ days: days.toString(), timezone: getUserTimezone() });
  Object.entries(filters).forEach(([key, value]) => { if (value) params.append(key, value); });
  const response = await api.get(`/analytics/hourly-stats/${websiteId}?${params.toString()}`);

  // Backend already returns hours in the user's timezone via toStartOfHour(timestamp, tz).
  // Parse the hour number from the backend's "YYYY-MM-DD HH:00:00" string.
  if (response.data.hourly_stats) {
    response.data.hourly_stats = response.data.hourly_stats.map((stat: any) => {
      // stat.hour is e.g. "2026-02-27 06:00:00" — extract the hour part
      const hourStr = typeof stat.hour === 'string' ? stat.hour : '';
      const match = hourStr.match(/(\d{2}):(\d{2}):\d{2}$/);
      const h = match ? parseInt(match[1], 10) : 0;

      return {
        ...stat,
        hour: h,
        hour_label: `${h.toString().padStart(2, '0')}:00`,
      };
    });
  }

  return response.data;
};


// Daily Stats
export const getDailyStats = async (websiteId: string, days: number = 30, filters: AnalyticsFilters = {}): Promise<GetDailyStatsResponse> => {
  if (isDemo(websiteId)) {
    return demoAnalyticsData().dailyStats as any;
  }
  const params = new URLSearchParams({ days: days.toString(), timezone: getUserTimezone() });
  Object.entries(filters).forEach(([key, value]) => { if (value) params.append(key, value); });
  const response = await api.get(`/analytics/daily-stats/${websiteId}?${params.toString()}`);
  return response.data;
};

// Custom Events Stats
export const getCustomEventsStats = async (websiteId: string, days: number = 7): Promise<any> => {
  if (isDemo(websiteId)) {
    return demoCustomEvents() as any;
  }
  // Call backend via gateway to get custom events + UTM performance
  const response = await api.get(`/analytics/custom-events/${websiteId}?days=${days}&timezone=${getUserTimezone()}`);
  return response.data;
}

// Anomaly detection - REMOVED: Backend doesn't support this endpoint for MVP
// export const detectAnomalies = async (websiteId: string, days: number = 14, metric: string = 'page_views'): Promise<AnomalyResult> => {
//   const response = await api.post(`/api/v1/analytics/anomalies`, { website_id: websiteId, days, metric });
//   return response.data;
// };


// Visitor Insights
export const getVisitorInsights = async (websiteId: string, days: number = 7): Promise<GetVisitorInsightsResponse> => {
  if (isDemo(websiteId)) {
    return demoAnalyticsData().visitorInsights as any;
  }
  const response = await api.get(`/analytics/visitor-insights/${websiteId}?days=${days}&timezone=${getUserTimezone()}`);
  return response.data;
};

// =============================================================================
// REACT QUERY HOOKS
// =============================================================================

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

// Top Pages Hook
export const useTopPages = (websiteId: string, days: number = 7, filters: AnalyticsFilters = {}) => {
  return useQuery<GetTopPagesResponse>({
    queryKey: analyticsKeys.topPages(websiteId, days, filters),
    queryFn: () => getTopPages(websiteId, days, filters),
    enabled: !!websiteId,
    staleTime: 5 * 60 * 1000,
  });
};

// Top Referrers Hook
export const useTopReferrers = (websiteId: string, days: number = 7, filters: AnalyticsFilters = {}) => {
  return useQuery<GetTopReferrersResponse>({
    queryKey: analyticsKeys.topReferrers(websiteId, days, filters),
    queryFn: () => getTopReferrers(websiteId, days, filters),
    enabled: !!websiteId,
    staleTime: 5 * 60 * 1000,
  });
};

// Top Countries Hook
export const useTopCountries = (websiteId: string, days: number = 7, filters: AnalyticsFilters = {}) => {
  return useQuery<GetTopCountriesResponse>({
    queryKey: analyticsKeys.topCountries(websiteId, days, filters),
    queryFn: () => getTopCountries(websiteId, days, filters),
    enabled: !!websiteId,
    staleTime: 5 * 60 * 1000,
  });
};

// Top Browsers Hook
export const useTopBrowsers = (websiteId: string, days: number = 7, filters: AnalyticsFilters = {}) => {
  return useQuery<GetTopBrowsersResponse>({
    queryKey: analyticsKeys.topBrowsers(websiteId, days, filters),
    queryFn: () => getTopBrowsers(websiteId, days, filters),
    enabled: !!websiteId,
    staleTime: 5 * 60 * 1000,
  });
};

// Top Devices Hook
export const useTopDevices = (websiteId: string, days: number = 7, filters: AnalyticsFilters = {}) => {
  return useQuery<GetTopDevicesResponse>({
    queryKey: analyticsKeys.topDevices(websiteId, days, filters),
    queryFn: () => getTopDevices(websiteId, days, filters),
    enabled: !!websiteId,
    staleTime: 5 * 60 * 1000,
  });
};

// Top OS Hook
export const useTopOS = (websiteId: string, days: number = 7, filters: AnalyticsFilters = {}) => {
  return useQuery<GetTopOSResponse>({
    queryKey: analyticsKeys.topOS(websiteId, days, filters),
    queryFn: () => getTopOS(websiteId, days, filters),
    enabled: !!websiteId,
    staleTime: 5 * 60 * 1000,
  });
};

// Top Resolutions Hook
export const useTopResolutions = (websiteId: string, days: number = 7) => {
  return useQuery<any>({
    queryKey: analyticsKeys.topResolutions(websiteId, days),
    queryFn: () => getTopResolutions(websiteId, days),
    enabled: !!websiteId,
    staleTime: 5 * 60 * 1000,
  });
};

// Live Visitors Hook
export const useLiveVisitors = (websiteId: string) => {
  return useQuery<number>({
    queryKey: analyticsKeys.liveVisitors(websiteId),
    queryFn: () => getLiveVisitors(websiteId),
    enabled: !!websiteId,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refresh every 60 seconds
  });
};

// Hourly Stats Hook
export const useHourlyStats = (websiteId: string, days: number = 1, filters: AnalyticsFilters = {}) => {
  return useQuery<GetHourlyStatsResponse>({
    queryKey: analyticsKeys.hourlyStats(websiteId, days, filters),
    queryFn: () => getHourlyStats(websiteId, days, filters),
    enabled: !!websiteId,
    staleTime: 5 * 60 * 1000,
  });
};

// Daily Stats Hook
export const useDailyStats = (websiteId: string, days: number = 30, filters: AnalyticsFilters = {}) => {
  return useQuery<GetDailyStatsResponse>({
    queryKey: analyticsKeys.dailyStats(websiteId, days, filters),
    queryFn: () => getDailyStats(websiteId, days, filters),
    enabled: !!websiteId,
    staleTime: 10 * 60 * 1000, // 10 minutes for daily stats
  });
};

// Custom Events Hook
export const useCustomEvents = (websiteId: string, days: number = 30) => {
  return useQuery({
    queryKey: analyticsKeys.customEvents(websiteId, days),
    queryFn: () => getCustomEventsStats(websiteId, days),
    enabled: !!websiteId,
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
    enabled: !!websiteId,
  });
};

export const useRecentActivity = (websiteId: string) => {
  return useQuery({
    queryKey: ['recent-activity', websiteId],
    queryFn: async () => {
      if (isDemo(websiteId)) {
        return demoAnalyticsData().recentActivity;
      }
      const response = await api.get(`/analytics/recent-activity/${websiteId}?limit=20`);
      return response.data;
    },
    enabled: !!websiteId,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000,
  });
};



// Visitor Insights Hook
export const useVisitorInsights = (websiteId: string, days: number = 7) => {
  return useQuery<GetVisitorInsightsResponse>({
    queryKey: analyticsKeys.visitorInsights(websiteId, days),
    queryFn: () => getVisitorInsights(websiteId, days),
    enabled: !!websiteId,
    staleTime: 10 * 60 * 1000, // 10 minutes for insights
  });
};


// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

// Helper function to format large numbers
export const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

// Helper function to format duration (seconds to human readable)
export const formatDuration = (seconds: number): string => {
  // Handle invalid or zero values
  if (!seconds || seconds <= 0) {
    return '0s';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
};

// Helper function to format percentage
export const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`;
};


// =============================================================================
// EXPORT DEFAULT
// =============================================================================

export default {
  // API functions
  getTopPages,
  getTopReferrers,
  getTopCountries,
  getTopBrowsers,
  getTopDevices,

  getHourlyStats,
  getDailyStats,
  getCustomEventsStats,
  getVisitorInsights,

  // Hooks
  useDashboardData,
  usePublicDashboardData,

  useTopPages,
  useTopReferrers,
  useTopCountries,
  useTopBrowsers,
  useTopDevices,

  useHourlyStats,
  useDailyStats,
  useCustomEvents,
  useVisitorInsights,

  // Query Keys
  analyticsKeys,

  // Helper functions
  formatNumber,
  formatDuration,
  formatPercentage,
};

// =============================================================================
// FUNNEL MANAGEMENT API
// =============================================================================

export interface FunnelStep {
  id: string;
  name: string;
  type: 'page' | 'event' | 'custom';
  condition: {
    page?: string;
    event?: string;
    custom?: string;
  };
  order: number;
}

export interface Funnel {
  id: string;
  name: string;
  description?: string;
  website_id: string;
  user_id?: string;
  steps: FunnelStep[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FunnelAnalyticsItem {
  funnel_id: string;
  website_id: string;
  date: string;
  total_starts: number;
  total_conversions: number;
  conversion_rate: number;
  avg_value: number;
  total_value: number;
  step_metrics?: any;
  avg_time_to_convert?: number;
  avg_time_to_abandon?: number;
  drop_off_rate?: number;
  abandonment_rate?: number;
}

export interface FunnelAnalyticsResponse {
  status: string;
  analytics: FunnelAnalyticsItem[];
  count: number;
}

export interface FunnelAnalytics {
  funnelId: string;
  totalVisitors: number;
  steps: Array<{
    stepId: string;
    name: string;
    count: number;
    conversionRate: number;
    dropOffRate: number;
    avgTimeOnStep: number;
  }>;
  overallConversionRate: number;
  biggestDropOff: {
    stepName: string;
    dropOffRate: number;
  };
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

// Create a new funnel
export async function createFunnel(websiteId: string, funnelData: Omit<Funnel, 'id' | 'website_id' | 'created_at' | 'updated_at'>): Promise<Funnel> {
  if (demoMutationGuard(websiteId)) {
    return { id: 'demo-new', website_id: websiteId, ...funnelData, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as Funnel;
  }
  try {
    const response = await api.post(`/funnels/`, {
      ...funnelData,
      website_id: websiteId
    });
    // Handle both direct object response and wrapped response
    if (response.data && response.data.funnel) {
      return response.data.funnel;
    } else {
      return response.data;
    }
  } catch (error: any) {
    console.error('Error creating funnel:', error);

    // Check for limit reached error
    if (error.response?.status === 403 && error.response?.data?.error === 'Funnel limit reached') {
      throw new Error(`Funnel limit reached! You've reached your plan's funnel limit. Please upgrade to create more funnels.`);
    }

    // Check for other limit-related errors  
    if (error.response?.data?.message?.includes('limit')) {
      throw new Error(error.response.data.message);
    }

    throw error;
  }
}

// Get all funnels for a website
export async function getFunnels(websiteId: string): Promise<Funnel[]> {
  if (isDemo(websiteId)) {
    const { demoFunnels } = await import('./demo');
    return demoFunnels().funnels as any;
  }
  try {
    const response = await api.get(`/funnels/`, {
      params: { website_id: websiteId }
    });

    // Handle both direct object response and wrapped response
    if (response.data && response.data.funnels) {
      return response.data.funnels;
    } else if (response.data && response.data.data) {
      return response.data.data;
    } else {
      return response.data;
    }
  } catch (error) {
    throw error;
  }
}

// Get a specific funnel
export async function getFunnel(funnelId: string): Promise<Funnel> {
  try {
    const response = await api.get(`/funnels/${funnelId}`);
    // Handle both direct object response and wrapped response
    if (response.data && response.data.funnel) {
      return response.data.funnel;
    } else {
      return response.data;
    }
  } catch (error) {
    throw error;
  }
}

// Update a funnel
export async function updateFunnel(funnelId: string, funnelData: Partial<Funnel>): Promise<Funnel> {
  try {
    const response = await api.put(`/funnels/${funnelId}`, funnelData);
    // Handle both direct object response and wrapped response
    if (response.data && response.data.funnel) {
      return response.data.funnel;
    } else {
      return response.data;
    }
  } catch (error) {
    throw error;
  }
}

// Delete a funnel
export async function deleteFunnel(funnelId: string): Promise<void> {
  try {
    await api.delete(`/funnels/${funnelId}`);
  } catch (error) {
    throw error;
  }
}

// Get funnel analytics data
export async function getFunnelAnalytics(funnelId: string, dateRange: number = 7): Promise<FunnelAnalyticsResponse> {
  if (funnelId.startsWith('demo-')) {
    const { demoFunnelAnalytics } = await import('./demo');
    return demoFunnelAnalytics(funnelId);
  }
  try {
    const response = await api.get(`/funnels/${funnelId}/analytics`, {
      params: { days: dateRange }
    });

    // Handle different response formats from the analytics service
    if (response.data && typeof response.data === 'object') {
      // If the response has a 'data' wrapper, unwrap it
      if ('data' in response.data) {
        return response.data.data;
      }
      // If it's a direct analytics object, return it
      return response.data;
    }

    // Return empty analytics if no valid data
    return {
      status: 'success',
      analytics: [{
        funnel_id: funnelId,
        website_id: '',
        date: new Date().toISOString().split('T')[0],
        total_starts: 0,
        total_conversions: 0,
        conversion_rate: 0,
        avg_value: 0,
        total_value: 0,
        drop_off_rate: 100,
        abandonment_rate: 100
      }],
      count: 0
    };
  } catch (error) {
    console.warn(`Failed to fetch funnel analytics for ${funnelId}:`, error);
    // Return empty analytics structure instead of throwing
    return {
      status: 'error',
      analytics: [{
        funnel_id: funnelId,
        website_id: '',
        date: new Date().toISOString().split('T')[0],
        total_starts: 0,
        total_conversions: 0,
        conversion_rate: 0,
        avg_value: 0,
        total_value: 0,
        drop_off_rate: 100,
        abandonment_rate: 100
      }],
      count: 0
    };
  }
}


// Compare multiple funnels
export async function compareFunnels(websiteId: string, funnelIds: string[], dateRange: number = 7): Promise<any> {
  try {
    const response = await api.post(`/funnels/compare?website_id=${websiteId}`, {
      funnel_ids: funnelIds,
      date_range: dateRange
    });
    return response.data;
  } catch (error) {
    throw error;
  }
}

// React Query hooks for funnels
export const useFunnels = (websiteId: string) => {
  return useQuery<Funnel[]>({
    queryKey: [...analyticsKeys.all, 'funnels', websiteId],
    queryFn: () => getFunnels(websiteId),
    enabled: !!websiteId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useFunnel = (funnelId: string) => {
  return useQuery<Funnel>({
    queryKey: [...analyticsKeys.all, 'funnel', funnelId],
    queryFn: () => getFunnel(funnelId),
    enabled: !!funnelId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useFunnelAnalytics = (funnelId: string, dateRange: number = 7) => {
  return useQuery<FunnelAnalyticsResponse>({
    queryKey: [...analyticsKeys.all, 'funnel-analytics', funnelId, dateRange],
    queryFn: () => getFunnelAnalytics(funnelId, dateRange),
    enabled: !!funnelId,
    staleTime: 2 * 60 * 1000,
  });
};

export const useCreateFunnel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ websiteId, funnelData }: { websiteId: string; funnelData: Omit<Funnel, 'id' | 'website_id' | 'created_at' | 'updated_at'> }) =>
      createFunnel(websiteId, funnelData),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [...analyticsKeys.all, 'funnels'] });
    },
  });
};

export const useUpdateFunnel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ funnelId, funnelData }: { funnelId: string; funnelData: Partial<Funnel> }) =>
      updateFunnel(funnelId, funnelData),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [...analyticsKeys.all, 'funnels'] });
      queryClient.invalidateQueries({ queryKey: [...analyticsKeys.all, 'funnel-analytics'] });
    },
  });
};

export const useDeleteFunnel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (funnelId: string) => deleteFunnel(funnelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...analyticsKeys.all, 'funnels'] });
      queryClient.invalidateQueries({ queryKey: [...analyticsKeys.all, 'funnel-analytics'] });
    },
  });
};

// Delete multiple funnels
export async function deleteFunnels(websiteId: string, funnelIds: string[]): Promise<void> {
  if (demoMutationGuard(websiteId)) return;
  try {
    await api.delete(`/funnels/bulk-delete?website_id=${websiteId}`, {
      data: { funnelIds }
    });
  } catch (error: any) {
    throw error;
  }
}

export const useDeleteFunnels = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ websiteId, funnelIds }: { websiteId: string; funnelIds: string[] }) => 
      deleteFunnels(websiteId, funnelIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [...analyticsKeys.all, 'funnels', variables.websiteId] });
      queryClient.invalidateQueries({ queryKey: [...analyticsKeys.all, 'funnel-analytics'] });
    },
  });
};



export const useCompareFunnels = () => {
  return useMutation({
    mutationFn: ({ websiteId, funnelIds, dateRange }: {
      websiteId: string;
      funnelIds: string[];
      dateRange?: number
    }) => compareFunnels(websiteId, funnelIds, dateRange || 7),
  });
};

// =============================================================================
// GEOLOCATION ANALYTICS
// =============================================================================

export interface GeolocationData {
  countries: Array<{
    name: string;
    count: number;
    percentage: number;
  }>;
  continents: Array<{
    name: string;
    count: number;
    percentage: number;
  }>;
  regions: Array<{
    name: string;
    count: number;
    percentage: number;
  }>;
  cities: Array<{
    name: string;
    count: number;
    percentage: number;
  }>;
}

// API Functions
export const getGeolocationBreakdown = async (websiteId: string, days: number = 7): Promise<GeolocationData> => {
  if (isDemo(websiteId)) {
    return demoGeolocation();
  }
  const response = await api.get(`/analytics/geolocation-breakdown/${websiteId}?days=${days}&timezone=${getUserTimezone()}`);
  return response.data;
};

// Hooks
export const useGeolocationBreakdown = (websiteId: string, days: number = 7) => {
  return useQuery({
    queryKey: [...analyticsKeys.all, 'geolocation-breakdown', websiteId, days],
    queryFn: () => getGeolocationBreakdown(websiteId, days),
    enabled: !!websiteId,
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
    enabled: !!websiteId && enabled,
    staleTime: 10 * 60 * 1000,
  });
};

// Analytics Filters Interface
export interface AnalyticsFilters {
  country?: string;
  device?: string;
  browser?: string;
  os?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  page_path?: string;
  prop_key?: string;
  prop_value?: string;
}