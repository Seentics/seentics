import type { ChartConfig } from '@/components/ui/chart';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from './api'; // Your existing axios instance
import { getDemoData } from './demo-data';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface EventData {
  website_id: string;
  visitor_id: string;
  page: string;
  event_type?: string;
  session_id?: string;
  referrer?: string;
  user_id?: string;
  value?: number;
  browser?: string;
  device?: string;
  country?: string;
  city?: string;
  os?: string;
  // Enhanced tracking fields
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  properties?: Record<string, any>;
  scroll_depth?: number;
  exit_intent?: boolean;
  time_on_page?: number;
  session_duration?: number;
  pages_in_session?: number;
  is_bounce?: boolean;
  entry_page?: string;
  exit_page?: string;
  screen_width?: number;
  screen_height?: number;
  viewport_width?: number;
  viewport_height?: number;
  page_load_time?: number;
  dom_content_loaded?: number;
  language?: string;
  timezone?: string;
  is_bot?: boolean;
  is_new_user?: boolean;
  is_returning?: boolean;
}

export interface BatchEventRequest {
  siteId: string;
  domain: string;
  events: EventData[];
}

export interface TrackEventResponse {
  status: string;
  event_id: string;
  visitor_id: string;
  session_id: string;
}

export interface BatchEventResponse {
  status: string;
  events_count: number;
  processed_at: number;
}

export interface DashboardData {
  website_id: string;
  date_range: string;
  // Core 6 stats for SummaryCards
  total_visitors: number;
  unique_visitors: number;
  live_visitors: number;
  page_views: number;
  session_duration: number;
  bounce_rate: number;
  // Comparison metrics for growth indicators
  comparison?: {
    visitor_change: number;
    pageview_change: number;
    session_change: number;
    bounce_change: number;
    duration_change: number;
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

// Custom Events
export interface CustomEventsStatsResponse {
  website_id: string;
  date_range: string;
  timeseries: Array<{ date: string; count: number }>;
  top_events: Array<{
    event_type: string;
    count: number;
    description?: string;
    common_properties?: string[];
    sample_properties?: Record<string, any>;
    sample_event?: Record<string, any>;
  }>;
  total_events?: number;
  unique_events?: number;
  utm_performance?: {
    sources: Array<{
      source: string;
      unique_visitors: number;
      visits: number;
      sessions: number;
    }>;
    mediums: Array<{
      medium: string;
      unique_visitors: number;
      visits: number;
    }>;
    campaigns: Array<{
      campaign: string;
      unique_visitors: number;
      visits: number;
    }>;
    terms: Array<{
      term: string;
      unique_visitors: number;
      visits: number;
    }>;
    content: Array<{
      content: string;
      unique_visitors: number;
      visits: number;
    }>;
  };
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

export interface AnomalyResult {
  metric: string;
  current: number;
  baseline_mean: number;
  baseline_std: number;
  z_score: number;
  status: 'normal' | 'spike' | 'drop';
  series: Array<{ date: string; value: number }>;
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

export interface TrafficSummary {
  website_id: string;
  date_range: string;
  total_page_views: number;
  unique_visitors: number;
  total_sessions: number;
  bounce_rate: number;
  avg_session_time: number;
  pages_per_session: number;
  growth_rate: number;
  visitors_growth_rate: number;
  sessions_growth_rate: number;
  new_visitors: number;
  returning_visitors: number;
  engagement_score: number;
  retention_rate: number;
  top_traffic_sources: Array<{
    source: string;
    visitors: number;
    page_views: number;
    bounce_rate: number;
  }>;
  utm_performance: {
    sources: Record<string, number>;
    mediums: Record<string, number>;
    campaigns: Record<string, number>;
    terms: Record<string, number>;
    content: Record<string, number>;
  };
}

export interface RetentionData {
  website_id: string;
  date_range: string;
  day_1: number;
  day_7: number;
  day_30: number;
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

export interface GetActivityTrendsResponse {
  website_id: string;
  trends: ActivityTrend[];
}

export interface ActivityTrend {
  hour: number;
  timestamp: string;
  time: string;
  users: number;
  events: number;
  sessions: number;
  pageViews: number;
  engagement: number;
}

export interface GetDailyStatsResponse {
  website_id: string;
  date_range: string;
  daily_stats: DailyStat[];
}

// =============================================================================
// API FUNCTIONS - ALL BACKEND ENDPOINTS
// =============================================================================

// Event Tracking
export const trackEvent = async (eventData: EventData): Promise<TrackEventResponse> => {
  const response = await api.post('/analytics/event', eventData);
  return response.data;
};

export const trackBatchEvents = async (batchData: BatchEventRequest): Promise<BatchEventResponse> => {
  const response = await api.post('/analytics/batch', batchData);
  return response.data;
};

// Dashboard Data - returns comprehensive data with enhanced metrics
export const getDashboardData = async (websiteId: string, days: number = 7): Promise<DashboardData> => {
  if (websiteId === 'demo') {
    return getDemoData().dashboardData as any;
  }
  const response = await api.get(`/analytics/dashboard/${websiteId}?days=${days}`);
  return response.data;
};



// Top Pages
export const getTopPages = async (websiteId: string, days: number = 7): Promise<GetTopPagesResponse> => {
  if (websiteId === 'demo') {
    return getDemoData().topPages as any;
  }
  const response = await api.get(`/analytics/top-pages/${websiteId}?days=${days}`);
  return response.data;
};

// Top Referrers
export const getTopReferrers = async (websiteId: string, days: number = 7): Promise<GetTopReferrersResponse> => {
  if (websiteId === 'demo') {
    return getDemoData().topReferrers as any;
  }
  const response = await api.get(`/analytics/top-referrers/${websiteId}?days=${days}`);
  return response.data;
};

// Top Countries
export const getTopCountries = async (websiteId: string, days: number = 7): Promise<GetTopCountriesResponse> => {
  if (websiteId === 'demo') {
    return getDemoData().topCountries as any;
  }
  const response = await api.get(`/analytics/top-countries/${websiteId}?days=${days}`);
  return response.data;
};

// Top Browsers
export const getTopBrowsers = async (websiteId: string, days: number = 7): Promise<GetTopBrowsersResponse> => {
  if (websiteId === 'demo') {
    return getDemoData().topBrowsers as any;
  }
  const response = await api.get(`/analytics/top-browsers/${websiteId}?days=${days}`);
  return response.data;
};

// Top Devices
export const getTopDevices = async (websiteId: string, days: number = 7): Promise<GetTopDevicesResponse> => {
  if (websiteId === 'demo') {
    return getDemoData().topDevices as any;
  }
  const response = await api.get(`/analytics/top-devices/${websiteId}?days=${days}`);
  return response.data;
};

// Top OS
export const getTopOS = async (websiteId: string, days: number = 7): Promise<GetTopOSResponse> => {
  if (websiteId === 'demo') {
    return getDemoData().topOS as any;
  }
  const response = await api.get(`/analytics/top-os/${websiteId}?days=${days}`);
  return response.data;
};

// Traffic Summary
export const getTrafficSummary = async (websiteId: string, days: number = 7): Promise<TrafficSummary> => {
  if (websiteId === 'demo') {
    // Return a simplified version for demo
    const demo = getDemoData();
    return {
      website_id: 'demo',
      date_range: days.toString(),
      total_page_views: demo.dashboardData.page_views,
      unique_visitors: demo.dashboardData.unique_visitors,
      total_sessions: Math.floor(demo.dashboardData.page_views / 1.5),
      bounce_rate: demo.dashboardData.bounce_rate,
      avg_session_time: demo.dashboardData.session_duration,
      pages_per_session: 1.5,
      growth_rate: 12.5,
      visitors_growth_rate: 10.2,
      sessions_growth_rate: 8.5,
      new_visitors: Math.floor(demo.dashboardData.unique_visitors * 0.7),
      returning_visitors: Math.floor(demo.dashboardData.unique_visitors * 0.3),
      engagement_score: 75,
      retention_rate: 45,
      top_traffic_sources: demo.customEvents.utm_performance.sources.map(s => ({
        source: s.source,
        visitors: s.unique_visitors,
        page_views: s.visits,
        bounce_rate: 35 + Math.random() * 10
      })),
      utm_performance: {
        sources: {},
        mediums: {},
        campaigns: {},
        terms: {},
        content: {}
      }
    };
  }
  const response = await api.get(`/analytics/traffic-summary/${websiteId}?days=${days}`);
  const data = response.data;

  // Backend returns { website_id, date_range, summary }
  // Frontend expects the data directly with website_id and date_range included
  if (data.summary) {
    return {
      website_id: data.website_id,
      date_range: data.date_range,
      ...data.summary,
    };
  }

  return data;
};

// Traffic Summary Chart - NEW: Specifically for charts with accurate pageview counts


// Hourly Stats
export const getHourlyStats = async (websiteId: string, days: number = 7): Promise<GetHourlyStatsResponse> => {
  if (websiteId === 'demo') {
    return getDemoData().hourlyStats as any;
  }
  const response = await api.get(`/analytics/hourly-stats/${websiteId}?days=${days}`);

  // Convert UTC timestamps to local time
  if (response.data.hourly_stats) {
    response.data.hourly_stats = response.data.hourly_stats.map((stat: any) => {
      const utcTime = new Date(stat.timestamp);
      const localHour = utcTime.getHours();
      const localMinute = utcTime.getMinutes();

      return {
        ...stat,
        hour: localHour,
        hour_label: `${localHour.toString().padStart(2, '0')}:${localMinute.toString().padStart(2, '0')}`,
        timestamp: utcTime.toISOString()
      };
    });
  }

  return response.data;
};

// Activity Trends
export const getActivityTrends = async (websiteId: string): Promise<GetActivityTrendsResponse> => {
  const response = await api.get(`/analytics/activity-trends/${websiteId}`);
  return response.data;
};

// Daily Stats
export const getDailyStats = async (websiteId: string, days: number = 30): Promise<GetDailyStatsResponse> => {
  if (websiteId === 'demo') {
    return getDemoData().dailyStats as any;
  }
  const response = await api.get(`/analytics/daily-stats/${websiteId}?days=${days}`);
  return response.data;
};

// Custom Events Stats
export const getCustomEventsStats = async (websiteId: string, days: number = 7): Promise<any> => {
  if (websiteId === 'demo') {
    return getDemoData().customEvents as any;
  }
  // Call backend via gateway to get custom events + UTM performance
  const response = await api.get(`/analytics/custom-events/${websiteId}?days=${days}`);
  return response.data;
}

// Anomaly detection - REMOVED: Backend doesn't support this endpoint for MVP
// export const detectAnomalies = async (websiteId: string, days: number = 14, metric: string = 'page_views'): Promise<AnomalyResult> => {
//   const response = await api.post(`/api/v1/analytics/anomalies`, { website_id: websiteId, days, metric });
//   return response.data;
// };

// User Retention
export const getUserRetention = async (websiteId: string, days: number = 7): Promise<RetentionData> => {
  if (websiteId === 'demo') {
    return getDemoData().retentionData as any;
  }
  const response = await api.get(`/analytics/user-retention/${websiteId}?days=${days}`);
  const data = response.data;

  // Backend returns { website_id, date_range, retention }
  // Frontend expects the data directly with website_id and date_range included
  if (data.retention) {
    return {
      website_id: data.website_id,
      date_range: data.date_range,
      ...data.retention,
    };
  }

  return data;
};

// Visitor Insights
export const getVisitorInsights = async (websiteId: string, days: number = 7): Promise<GetVisitorInsightsResponse> => {
  if (websiteId === 'demo') {
    return getDemoData().visitorInsights as any;
  }
  const response = await api.get(`/analytics/visitor-insights/${websiteId}?days=${days}`);
  return response.data;
};

// =============================================================================
// REACT QUERY HOOKS
// =============================================================================

// Query Keys
export const analyticsKeys = {
  all: ['analytics'] as const,
  dashboard: (websiteId: string, days: number) => [...analyticsKeys.all, 'dashboard', websiteId, days] as const,

  // anomalies: (websiteId: string, days: number, metric: string) => [...analyticsKeys.all, 'anomalies', websiteId, days, metric] as const, // REMOVED: Backend doesn't support this endpoint for MVP
  topPages: (websiteId: string, days: number) => [...analyticsKeys.all, 'top-pages', websiteId, days] as const,
  topReferrers: (websiteId: string, days: number) => [...analyticsKeys.all, 'top-referrers', websiteId, days] as const,
  topCountries: (websiteId: string, days: number) => [...analyticsKeys.all, 'top-countries', websiteId, days] as const,
  topBrowsers: (websiteId: string, days: number) => [...analyticsKeys.all, 'top-browsers', websiteId, days] as const,
  topDevices: (websiteId: string, days: number) => [...analyticsKeys.all, 'top-devices', websiteId, days] as const,
  topOS: (websiteId: string, days: number) => [...analyticsKeys.all, 'top-os', websiteId, days] as const,
  trafficSummary: (websiteId: string, days: number) => [...analyticsKeys.all, 'traffic-summary', websiteId, days] as const,
  hourlyStats: (websiteId: string, days: number) => [...analyticsKeys.all, 'hourly-stats', websiteId, days] as const,
  activityTrends: (websiteId: string) => [...analyticsKeys.all, 'activity-trends', websiteId] as const,
  dailyStats: (websiteId: string, days: number) => [...analyticsKeys.all, 'daily-stats', websiteId, days] as const,
  customEvents: (websiteId: string, days: number) => [...analyticsKeys.all, 'custom-events', websiteId, days] as const,
  userRetention: (websiteId: string, days: number) => [...analyticsKeys.all, 'user-retention', websiteId, days] as const,
  visitorInsights: (websiteId: string, days: number) => [...analyticsKeys.all, 'visitor-insights', websiteId, days] as const,
};

// Dashboard Hook
export const useDashboardData = (websiteId: string, days: number = 7) => {
  return useQuery<DashboardData>({
    queryKey: analyticsKeys.dashboard(websiteId, days),
    queryFn: () => getDashboardData(websiteId, days),
    enabled: !!websiteId,
    staleTime: 0, // Force refresh immediately to see backend changes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
};



// Top Pages Hook
export const useTopPages = (websiteId: string, days: number = 7) => {
  return useQuery<GetTopPagesResponse>({
    queryKey: analyticsKeys.topPages(websiteId, days),
    queryFn: () => getTopPages(websiteId, days),
    enabled: !!websiteId,
    staleTime: 5 * 60 * 1000,
  });
};

// Top Referrers Hook
export const useTopReferrers = (websiteId: string, days: number = 7) => {
  return useQuery<GetTopReferrersResponse>({
    queryKey: analyticsKeys.topReferrers(websiteId, days),
    queryFn: () => getTopReferrers(websiteId, days),
    enabled: !!websiteId,
    staleTime: 5 * 60 * 1000,
  });
};

// Top Countries Hook
export const useTopCountries = (websiteId: string, days: number = 7) => {
  return useQuery<GetTopCountriesResponse>({
    queryKey: analyticsKeys.topCountries(websiteId, days),
    queryFn: () => getTopCountries(websiteId, days),
    enabled: !!websiteId,
    staleTime: 5 * 60 * 1000,
  });
};

// Top Browsers Hook
export const useTopBrowsers = (websiteId: string, days: number = 7) => {
  return useQuery<GetTopBrowsersResponse>({
    queryKey: analyticsKeys.topBrowsers(websiteId, days),
    queryFn: () => getTopBrowsers(websiteId, days),
    enabled: !!websiteId,
    staleTime: 5 * 60 * 1000,
  });
};

// Top Devices Hook
export const useTopDevices = (websiteId: string, days: number = 7) => {
  return useQuery<GetTopDevicesResponse>({
    queryKey: analyticsKeys.topDevices(websiteId, days),
    queryFn: () => getTopDevices(websiteId, days),
    enabled: !!websiteId,
    staleTime: 5 * 60 * 1000,
  });
};

// Top OS Hook
export const useTopOS = (websiteId: string, days: number = 7) => {
  return useQuery<GetTopOSResponse>({
    queryKey: analyticsKeys.topOS(websiteId, days),
    queryFn: () => getTopOS(websiteId, days),
    enabled: !!websiteId,
    staleTime: 5 * 60 * 1000,
  });
};

// Traffic Summary Hook
export const useTrafficSummary = (websiteId: string, days: number = 7) => {
  return useQuery<TrafficSummary>({
    queryKey: analyticsKeys.trafficSummary(websiteId, days),
    queryFn: () => getTrafficSummary(websiteId, days),
    enabled: !!websiteId,
    staleTime: 5 * 60 * 1000,
  });
};



// Hourly Stats Hook
export const useHourlyStats = (websiteId: string, days: number = 1) => {
  return useQuery<GetHourlyStatsResponse>({
    queryKey: analyticsKeys.hourlyStats(websiteId, days),
    queryFn: () => getHourlyStats(websiteId, days),
    enabled: !!websiteId,
    staleTime: 5 * 60 * 1000,
  });
};

// Activity Trends Hook
export const useActivityTrends = (websiteId: string) => {
  return useQuery<GetActivityTrendsResponse>({
    queryKey: analyticsKeys.activityTrends(websiteId),
    queryFn: () => getActivityTrends(websiteId),
    enabled: !!websiteId,
    staleTime: 2 * 60 * 1000, // 2 minutes for real-time trends
    refetchInterval: 2 * 60 * 1000, // Refresh every 2 minutes
  });
};

// Daily Stats Hook
export const useDailyStats = (websiteId: string, days: number = 30) => {
  return useQuery<GetDailyStatsResponse>({
    queryKey: analyticsKeys.dailyStats(websiteId, days),
    queryFn: () => getDailyStats(websiteId, days),
    enabled: !!websiteId,
    staleTime: 10 * 60 * 1000, // 10 minutes for daily stats
  });
};

// Custom Events Hook
export const useCustomEvents = (websiteId: string, days: number = 30) => {
  return useQuery({
    queryKey: ['customEvents', websiteId, days],
    queryFn: () => {
      return getCustomEventsStats(websiteId, days);
    },
    enabled: !!websiteId,
    staleTime: 0, // Force refresh immediately to see backend changes
    gcTime: 10 * 60 * 1000,   // 10 minutes
  });
};

// Anomaly detection hook - REMOVED: Backend doesn't support this endpoint for MVP
// export const useAnomalies = (websiteId: string, days: number = 14, metric: string = 'page_views') => {
//   return useQuery<AnomalyResult>({
//     queryKey: analyticsKeys.anomalies(websiteId, days, metric),
//     queryFn: () => detectAnomalies(websiteId, days, metric),
//     enabled: !!websiteId,
//     staleTime: 5 * 60 * 1000,
//     refetchInterval: 5 * 60 * 1000,
//   });
// };

// User Retention Hook
export const useUserRetention = (websiteId: string, days: number = 30) => {
  return useQuery<RetentionData>({
    queryKey: analyticsKeys.userRetention(websiteId, days),
    queryFn: () => getUserRetention(websiteId, days),
    enabled: !!websiteId,
    staleTime: 30 * 60 * 1000, // 30 minutes for retention data
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
// MUTATION HOOKS
// =============================================================================

// Track Event Mutation
export const useTrackEvent = () => {
  const queryClient = useQueryClient();

  return useMutation<TrackEventResponse, Error, EventData>({
    mutationFn: trackEvent,
    onSuccess: (data, variables) => {


      // Optionally invalidate dashboard data as well
      queryClient.invalidateQueries({
        queryKey: [...analyticsKeys.all, 'dashboard', variables.website_id],
      });
    },
  });
};

// Track Batch Events Mutation
export const useTrackBatchEvents = () => {
  const queryClient = useQueryClient();

  return useMutation<BatchEventResponse, Error, BatchEventRequest>({
    mutationFn: trackBatchEvents,
    onSuccess: (data, variables) => {
      // Get website_id from first event
      const websiteId = variables.events[0]?.website_id;
      if (websiteId) {

        queryClient.invalidateQueries({
          queryKey: [...analyticsKeys.all, 'dashboard', websiteId],
        });
      }
    },
  });
};

// =============================================================================
// UTILITY HOOKS
// =============================================================================

// Hook to invalidate all analytics data for a website
export const useInvalidateAnalytics = () => {
  const queryClient = useQueryClient();

  return (websiteId: string) => {
    queryClient.invalidateQueries({
      queryKey: [...analyticsKeys.all],
      predicate: (query) => {
        const queryKey = query.queryKey as string[];
        return queryKey.includes(websiteId);
      },
    });
  };
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

// Helper function to format growth rate with color indication
export const formatGrowthRate = (rate: number): { value: string; isPositive: boolean; isNeutral: boolean } => {
  const isPositive = rate > 0;
  const isNeutral = rate === 0;
  const formattedRate = Math.abs(rate).toFixed(1);

  return {
    value: `${isPositive ? '+' : isNeutral ? '' : '-'}${formattedRate}%`,
    isPositive,
    isNeutral
  };
};


// Chart color mapping for Recharts-based ChartContainer
export const trafficChartConfig: ChartConfig = {
  pageviews: {
    label: 'Pageviews',
    color: 'hsl(var(--chart-1))',
  },
};

// =============================================================================
// EXPORT DEFAULT
// =============================================================================

export default {
  // API functions
  trackEvent,
  trackBatchEvents,
  getDashboardData,

  getTopPages,
  getTopReferrers,
  getTopCountries,
  getTopBrowsers,
  getTopDevices,
  getTrafficSummary,

  getHourlyStats,
  getDailyStats,
  getCustomEventsStats,
  // detectAnomalies, // REMOVED: Backend doesn't support this endpoint for MVP
  getUserRetention,
  getVisitorInsights,

  // Hooks
  useDashboardData,

  useTopPages,
  useTopReferrers,
  useTopCountries,
  useTopBrowsers,
  useTopDevices,
  useTrafficSummary,

  useHourlyStats,
  useDailyStats,
  useCustomEvents,
  // useAnomalies, // REMOVED: Backend doesn't support this endpoint for MVP
  useUserRetention,
  useVisitorInsights,
  useTrackEvent,
  useTrackBatchEvents,
  useInvalidateAnalytics,

  // Query Keys
  analyticsKeys,

  // Helper functions
  formatNumber,
  formatDuration,
  formatPercentage,
  formatGrowthRate,
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

// Get detailed funnel analytics with step-by-step data
export async function getDetailedFunnelAnalytics(funnelId: string, dateRange: number = 7): Promise<any> {
  try {
    const response = await api.get(`/funnels/${funnelId}/analytics/detailed`, {
      params: { days: dateRange }
    });
    return response.data;
  } catch (error) {
    throw error;
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

// Advanced Analytics Hooks
export const useDetailedFunnelAnalytics = (funnelId: string, dateRange: number = 7) => {
  return useQuery({
    queryKey: [...analyticsKeys.all, 'detailed-funnel-analytics', funnelId, dateRange],
    queryFn: () => getDetailedFunnelAnalytics(funnelId, dateRange),
    enabled: !!funnelId,
    staleTime: 2 * 60 * 1000,
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
  const response = await api.get(`/analytics/geolocation-breakdown/${websiteId}?days=${days}`);
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