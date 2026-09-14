/** Domain types for the analytics feature. */

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

export type UseRecentActivityOptions = {
  /** Max rows returned (default 20). */
  limit?: number;
  /** When set, restricts rows to this rolling window (server `within_minutes`). */
  withinMinutes?: number;
  refetchIntervalMs?: number;
  staleTimeMs?: number;
};

// Realtime Geo Data
export interface RealtimeGeoVisitor {
  name: string;
  code?: string;
  count: number;
  percentage: number;
}

export interface RealtimeGeoResponse {
  website_id: string;
  date_range: string;
  visitors: RealtimeGeoVisitor[];
}

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
    /** ISO3166-1 alpha-2 for flag */
    code?: string;
  }>;
}

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
