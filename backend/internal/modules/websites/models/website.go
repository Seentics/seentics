package models

import (
	"time"

	"github.com/google/uuid"
)

// Website represents a registered website in the tracking system
type Website struct {
	ID                     uuid.UUID `json:"id" db:"id"`
	SiteID                 string    `json:"site_id" db:"site_id"`
	UserID                 uuid.UUID `json:"user_id" db:"user_id"`
	Name                   string    `json:"name" db:"name"`
	URL                    string    `json:"url" db:"url"`
	TrackingID             string    `json:"tracking_id" db:"tracking_id"`
	IsActive               bool      `json:"is_active" db:"is_active"`
	IsVerified             bool      `json:"is_verified" db:"is_verified"`
	AutomationEnabled      bool      `json:"automation_enabled" db:"automation_enabled"`
	FunnelEnabled          bool      `json:"funnel_enabled" db:"funnel_enabled"`
	HeatmapEnabled         bool      `json:"heatmap_enabled" db:"heatmap_enabled"`
	HeatmapIncludePatterns *string   `json:"heatmap_include_patterns" db:"heatmap_include_patterns"`
	HeatmapExcludePatterns *string   `json:"heatmap_exclude_patterns" db:"heatmap_exclude_patterns"`
	ReplayEnabled          bool      `json:"replay_enabled" db:"replay_enabled"`
	ReplaySamplingRate     float64   `json:"replay_sampling_rate" db:"replay_sampling_rate"`
	ReplayIncludePatterns  *string   `json:"replay_include_patterns" db:"replay_include_patterns"`
	ReplayExcludePatterns  *string   `json:"replay_exclude_patterns" db:"replay_exclude_patterns"`
	VerificationToken      string    `json:"verification_token" db:"verification_token"`
	CreatedAt              time.Time `json:"created_at" db:"created_at"`
	UpdatedAt              time.Time `json:"updated_at" db:"updated_at"`
}

// CreateWebsiteRequest defines the payload for creating a new website
type CreateWebsiteRequest struct {
	Name string `json:"name" binding:"required"`
	URL  string `json:"url" binding:"required"`
}

// UpdateWebsiteRequest defines the payload for updating an existing website
type UpdateWebsiteRequest struct {
	Name                   *string  `json:"name"`
	URL                    *string  `json:"url"`
	IsActive               *bool    `json:"is_active"`
	AutomationEnabled      *bool    `json:"automation_enabled"`
	FunnelEnabled          *bool    `json:"funnel_enabled"`
	HeatmapEnabled         *bool    `json:"heatmap_enabled"`
	HeatmapIncludePatterns *string  `json:"heatmap_include_patterns"`
	HeatmapExcludePatterns *string  `json:"heatmap_exclude_patterns"`
	ReplayEnabled          *bool    `json:"replay_enabled"`
	ReplaySamplingRate     *float64 `json:"replay_sampling_rate"`
	ReplayIncludePatterns  *string  `json:"replay_include_patterns"`
	ReplayExcludePatterns  *string  `json:"replay_exclude_patterns"`
}
