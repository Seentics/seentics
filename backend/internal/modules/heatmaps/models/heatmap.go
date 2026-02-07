package models

import "time"

type HeatmapPoint struct {
	WebsiteID string    `json:"website_id" db:"website_id"`
	URL       string    `json:"url" db:"url"`
	Type      string    `json:"type" db:"type"` // 'click' or 'move'
	XPercent  int       `json:"x_percent" db:"x_percent"`
	YPercent  int       `json:"y_percent" db:"y_percent"`
	Intensity int       `json:"intensity" db:"intensity"`
	LastSeen  time.Time `json:"last_seen" db:"last_seen"`
}

type HeatmapRecordRequest struct {
	WebsiteID string         `json:"website_id"`
	Points    []HeatmapPoint `json:"points"`
}
