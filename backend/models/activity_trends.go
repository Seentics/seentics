package models

import "time"

// ActivityTrend represents activity metrics over time
type ActivityTrendItem struct {
	Timestamp  time.Time `json:"timestamp" db:"timestamp"`
	Visitors   int       `json:"visitors" db:"visitors"`
	PageViews  int       `json:"page_views" db:"page_views"`
	Events     int       `json:"events" db:"events"`
	Sessions   int       `json:"sessions" db:"sessions"`
	Engagement float64   `json:"engagement" db:"engagement"`
	Label      string    `json:"label" db:"label"`
}

type ActivityTrendsResponse struct {
	WebsiteID string              `json:"website_id"`
	Trends    []ActivityTrendItem `json:"trends"`
}
