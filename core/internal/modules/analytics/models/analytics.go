package models

import "time"

// ACTUALLY USED MODELS BASED ON REPOSITORY ANALYSIS

// TrafficSummary - USED in traffic_summary_analytics.go
type TrafficSummary struct {
	TotalPageViews     int     `json:"total_page_views" db:"total_page_views"`
	TotalVisitors      int     `json:"total_visitors" db:"total_visitors"`
	UniqueVisitors     int     `json:"unique_visitors" db:"unique_visitors"`
	TotalSessions      int     `json:"total_sessions" db:"total_sessions"`
	BounceRate         float64 `json:"bounce_rate" db:"bounce_rate"`
	AvgSessionTime     float64 `json:"avg_session_time" db:"avg_session_time"`
	PagesPerSession    float64 `json:"pages_per_session" db:"pages_per_session"`
	GrowthRate         float64 `json:"growth_rate" db:"growth_rate"`
	VisitorsGrowthRate float64 `json:"visitors_growth_rate" db:"visitors_growth_rate"`
	SessionsGrowthRate float64 `json:"sessions_growth_rate" db:"sessions_growth_rate"`
	NewVisitors        int     `json:"new_visitors" db:"new_visitors"`
	ReturningVisitors  int     `json:"returning_visitors" db:"returning_visitors"`
	EngagementScore    float64 `json:"engagement_score" db:"engagement_score"`
	RetentionRate      float64 `json:"retention_rate" db:"retention_rate"`
}

// DashboardMetrics - USED in dashboard_analytics.go
type DashboardMetrics struct {
	PageViews       int     `json:"page_views" db:"page_views"`
	TotalVisitors   int     `json:"total_visitors" db:"total_visitors"`
	UniqueVisitors  int     `json:"unique_visitors" db:"unique_visitors"`
	Sessions        int     `json:"sessions" db:"sessions"`
	BounceRate      float64 `json:"bounce_rate" db:"bounce_rate"`
	AvgSessionTime  float64 `json:"avg_session_time" db:"avg_session_time"`
	PagesPerSession float64 `json:"pages_per_session" db:"pages_per_session"`
}

// ComparisonMetrics - USED in dashboard_analytics.go
type ComparisonMetrics struct {
	CurrentPeriod      DashboardMetrics `json:"current_period"`
	PreviousPeriod     DashboardMetrics `json:"previous_period"`
	TotalVisitorChange *float64         `json:"total_visitor_change"`
	VisitorChange      *float64         `json:"visitor_change"`
	PageviewChange     *float64         `json:"pageview_change"`
	SessionChange      *float64         `json:"session_change"`
	BounceChange       *float64         `json:"bounce_change"`
	DurationChange     *float64         `json:"duration_change"`
}

// PageStat - USED in top_pages_analytics.go
type PageStat struct {
	Page       string   `json:"page" db:"page"`
	Views      int      `json:"views" db:"views"`
	Unique     int      `json:"unique" db:"unique"`
	BounceRate *float64 `json:"bounce_rate" db:"bounce_rate"`
	AvgTime    *float64 `json:"avg_time" db:"avg_time"`
	EntryRate  *float64 `json:"entry_rate" db:"entry_rate"`
	ExitRate   *float64 `json:"exit_rate" db:"exit_rate"`
}

// ReferrerStat - USED in top_referrers_analytics.go
type ReferrerStat struct {
	Referrer   string   `json:"referrer" db:"referrer"`
	Views      int      `json:"views" db:"views"`
	Unique     int      `json:"unique" db:"unique"`
	BounceRate *float64 `json:"bounce_rate" db:"bounce_rate"`
}

// SourceStat - USED in top_sources_analytics.go
type SourceStat struct {
	Source         string   `json:"source" db:"source"`
	Views          int      `json:"views" db:"views"`
	UniqueVisitors int      `json:"unique_visitors" db:"unique_visitors"`
	BounceRate     *float64 `json:"bounce_rate" db:"bounce_rate"`
}

// CountryStat - USED in top_countries_analytics.go
type CountryStat struct {
	Country    string   `json:"country" db:"country"`
	Views      int      `json:"views" db:"views"`
	Unique     int      `json:"unique" db:"unique"`
	Visitors   int      `json:"visitors" db:"visitors"`
	BounceRate *float64 `json:"bounce_rate" db:"bounce_rate"`
}

// BrowserStat - USED in top_browsers_analytics.go
type BrowserStat struct {
	Browser    string   `json:"browser" db:"browser"`
	Views      int      `json:"views" db:"views"`
	Unique     int      `json:"unique" db:"unique"`
	Visitors   int      `json:"visitors" db:"visitors"`
	BounceRate *float64 `json:"bounce_rate" db:"bounce_rate"`
}

// DeviceStat - USED in top_devices_analytics.go
type DeviceStat struct {
	Device     string   `json:"device" db:"device"`
	Views      int      `json:"views" db:"views"`
	Unique     int      `json:"unique" db:"unique"`
	Visitors   int      `json:"visitors" db:"visitors"`
	BounceRate *float64 `json:"bounce_rate" db:"bounce_rate"`
}

// OSStat - USED in top_os_analytics.go
type OSStat struct {
	OS         string   `json:"os" db:"os"`
	Views      int      `json:"views" db:"views"`
	Unique     int      `json:"unique" db:"unique"`
	Visitors   int      `json:"visitors" db:"visitors"`
	BounceRate *float64 `json:"bounce_rate" db:"bounce_rate"`
}

// DailyStat - USED in time_series_analytics.go
type DailyStat struct {
	Date   string `json:"date" db:"date"`
	Views  int    `json:"views" db:"views"`
	Unique int    `json:"unique" db:"unique"`
}

// HourlyStat - USED in time_series_analytics.go
type HourlyStat struct {
	Hour      string    `json:"hour" db:"hour"`
	Views     int       `json:"views" db:"views"`
	Unique    int       `json:"unique" db:"unique"`
	Timestamp time.Time `json:"timestamp" db:"timestamp"`
	HourLabel string    `json:"hour_label" db:"hour_label"`
}

// CustomEventStat - USED in custom_events_analytics.go
type CustomEventStat struct {
	EventType        string     `json:"event_type" db:"event_type"`
	Count            int        `json:"count" db:"count"`
	SampleProperties Properties `json:"sample_properties" db:"sample_properties"`
	SampleEvent      Properties `json:"sample_event" db:"sample_event"`
	CommonProperties Properties `json:"common_properties" db:"common_properties"`
}

// EventItem represents a single custom event metric
type EventItem struct {
	EventType        string     `json:"event_type" db:"event_type"`
	Count            int        `json:"count" db:"count"`
	SampleProperties Properties `json:"sample_properties,omitempty" db:"sample_properties"`
}

// TopItem - USED in top_continents_analytics.go
type TopItem struct {
	Name       string  `json:"name" db:"name"`
	Code       string  `json:"code,omitempty" db:"code"`
	Count      int     `json:"count" db:"count"`
	Percentage float64 `json:"percentage" db:"percentage"`
}

// GeolocationBreakdown - USED in top_continents_analytics.go
type GeolocationBreakdown struct {
	Countries  []TopItem `json:"countries"`
	Continents []TopItem `json:"continents"`
	Regions    []TopItem `json:"regions"`
	Cities     []TopItem `json:"cities"`
}

// DashboardData - USED in analytics_service.go
type DashboardData struct {
	WebsiteID         string               `json:"website_id"`
	DateRange         int                  `json:"date_range"`
	TotalVisitors     int                  `json:"total_visitors"`
	UniqueVisitors    int                  `json:"unique_visitors"`
	LiveVisitors      int                  `json:"live_visitors"`
	PageViews         int                  `json:"page_views"`
	SessionDuration   float64              `json:"session_duration"`
	BounceRate        float64              `json:"bounce_rate"`
	NewVisitors       int                  `json:"new_visitors"`
	ReturningVisitors int                  `json:"returning_visitors"`
	Comparison        *ComparisonMetrics   `json:"comparison"`
	Metrics           *DashboardMetrics    `json:"metrics"`
	TopPages          []PageStat           `json:"top_pages"`
	TopSources        []SourceStat         `json:"top_sources"`
	TopCountries      []CountryStat        `json:"top_countries"`
	TopResolutions    []TopItem            `json:"top_resolutions"`
	Geolocation       GeolocationBreakdown `json:"geolocation"`
}

// LEGACY MODELS - Keep these for compatibility but they might not be actively used

// SessionAnalytics represents session-based analytics data
type SessionAnalytics struct {
	TotalSessions      int     `json:"total_sessions" db:"total_sessions"`
	AvgPagesPerSession int     `json:"avg_pages_per_session" db:"avg_pages_per_session"`
	AvgSessionDuration float64 `json:"avg_session_duration" db:"avg_session_duration"`
	SinglePageSessions int     `json:"single_page_sessions" db:"single_page_sessions"`
	AvgUniquePages     int     `json:"avg_unique_pages" db:"avg_unique_pages"`
	ExitIntentSessions int     `json:"exit_intent_sessions" db:"exit_intent_sessions"`
	AvgScrollDepth     int     `json:"avg_scroll_depth" db:"avg_scroll_depth"`
}

// TimeBucketStat represents time-bucketed statistics
type TimeBucketStat struct {
	TimePeriod     time.Time `json:"time_period" db:"time_period"`
	PageViews      int       `json:"page_views" db:"page_views"`
	UniqueVisitors int       `json:"unique_visitors" db:"unique_visitors"`
	Sessions       int       `json:"sessions" db:"sessions"`
	BounceRate     float64   `json:"bounce_rate" db:"bounce_rate"`
}

// AggregatedMetric represents pre-computed metrics from continuous aggregates
type AggregatedMetric struct {
	WebsiteID      string    `json:"website_id" db:"website_id"`
	TimePeriod     time.Time `json:"time_period" db:"time_period"`
	PageViews      int       `json:"page_views" db:"page_views"`
	UniqueVisitors int       `json:"unique_visitors" db:"unique_visitors"`
	Sessions       int       `json:"sessions" db:"sessions"`
	AvgTimeOnPage  float64   `json:"avg_time_on_page" db:"avg_time_on_page"`
	DirectVisits   int       `json:"direct_visits" db:"direct_visits"`
	UTMVisits      int       `json:"utm_visits" db:"utm_visits"`
	CustomEvents   int       `json:"custom_events" db:"custom_events"`
	NewVisitors    int       `json:"new_visitors" db:"new_visitors"`
	BotVisits      int       `json:"bot_visits" db:"bot_visits"`
}

// PerformanceMetric represents website performance analytics
type PerformanceMetric struct {
	Page            string   `json:"page" db:"page"`
	AvgLoadTime     *float64 `json:"avg_load_time" db:"avg_load_time"`
	AvgScrollDepth  *float64 `json:"avg_scroll_depth" db:"avg_scroll_depth"`
	EngagementScore *float64 `json:"engagement_score" db:"engagement_score"`
	BounceRate      *float64 `json:"bounce_rate" db:"bounce_rate"`
	ExitRate        *float64 `json:"exit_rate" db:"exit_rate"`
	Views           int      `json:"views" db:"views"`
	UniqueViews     int      `json:"unique_views" db:"unique_views"`
}

// RealtimeMetric represents real-time analytics data
type RealtimeMetric struct {
	WebsiteID          string    `json:"website_id" db:"website_id"`
	Timestamp          time.Time `json:"timestamp" db:"timestamp"`
	ActiveUsers        int       `json:"active_users" db:"active_users"`
	PageViewsPerMinute int       `json:"page_views_per_minute" db:"page_views_per_minute"`
	CurrentSessions    int       `json:"current_sessions" db:"current_sessions"`
	TopPageLastHour    string    `json:"top_page_last_hour" db:"top_page_last_hour"`
	AvgTimeOnPageNow   float64   `json:"avg_time_on_page_now" db:"avg_time_on_page_now"`
}

// GeographicStat represents geographic analytics with enhanced metrics
type GeographicStat struct {
	Country        string   `json:"country" db:"country"`
	City           string   `json:"city" db:"city"`
	Views          int      `json:"views" db:"views"`
	UniqueVisitors int      `json:"unique_visitors" db:"unique_visitors"`
	Sessions       int      `json:"sessions" db:"sessions"`
	BounceRate     *float64 `json:"bounce_rate" db:"bounce_rate"`
	AvgSessionTime *float64 `json:"avg_session_time" db:"avg_session_time"`
	ConversionRate *float64 `json:"conversion_rate" db:"conversion_rate"`
	RevenuePerUser *float64 `json:"revenue_per_user" db:"revenue_per_user"`
}

// TechnologyStat represents technology-based analytics (browser, OS, device)
type TechnologyStat struct {
	Technology     string   `json:"technology" db:"technology"`
	Type           string   `json:"type" db:"type"` // 'browser', 'os', 'device'
	Views          int      `json:"views" db:"views"`
	UniqueVisitors int      `json:"unique_visitors" db:"unique_visitors"`
	Sessions       int      `json:"sessions" db:"sessions"`
	BounceRate     *float64 `json:"bounce_rate" db:"bounce_rate"`
	AvgSessionTime *float64 `json:"avg_session_time" db:"avg_session_time"`
	ConversionRate *float64 `json:"conversion_rate" db:"conversion_rate"`
	MarketShare    *float64 `json:"market_share" db:"market_share"`
}

// UTMAnalytics represents UTM campaign performance analytics
type UTMAnalytics struct {
	UTMSource       string   `json:"utm_source" db:"utm_source"`
	UTMMedium       string   `json:"utm_medium" db:"utm_medium"`
	UTMCampaign     string   `json:"utm_campaign" db:"utm_campaign"`
	UTMTerm         string   `json:"utm_term" db:"utm_term"`
	UTMContent      string   `json:"utm_content" db:"utm_content"`
	Views           int      `json:"views" db:"views"`
	UniqueVisitors  int      `json:"unique_visitors" db:"unique_visitors"`
	Sessions        int      `json:"sessions" db:"sessions"`
	Conversions     int      `json:"conversions" db:"conversions"`
	ConversionRate  *float64 `json:"conversion_rate" db:"conversion_rate"`
	Revenue         *float64 `json:"revenue" db:"revenue"`
	CostPerClick    *float64 `json:"cost_per_click" db:"cost_per_click"`
	ReturnOnAdSpend *float64 `json:"return_on_ad_spend" db:"return_on_ad_spend"`
}

// EventTypeStat represents custom event analytics
type EventTypeStat struct {
	EventType      string     `json:"event_type" db:"event_type"`
	Count          int        `json:"count" db:"count"`
	UniqueUsers    int        `json:"unique_users" db:"unique_users"`
	Sessions       int        `json:"sessions" db:"sessions"`
	AvgValue       *float64   `json:"avg_value" db:"avg_value"`
	TotalValue     *float64   `json:"total_value" db:"total_value"`
	Properties     Properties `json:"properties" db:"properties"`
	FirstSeen      *time.Time `json:"first_seen" db:"first_seen"`
	LastSeen       *time.Time `json:"last_seen" db:"last_seen"`
	TrendDirection string     `json:"trend_direction" db:"trend_direction"` // 'up', 'down', 'stable'
}

// AnalyticsFilters - Advanced filtering options
type AnalyticsFilters struct {
	Country     string `json:"country"`
	Device      string `json:"device"`
	Browser     string `json:"browser"`
	OS          string `json:"os"`
	UTMSource   string `json:"utm_source"`
	UTMMedium   string `json:"utm_medium"`
	UTMCampaign string `json:"utm_campaign"`
	PagePath    string `json:"page_path"`
}

func (f *AnalyticsFilters) HasFilters() bool {
	return f.Country != "" || f.Device != "" || f.Browser != "" || f.OS != "" ||
		f.UTMSource != "" || f.UTMMedium != "" || f.UTMCampaign != "" || f.PagePath != ""
}

// ExportRequest - Request for data export
type ExportRequest struct {
	WebsiteID string `json:"website_id"`
	Days      int    `json:"days"`
	Format    string `json:"format"` // "json" or "csv"
}

// ImportRequest - Request for data import
type ImportRequest struct {
	WebsiteID string `json:"website_id"`
	Source    string `json:"source"` // "ga4", "plausible", "umami", "fathom", "seentics"
	Data      []byte `json:"-"`
}
