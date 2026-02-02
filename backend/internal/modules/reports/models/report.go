package models

import (
	"time"
)

type SavedReport struct {
	ID        string                 `json:"id" db:"id"`
	WebsiteID string                 `json:"website_id" db:"website_id"`
	UserID    string                 `json:"user_id" db:"user_id"`
	Name      string                 `json:"name" db:"name"`
	Filters   map[string]interface{} `json:"filters" db:"filters"`
	CreatedAt time.Time              `json:"created_at" db:"created_at"`
	UpdatedAt time.Time              `json:"updated_at" db:"updated_at"`
}

type CreateReportRequest struct {
	Name    string                 `json:"name" binding:"required"`
	Filters map[string]interface{} `json:"filters" binding:"required"`
}
