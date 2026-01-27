package models

import (
	"time"

	"github.com/google/uuid"
)

type WebsiteMember struct {
	ID        uuid.UUID `json:"id" db:"id"`
	WebsiteID uuid.UUID `json:"websiteId" db:"website_id"`
	UserID    uuid.UUID `json:"userId" db:"user_id"`
	Role      string    `json:"role" db:"role"` // 'owner', 'admin', 'viewer'
	CreatedAt time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt time.Time `json:"updatedAt" db:"updated_at"`

	// Join fields
	UserName  string `json:"userName,omitempty" db:"user_name"`
	UserEmail string `json:"userEmail,omitempty" db:"user_email"`
}

type InviteMemberRequest struct {
	Email string `json:"email" binding:"required,email"`
	Role  string `json:"role" binding:"required,oneof=admin viewer"`
}

type UpdateMemberRoleRequest struct {
	Role string `json:"role" binding:"required,oneof=admin viewer"`
}
