package models

import (
	"time"
)

type Funnel struct {
	ID          string       `json:"id" db:"id"`
	Name        string       `json:"name" db:"name"`
	WebsiteID   string       `json:"websiteId" db:"website_id"`
	Description string       `json:"description" db:"description"`
	Steps       []FunnelStep `json:"steps" db:"steps"`
	IsActive    bool         `json:"isActive" db:"is_active"`
	Stats       FunnelStats  `json:"stats" db:"-"`
	CreatedAt   time.Time    `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time    `json:"updatedAt" db:"updated_at"`
}

type FunnelStep struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Order     int    `json:"order"`
	EventType string `json:"eventType"`
	PagePath  string `json:"pagePath,omitempty"`
}

type FunnelStats struct {
	TotalEntries int     `json:"totalEntries"`
	Completions  int     `json:"completions"`
	Conversion   float64 `json:"conversion"`
}
