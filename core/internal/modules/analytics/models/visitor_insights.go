package models

// VisitorInsights represents visitor analytics including new vs returning
type VisitorInsights struct {
	WebsiteID                  string            `json:"-"`
	DateRange                  int               `json:"-"`
	NewVisitors                int               `json:"new_visitors" db:"new_visitors"`
	ReturningVisitors          int               `json:"returning_visitors" db:"returning_visitors"`
	AverageSessionDuration     float64           `json:"avg_session_duration" db:"avg_session_duration"`
	NewVisitorPercentage       float64           `json:"new_visitor_percentage"`
	ReturningVisitorPercentage float64           `json:"returning_visitor_percentage"`
	TopEntryPages              []PageInsightStat `json:"top_entry_pages"`
	TopExitPages               []PageInsightStat `json:"top_exit_pages"`
}

type PageInsightStat struct {
	Page       string   `json:"page"`
	Sessions   int      `json:"sessions"`
	BounceRate *float64 `json:"bounce_rate,omitempty"`
	ExitRate   *float64 `json:"exit_rate,omitempty"`
}
