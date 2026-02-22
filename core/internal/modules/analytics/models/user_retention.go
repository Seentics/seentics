package models

// RetentionData represents user retention cohorts
type RetentionData struct {
	WebsiteID     string  `json:"website_id"`
	DateRange     int     `json:"date_range"`
	TotalVisitors int     `json:"total_visitors"`
	Day1          float64 `json:"day_1" db:"day_1"`
	Day7          float64 `json:"day_7" db:"day_7"`
	Day30         float64 `json:"day_30" db:"day_30"`
}
