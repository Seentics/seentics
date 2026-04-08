package models

import "time"

// ACTUALLY USED MODELS BASED ON REPOSITORY ANALYSIS

// TrafficSummary - USED in traffic_summary_analytics.go
type TrafficSummary struct {
	TotalPageViews int `json:"total_page_views" db:"total_page_views"`
	// TotalVisitors is distinct visitor_id in the range (same meaning as UniqueVisitors).
	TotalVisitors  int `json:"total_visitors" db:"total_visitors"`
	UniqueVisitors int `json:"unique_visitors" db:"unique_visitors"`
	TotalSessions  int `json:"total_sessions" db:"total_sessions"`
	BounceRate         float64 `json:"bounce_rate" db:"bounce_rate"`
	AvgSessionTime     float64 `json:"avg_session_time" db:"avg_session_time"`
	PagesPerSession    float64 `json:"pages_per_session" db:"pages_per_session"`
	GrowthRate         float64 `json:"growth_rate" db:"growth_rate"`
	VisitorsGrowthRate float64 `json:"visitors_growth_rate" db:"visitors_growth_rate"`
	SessionsGrowthRate float64 `json:"sessions_growth_rate" db:"sessions_growth_rate"`
	NewVisitors        int     `json:"new_visitors" db:"new_visitors"`
	ReturningVisitors  int     `json:"returning_visitors" db:"returning_visitors"`
	EngagementScore    float64 `json:"engagement_score" db:"engagement_score"`
}

// DashboardMetrics - USED in dashboard_analytics.go
type DashboardMetrics struct {
	PageViews int `json:"page_views" db:"page_views"`
	// TotalVisitors and UniqueVisitors both count distinct visitor_id over the date range.
	TotalVisitors  int     `json:"total_visitors" db:"total_visitors"`
	UniqueVisitors int     `json:"unique_visitors" db:"unique_visitors"`
	// Sessions is the number of distinct sessions (pageview groups) in the range.
	Sessions       int     `json:"sessions" db:"sessions"`
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
	UniqueVisitors   int        `json:"unique_visitors" db:"unique_visitors"`
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

// GoalStatItem is one configured website goal with optional conversion stats for the UI goals table.
type GoalStatItem struct {
	ID              string  `json:"id"`
	Name            string  `json:"name"`
	GoalType        string  `json:"goal_type"`
	Target          string  `json:"target"`
	Completions     int     `json:"completions"`
	ConversionRate  float64 `json:"conversion_rate"`
	UniqueVisitors  int     `json:"unique_visitors,omitempty"`
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
	Sessions          int                  `json:"sessions"`
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

// RecentActivity represents a single recent pageview event for the activity feed
type RecentActivity struct {
	Page      string `json:"page"`
	Country   string `json:"country"`
	Device    string `json:"device"`
	Browser   string `json:"browser"`
	Referrer  string `json:"referrer"`
	Timestamp string `json:"timestamp"`
}

// PageFlow represents a transition from one page to another within sessions
type PageFlow struct {
	FromPage string `json:"from_page"`
	ToPage   string `json:"to_page"`
	Count    int    `json:"count"`
}

// PathAnalysis aggregates page flow data for journey analysis
type PathAnalysis struct {
	TopEntryPages []TopItem  `json:"top_entry_pages"`
	TopExitPages  []TopItem  `json:"top_exit_pages"`
	PageFlows     []PageFlow `json:"page_flows"`
	AvgPathLength float64    `json:"avg_path_length"`
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
	PropKey     string `json:"prop_key"`
	PropValue   string `json:"prop_value"`
}

func (f *AnalyticsFilters) HasFilters() bool {
	return f.Country != "" || f.Device != "" || f.Browser != "" || f.OS != "" ||
		f.UTMSource != "" || f.UTMMedium != "" || f.UTMCampaign != "" || f.PagePath != "" ||
		(f.PropKey != "" && f.PropValue != "")
}

// RealtimeData contains all data for the real-time dashboard view
type RealtimeData struct {
	ActiveVisitors int                `json:"active_visitors"`
	PageViews      int                `json:"pageviews"`
	Sessions       int                `json:"sessions"`
	TopPages       []RealtimePage     `json:"top_pages"`
	TopReferrers   []RealtimeItem     `json:"top_referrers"`
	TopCountries   []RealtimeItem     `json:"top_countries"`
	TopDevices     []RealtimeItem     `json:"top_devices"`
	TopBrowsers    []RealtimeItem     `json:"top_browsers"`
	Timeline       []RealtimeMinute   `json:"timeline"`
}

type RealtimePage struct {
	Page     string `json:"page"`
	Visitors int    `json:"visitors"`
}

type RealtimeItem struct {
	Name     string `json:"name"`
	Visitors int    `json:"visitors"`
}

type RealtimeMinute struct {
	Minute   string `json:"minute"`
	Visitors int    `json:"visitors"`
	Views    int    `json:"views"`
}

