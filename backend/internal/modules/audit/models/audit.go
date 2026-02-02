package models

import "time"

type AuditLog struct {
	ID           string    `json:"id" db:"id"`
	UserID       string    `json:"user_id" db:"user_id"`
	WebsiteID    *string   `json:"website_id" db:"website_id"`
	Action       string    `json:"action" db:"action"`
	ResourceType string    `json:"resource_type" db:"resource_type"`
	ResourceID   string    `json:"resource_id" db:"resource_id"`
	Metadata     any       `json:"metadata" db:"metadata"`
	IPAddress    string    `json:"ip_address" db:"ip_address"`
	UserAgent    string    `json:"user_agent" db:"user_agent"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}

type CreateAuditLogRequest struct {
	UserID       string  `json:"user_id"`
	WebsiteID    *string `json:"website_id"`
	Action       string  `json:"action"`
	ResourceType string  `json:"resource_type"`
	ResourceID   string  `json:"resource_id"`
	Metadata     any     `json:"metadata"`
	IPAddress    string  `json:"ip_address"`
	UserAgent    string  `json:"user_agent"`
}
