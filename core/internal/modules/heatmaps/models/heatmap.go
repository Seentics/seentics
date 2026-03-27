package models

import "time"

// HeatmapPoint represents a single interaction point on a page
type HeatmapPoint struct {
	PagePath       string
	EventType      string // "click" or "scroll"
	DeviceType     string
	XPercent       int
	YPercent       int
	Intensity      int
	TargetSelector string
}

// HeatmapData groups all points for a given page
type HeatmapData struct {
	PagePath string
	Points   []HeatmapPoint
}

// PageSummary is a lightweight summary of activity for a single page
type PageSummary struct {
	PagePath   string
	ClickCount int
	LastSeen   time.Time
}
