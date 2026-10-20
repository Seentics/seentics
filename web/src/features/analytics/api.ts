/**
 * Endpoint functions for the analytics feature. No React, no hooks — just transport.
 *
 * Raw URLs live here and nowhere else, so a query, a prefetch, a test and a script
 * share one definition of each endpoint.
 */
import api from '@/lib/api';
import { isDemo, demoAnalyticsData, demoCustomEvents, demoGeolocation } from '@/lib/demo';
import { getUserTimezone } from './format';
import { rangeParams, toRangeSpec, type AnalyticsRange } from './range';

import type { AnalyticsFilters, GeolocationData, GetDailyStatsResponse, GetHourlyStatsResponse, GetTopBrowsersResponse, GetTopCountriesResponse, GetTopDevicesResponse, GetTopOSResponse, GetTopPagesResponse, GetTopReferrersResponse, GetVisitorInsightsResponse } from './types';

/**
 * The query string of a windowed read: its range (`days`, or `from`/`to` — see ./range), the
 * viewer's timezone, any extra fixed parameters, then the filters that are set.
 */
function readQuery(range: AnalyticsRange, filters: AnalyticsFilters = {}, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({ ...rangeParams(range), timezone: getUserTimezone(), ...extra });
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value);
  });
  return params.toString();
}

/** Server dashboard payload; shared by useDashboardData and other callers (e.g. revenue fallback). */
export const getDashboardData = async (
  websiteId: string,
  range: AnalyticsRange = 7,
  filters: AnalyticsFilters = {},
) => {
  if (isDemo(websiteId)) {
    return demoAnalyticsData().dashboardData;
  }
  const response = await api.get(`/analytics/dashboard/${websiteId}?${readQuery(range, filters, { live: '0' })}`);
  return response.data;
};

// Top Pages
export const getTopPages = async (websiteId: string, range: AnalyticsRange = 7, filters: AnalyticsFilters = {}): Promise<GetTopPagesResponse> => {
  if (isDemo(websiteId)) {
    return demoAnalyticsData().topPages as any;
  }
  const response = await api.get(`/analytics/top-pages/${websiteId}?${readQuery(range, filters)}`);
  return response.data;
};

// Top Referrers
export const getTopReferrers = async (websiteId: string, range: AnalyticsRange = 7, filters: AnalyticsFilters = {}): Promise<GetTopReferrersResponse> => {
  if (isDemo(websiteId)) {
    return demoAnalyticsData().topReferrers as any;
  }
  const response = await api.get(`/analytics/top-referrers/${websiteId}?${readQuery(range, filters)}`);
  return response.data;
};

// Top Countries
export const getTopCountries = async (websiteId: string, range: AnalyticsRange = 7, filters: AnalyticsFilters = {}): Promise<GetTopCountriesResponse> => {
  if (isDemo(websiteId)) {
    return demoAnalyticsData().topCountries as any;
  }
  const response = await api.get(`/analytics/top-countries/${websiteId}?${readQuery(range, filters)}`);
  return response.data;
};

// Top Browsers
export const getTopBrowsers = async (websiteId: string, range: AnalyticsRange = 7, filters: AnalyticsFilters = {}): Promise<GetTopBrowsersResponse> => {
  if (isDemo(websiteId)) {
    return demoAnalyticsData().topBrowsers as any;
  }
  const response = await api.get(`/analytics/top-browsers/${websiteId}?${readQuery(range, filters)}`);
  return response.data;
};

// Top Devices
export const getTopDevices = async (websiteId: string, range: AnalyticsRange = 7, filters: AnalyticsFilters = {}): Promise<GetTopDevicesResponse> => {
  if (isDemo(websiteId)) {
    return demoAnalyticsData().topDevices as any;
  }
  const response = await api.get(`/analytics/top-devices/${websiteId}?${readQuery(range, filters)}`);
  return response.data;
};

// Top OS
export const getTopOS = async (websiteId: string, range: AnalyticsRange = 7, filters: AnalyticsFilters = {}): Promise<GetTopOSResponse> => {
  if (isDemo(websiteId)) {
    return demoAnalyticsData().topOS as any;
  }
  const response = await api.get(`/analytics/top-os/${websiteId}?${readQuery(range, filters)}`);
  return response.data;
};

// All six dimension breakdowns in a single request
export const getDimensionsBulk = async (websiteId: string, range: AnalyticsRange = 7, filters: AnalyticsFilters = {}): Promise<{
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
      date_range: `${toRangeSpec(range).days}d`,
      top_pages:     (d.topPages as any)?.top_pages     ?? [],
      top_referrers: (d.topReferrers as any)?.top_referrers ?? [],
      top_countries: (d.topCountries as any)?.top_countries ?? [],
      top_browsers:  (d.topBrowsers as any)?.top_browsers  ?? [],
      top_devices:   (d.topDevices as any)?.top_devices   ?? [],
      top_os:        (d.topOS as any)?.top_os         ?? [],
    };
  }
  const response = await api.get(`/analytics/dimensions-bulk/${websiteId}?${readQuery(range, filters)}`);
  return response.data;
};

// Top Resolutions
export const getTopResolutions = async (websiteId: string, range: AnalyticsRange = 7, limit: number = 10): Promise<any> => {
  if (isDemo(websiteId)) {
    return demoAnalyticsData().topResolutions;
  }
  const response = await api.get(`/analytics/top-resolutions/${websiteId}?${readQuery(range, {}, { limit: String(limit) })}`);
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
export const getTopLanguages = async (websiteId: string, range: AnalyticsRange = 7): Promise<any> => {
  if (isDemo(websiteId)) {
    return demoAnalyticsData().topLanguages;
  }
  const response = await api.get(`/analytics/top-languages/${websiteId}?${readQuery(range)}`);
  return response.data;
};

// Top Cities
export const getTopCities = async (websiteId: string, range: AnalyticsRange = 7): Promise<any> => {
  if (isDemo(websiteId)) {
    return demoAnalyticsData().topCities;
  }
  const response = await api.get(`/analytics/top-cities/${websiteId}?${readQuery(range)}`);
  return response.data;
};

// Hourly Stats
export const getHourlyStats = async (websiteId: string, range: AnalyticsRange = 7, filters: AnalyticsFilters = {}): Promise<GetHourlyStatsResponse> => {
  if (isDemo(websiteId)) {
    return demoAnalyticsData().hourlyStats as any;
  }
  const response = await api.get(`/analytics/hourly-stats/${websiteId}?${readQuery(range, filters)}`);

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
export const getDailyStats = async (websiteId: string, range: AnalyticsRange = 30, filters: AnalyticsFilters = {}): Promise<GetDailyStatsResponse> => {
  if (isDemo(websiteId)) {
    return demoAnalyticsData().dailyStats as any;
  }
  const response = await api.get(`/analytics/daily-stats/${websiteId}?${readQuery(range, filters)}`);
  return response.data;
};

// Custom Events Stats (and the UTM breakdowns)
export const getCustomEventsStats = async (websiteId: string, range: AnalyticsRange = 7, filters: AnalyticsFilters = {}): Promise<any> => {
  if (isDemo(websiteId)) {
    return demoCustomEvents() as any;
  }
  // Call backend via gateway to get custom events + UTM performance
  const response = await api.get(`/analytics/custom-events/${websiteId}?${readQuery(range, filters)}`);
  return response.data;
}

// Visitor Insights
export const getVisitorInsights = async (websiteId: string, range: AnalyticsRange = 7, filters: AnalyticsFilters = {}): Promise<GetVisitorInsightsResponse> => {
  if (isDemo(websiteId)) {
    return demoAnalyticsData().visitorInsights as any;
  }
  const response = await api.get(`/analytics/visitor-insights/${websiteId}?${readQuery(range, filters)}`);
  return response.data;
};

// Geolocation
export const getGeolocationBreakdown = async (websiteId: string, range: AnalyticsRange = 7, filters: AnalyticsFilters = {}): Promise<GeolocationData> => {
  if (isDemo(websiteId)) {
    return demoGeolocation();
  }
  const response = await api.get(`/analytics/geolocation-breakdown/${websiteId}?${readQuery(range, filters)}`);
  return response.data;
};

// Goals
export const getGoalStats = async (websiteId: string, range: AnalyticsRange = 30, filters: AnalyticsFilters = {}): Promise<any> => {
  if (isDemo(websiteId)) {
    return demoAnalyticsData().goalStats;
  }
  const response = await api.get(`/analytics/goals-stats/${websiteId}?${readQuery(range, filters)}`);
  return response.data;
};
