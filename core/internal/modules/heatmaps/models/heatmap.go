package models

import "time"

// HeatmapPoint represents a single interaction point on a page
type HeatmapPoint struct {
	PagePath       string `json:"page_path"`
	EventType      string `json:"event_type"` // "click" or "scroll"
	DeviceType     string `json:"device_type"`
	XPercent       int    `json:"x_percent"`  // click: 0–10000 (nx*10000); nx = pageX/docScrollWidth; scroll: 0
	YPercent       int    `json:"y_percent"`  // click: pageY/docScrollHeight; scroll: depth%*100 (e.g. 2500 = 25%)
	Intensity      int    `json:"intensity"`
	TargetSelector string `json:"target_selector"`
}

// HeatmapData groups all points for a given page
type HeatmapData struct {
	PagePath string         `json:"page_path"`
	Points   []HeatmapPoint `json:"points"`
}

// PageSummary is a lightweight summary of activity for a single page
type PageSummary struct {
	PagePath    string    `json:"page_path"`
	ClickCount  int       `json:"click_count"`
	ScrollCount int       `json:"scroll_count"`
	AvgScroll   int       `json:"avg_scroll"` // average scroll depth as a percentage (0-100)
	LastSeen    time.Time `json:"last_seen"`
}
