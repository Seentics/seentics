package models

// VisitorInsights represents visitor analytics including new vs returning
type VisitorInsights struct {
	WebsiteID                  string  `json:"website_id"`
	DateRange                  int     `json:"date_range"`
	NewVisitors                int     `json:"new_visitors" db:"new_visitors"`
	ReturningVisitors          int     `json:"returning_visitors" db:"returning_visitors"`
	AverageSessionDuration     float64 `json:"avg_session_duration" db:"avg_session_duration"`
	NewVisitorPercentage       float64 `json:"new_visitor_percentage"`
	ReturningVisitorPercentage float64 `json:"returning_visitor_percentage"`
}
