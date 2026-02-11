package models

import (
	"encoding/json"
	"time"
)

type HeatmapPoint struct {
	WebsiteID  string    `json:"website_id" db:"website_id"`
	URL        string    `json:"url" db:"page_path"`           // Frontend uses "url", DB uses "page_path"
	Type       string    `json:"type" db:"event_type"`         // Frontend uses "type", DB uses "event_type"
	DeviceType string    `json:"device_type" db:"device_type"` // 'desktop', 'tablet', 'mobile'
	XPercent   int       `json:"x_percent" db:"x_percent"`     // X coordinate (0-1000 range)
	YPercent   int       `json:"y_percent" db:"y_percent"`     // Y coordinate (0-1000 range)
	Selector   string    `json:"selector" db:"target_selector"`
	X          int       `json:"x" db:"x"` // Alias for frontend compatibility
	Y          int       `json:"y" db:"y"` // Alias for frontend compatibility
	Intensity  int       `json:"intensity" db:"intensity"`
	LastSeen   time.Time `json:"last_seen" db:"last_updated"` // DB uses "last_updated"
}

// UnmarshalJSON handles both "x"/"y" and "x_percent"/"y_percent" from frontend
func (p *HeatmapPoint) UnmarshalJSON(data []byte) error {
	type Alias HeatmapPoint
	aux := &struct {
		*Alias
	}{
		Alias: (*Alias)(p),
	}

	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}

	// If frontend sends "x" and "y", map to XPercent and YPercent
	if p.XPercent == 0 && p.X != 0 {
		p.XPercent = p.X
	}
	if p.YPercent == 0 && p.Y != 0 {
		p.YPercent = p.Y
	}

	return nil
}

type HeatmapRecordRequest struct {
	WebsiteID string         `json:"website_id"`
	Points    []HeatmapPoint `json:"points"`
}

type HeatmapPageStat struct {
	URL       string `json:"url"`
	Views     int    `json:"views"`
	Clicks    int    `json:"clicks"`
	AvgScroll int    `json:"avg_scroll"`
	Active    bool   `json:"active"`
}

type HeatmapPagesResponse struct {
	Pages []HeatmapPageStat `json:"pages"`
}
