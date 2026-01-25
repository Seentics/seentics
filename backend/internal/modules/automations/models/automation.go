package models

import (
	"time"
)

type Automation struct {
	ID          string                 `json:"id" db:"id"`
	Name        string                 `json:"name" db:"name"`
	WebsiteID   string                 `json:"websiteId" db:"website_id"`
	Description string                 `json:"description" db:"description"`
	Trigger     string                 `json:"trigger" db:"trigger"`
	Config      map[string]interface{} `json:"config" db:"config"`
	IsActive    bool                   `json:"isActive" db:"is_active"`
	Stats       AutomationStats        `json:"stats" db:"-"`
	CreatedAt   time.Time              `json:"createdAt" db:"created_at"`
	UpdatedAt   time.Time              `json:"updatedAt" db:"updated_at"`
}

type AutomationStats struct {
	Triggers int `json:"triggers"`
	Actions  int `json:"actions"`
}
