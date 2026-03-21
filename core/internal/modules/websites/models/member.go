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

// WebsiteInvitation represents a pending invitation to join a website team.
type WebsiteInvitation struct {
	ID        uuid.UUID  `json:"id" db:"id"`
	WebsiteID uuid.UUID  `json:"websiteId" db:"website_id"`
	Email     string     `json:"email" db:"email"`
	Role      string     `json:"role" db:"role"`
	Token     string     `json:"token" db:"token"`
	InvitedBy uuid.UUID  `json:"invitedBy" db:"invited_by"`
	ExpiresAt time.Time  `json:"expiresAt" db:"expires_at"`
	AcceptedAt *time.Time `json:"acceptedAt,omitempty" db:"accepted_at"`
	CreatedAt time.Time  `json:"createdAt" db:"created_at"`

	// Join fields
	WebsiteName    string `json:"websiteName,omitempty"`
	InviterName    string `json:"inviterName,omitempty"`
}

type AcceptInviteRequest struct {
	Token string `json:"token" binding:"required"`
}
