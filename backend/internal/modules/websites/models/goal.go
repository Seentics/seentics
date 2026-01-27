package models

import (
	"time"

	"github.com/google/uuid"
)

type Goal struct {
	ID         uuid.UUID `json:"id" db:"id"`
	WebsiteID  uuid.UUID `json:"websiteId" db:"website_id"`
	Name       string    `json:"name" db:"name"`
	Type       string    `json:"type" db:"type"`             // 'event', 'pageview'
	Identifier string    `json:"identifier" db:"identifier"` // event name or page path
	CreatedAt  time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt  time.Time `json:"updatedAt" db:"updated_at"`
}

type CreateGoalRequest struct {
	Name       string `json:"name" binding:"required"`
	Type       string `json:"type" binding:"required,oneof=event pageview"`
	Identifier string `json:"identifier" binding:"required"`
}
