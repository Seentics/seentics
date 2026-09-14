/**
 * Endpoint functions for the analytics feature. No React, no hooks — just transport.
 *
 * Raw URLs live here and nowhere else, so a query, a prefetch, a test and a script
 * share one definition of each endpoint.
 */
import api from '@/lib/api';
import { isDemo, demoAnalyticsData, demoRealtimeData, demoCustomEvents, demoGeolocation } from '@/lib/demo';
import { getUserTimezone } from './format';
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

/** Server dashboard payload; shared by useDashboardData and other callers (e.g. revenue fallback). */
export const getDashboardData = async (
  websiteId: string,
  days: number = 7,
  filters: AnalyticsFilters = {},
) => {
  if (isDemo(websiteId)) {
    return demoAnalyticsData().dashboardData;
  }
  const params = new URLSearchParams({ days: days.toString(), timezone: getUserTimezone() });
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value);
  });
  const response = await api.get(`/analytics/dashboard/${websiteId}?${params.toString()}`);
  return response.data;
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

// All six dimension breakdowns in a single request
export const getDimensionsBulk = async (websiteId: string, days: number = 7, filters: AnalyticsFilters = {}): Promise<{
  website_id: string;
  date_range: string;
  top_pages:     { page: string; views: number; unique: number }[];
  top_referrers: { referrer: string; views: number; unique: number }[];
  top_countries: { country: string; views: number; unique: number }[];
  top_browsers:  { browser: string; views: number; unique: number }[];
  top_devices:   { device: string; views: number; unique: number }[];
  top_os:        { os: string; views: number; unique: number }[];
}> => {
  if (isDemo(websiteId)) {
    const d = demoAnalyticsData();
    return {
      website_id: websiteId,
      date_range: `${days}d`,
      top_pages:     (d.topPages as any)?.top_pages     ?? [],
      top_referrers: (d.topReferrers as any)?.top_referrers ?? [],
      top_countries: (d.topCountries as any)?.top_countries ?? [],
      top_browsers:  (d.topBrowsers as any)?.top_browsers  ?? [],
      top_devices:   (d.topDevices as any)?.top_devices   ?? [],
      top_os:        (d.topOS as any)?.top_os         ?? [],
    };
  }
  const params = new URLSearchParams({ days: days.toString(), timezone: getUserTimezone() });
  Object.entries(filters).forEach(([key, value]) => { if (value) params.append(key, value); });
  const response = await api.get(`/analytics/dimensions-bulk/${websiteId}?${params.toString()}`);
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

export const getRealtimeData = async (websiteId: string): Promise<RealtimeData> => {
  if (isDemo(websiteId)) {
    return demoRealtimeData() as RealtimeData;
  }
  const response = await api.get(`/analytics/realtime/${websiteId}?timezone=${getUserTimezone()}`);
  return response.data;
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

// Top Cities
export const getTopCities = async (websiteId: string, days: number = 7): Promise<any> => {
  if (isDemo(websiteId)) {
    return demoAnalyticsData().topCities;
  }
  const response = await api.get(`/analytics/top-cities/${websiteId}?days=${days}&timezone=${getUserTimezone()}`);
  return response.data;
};

// Hourly Stats
export const getHourlyStats = async (websiteId: string, days: number = 7, filters: AnalyticsFilters = {}): Promise<GetHourlyStatsResponse> => {
  if (isDemo(websiteId)) {
    return demoAnalyticsData().hourlyStats as any;
  }
  const params = new URLSearchParams({ days: days.toString(), timezone: getUserTimezone() });
  Object.entries(filters).forEach(([key, value]) => { if (value) params.append(key, value); });
  const response = await api.get(`/analytics/hourly-stats/${websiteId}?${params.toString()}`);

  // Backend returns hour as a number (0–23). Build a full 24-hour scaffold so
  // the chart always renders every hour on the x-axis, even hours with no traffic.
  if (response.data.hourly_stats) {
    const byHour = new Map<number, any>();
    for (const stat of response.data.hourly_stats) {
      const h = typeof stat.hour === 'number' ? stat.hour : parseInt(stat.hour, 10);
      byHour.set(h, { ...stat, hour: h, hour_label: `${String(h).padStart(2, '0')}:00` });
    }
    response.data.hourly_stats = Array.from({ length: 24 }, (_, h) =>
      byHour.get(h) ?? { hour: h, hour_label: `${String(h).padStart(2, '0')}:00`, views: 0, unique: 0 }
    );
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

// Visitor Insights
export const getVisitorInsights = async (websiteId: string, days: number = 7): Promise<GetVisitorInsightsResponse> => {
  if (isDemo(websiteId)) {
    return demoAnalyticsData().visitorInsights as any;
  }
  const response = await api.get(`/analytics/visitor-insights/${websiteId}?days=${days}&timezone=${getUserTimezone()}`);
  return response.data;
};

export const getRealtimeGeoData = async (websiteId: string, withinMinutes = 30): Promise<RealtimeGeoResponse> => {
  if (isDemo(websiteId)) {
    return {
      website_id: websiteId,
      date_range: '30m',
      visitors: [
        { name: 'United States', code: 'US', count: 142, percentage: 28.4 },
        { name: 'United Kingdom', code: 'GB', count: 87,  percentage: 17.4 },
        { name: 'Germany',        code: 'DE', count: 65,  percentage: 13.0 },
        { name: 'India',          code: 'IN', count: 58,  percentage: 11.6 },
        { name: 'France',         code: 'FR', count: 43,  percentage: 8.6  },
        { name: 'Canada',         code: 'CA', count: 38,  percentage: 7.6  },
        { name: 'Australia',      code: 'AU', count: 32,  percentage: 6.4  },
        { name: 'Japan',          code: 'JP', count: 19,  percentage: 3.8  },
        { name: 'Brazil',         code: 'BR', count: 15,  percentage: 3.0  },
        { name: 'Netherlands',    code: 'NL', count: 1,   percentage: 0.2  },
      ],
    };
  }
  const params = new URLSearchParams({ within_minutes: String(withinMinutes) });
  const response = await api.get(`/analytics/realtime-geo/${websiteId}?${params.toString()}`);
  return response.data;
};

// API Functions
export const getGeolocationBreakdown = async (websiteId: string, days: number = 7): Promise<GeolocationData> => {
  if (isDemo(websiteId)) {
    return demoGeolocation();
  }
  const response = await api.get(`/analytics/geolocation-breakdown/${websiteId}?days=${days}&timezone=${getUserTimezone()}`);
  return response.data;
};
