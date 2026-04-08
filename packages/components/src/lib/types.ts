// ─── Analytics ────────────────────────────────────────────────────────────────

export interface OverviewData {
  website_id:       string;
  date_range:       string;
  total_visitors:   number;
  unique_visitors:  number;
  live_visitors:    number;
  page_views:       number;
  session_duration: number;
  bounce_rate:      number;
  comparison?: {
    current_period?:  PeriodMetrics;
    previous_period?: PeriodMetrics;
  };
}

export interface PeriodMetrics {
  total_visitors:   number;
  unique_visitors:  number;
  page_views:       number;
  sessions:         number;
  bounce_rate:      number;
  avg_session_time: number;
}

export interface DailyStat {
  date:   string;
  views:  number;
  unique: number;
}

export interface TimeseriesData {
  website_id:  string;
  date_range:  string;
  daily_stats: DailyStat[];
}

export interface PageStat {
  page:             string;
  views:            number;
  unique:           number;
  bounce_rate?:     number;
  avg_time?:        number;
  exit_rate?:       number;
  engagement_rate?: number;
}

export interface TopPagesData {
  website_id: string;
  top_pages:  PageStat[];
}

export interface ReferrerStat {
  referrer:     string;
  views:        number;
  unique:       number;
  bounce_rate?: number;
}

export interface SourcesData {
  website_id:    string;
  top_referrers: ReferrerStat[];
}

export interface CustomEvent {
  event_type:       string;
  count:            number;
  unique_visitors:  number;
  engagement_rate:  number;
  sample_properties?: Record<string, unknown>;
}

export interface EventsData {
  website_id: string;
  events:     CustomEvent[];
}

export interface RealtimeData {
  live_visitors:   number;
  top_pages?:      Array<{ page: string; count: number }>;
  top_countries?:  Array<{ country: string; count: number }>;
}

// ─── Funnels ──────────────────────────────────────────────────────────────────

export interface FunnelStep {
  id:        string;
  name:      string;
  order:     number;
  step_type: 'page_view' | 'event';
  page_path?: string;
  event_type?: string;
}

export interface FunnelStepStat {
  step:         number;
  name:         string;
  entries:      number;
  completions:  number;
  drop_offs:    number;
  conversion:   number;
}

export interface FunnelStats {
  total_entries:   number;
  completions:     number;
  conversion_rate: number;
  step_breakdown:  FunnelStepStat[];
}

export interface Funnel {
  id:          string;
  website_id:  string;
  name:        string;
  description: string;
  is_active:   boolean;
  created_at:  string;
  steps?:      FunnelStep[];
  stats?:      FunnelStats;
}

// ─── Heatmaps ─────────────────────────────────────────────────────────────────

export interface HeatmapPageSummary {
  page_path:    string;
  click_count:  number;
  scroll_count: number;
  avg_scroll:   number;
  last_seen:    string;
}

export interface HeatmapPoint {
  x_percent:       number;
  y_percent:       number;
  intensity:       number;
  event_type:      string;
  target_selector: string;
}

export interface HeatmapData {
  page_path: string;
  points:    HeatmapPoint[];
}

// ─── Replays ──────────────────────────────────────────────────────────────────

export interface ReplaySession {
  sessionId:       string;
  browser:         string;
  device:          string;
  os:              string;
  country:         string;
  entryPage:       string;
  startedAt:       string;
  durationSeconds: number;
  pagesViewed:     number;
  hasRageClicks:   boolean;
}

export interface RRWebEvent {
  type:      number;
  timestamp: number;
  data:      Record<string, unknown>;
  delay?:    number;
}
