package models

import (
	"time"
)

// Funnel represents a user conversion journey
type Funnel struct {
	ID          string    `json:"id" db:"id"`
	WebsiteID   string    `json:"websiteId" db:"website_id"`
	UserID      string    `json:"userId" db:"user_id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	IsActive    bool      `json:"isActive" db:"is_active"`
	CreatedAt   time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time `json:"updatedAt" db:"updated_at"`

	// Relations
	Steps []FunnelStep `json:"steps" db:"-"`
	Stats *FunnelStats `json:"stats,omitempty" db:"-"`
}

// FunnelStep represents a single milestone in a funnel
type FunnelStep struct {
	ID        string `json:"id" db:"id"`
	FunnelID  string `json:"funnelId" db:"funnel_id"`
	Name      string `json:"name" db:"name"`
	Order     int    `json:"order" db:"step_order"`
	StepType  string `json:"stepType" db:"step_type"` // 'page_view', 'event'
	PagePath  string `json:"pagePath,omitempty" db:"page_path"`
	EventType string `json:"eventType,omitempty" db:"event_type"`
	MatchType string `json:"matchType" db:"match_type"` // 'exact', 'contains', etc.
}

// FunnelStats represents aggregated performance data for a funnel
type FunnelStats struct {
	TotalEntries   int         `json:"totalEntries"`
	Completions    int         `json:"completions"`
	ConversionRate float64     `json:"conversionRate"`
	StepBreakdown  []StepStats `json:"stepBreakdown"`
}

// StepStats represents analytics for a specific step
type StepStats struct {
	StepOrder      int     `json:"stepOrder"`
	StepName       string  `json:"stepName"`
	Count          int     `json:"count"`
	DropoffCount   int     `json:"dropoffCount"`
	DropoffRate    float64 `json:"dropoffRate"`
	ConversionRate float64 `json:"conversionRate"` // conversion from previous step
}

// CreateFunnelRequest represents the payload for creating a funnel
type CreateFunnelRequest struct {
	Name        string       `json:"name" binding:"required"`
	Description string       `json:"description"`
	Steps       []FunnelStep `json:"steps" binding:"required,min=2"`
}

// UpdateFunnelRequest represents updates to a funnel
type UpdateFunnelRequest struct {
	Name        *string       `json:"name"`
	Description *string       `json:"description"`
	IsActive    *bool         `json:"isActive"`
	Steps       *[]FunnelStep `json:"steps"`
}

// TrackFunnelEventRequest represents the payload from the frontend tracker
type TrackFunnelEventRequest struct {
	FunnelID       string    `json:"funnel_id" binding:"required"`
	WebsiteID      string    `json:"website_id" binding:"required"`
	VisitorID      string    `json:"visitor_id" binding:"required"`
	SessionID      string    `json:"session_id" binding:"required"`
	CurrentStep    int       `json:"current_step"`
	CompletedSteps []int     `json:"completed_steps"`
	StartedAt      time.Time `json:"started_at"`
	Converted      bool      `json:"converted"`
	EventType      string    `json:"event_type"` // 'progress', 'conversion', 'dropoff'
	StepName       string    `json:"step_name"`
	Timestamp      time.Time `json:"timestamp"`
}

// BatchFunnelEventRequest represents a batch of funnel events
type BatchFunnelEventRequest struct {
	WebsiteID string                    `json:"website_id" binding:"required"`
	Events    []TrackFunnelEventRequest `json:"events" binding:"required"`
}
