package models

import (
	"time"

	"github.com/lib/pq"
	"gorm.io/gorm"
)

type User struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	Name           string         `json:"name"`
	Email          string         `gorm:"uniqueIndex;not null" json:"email"`
	Password       string         `gorm:"not null" json:"-"`
	Role           string         `gorm:"default:'user'" json:"role"`     // admin, user
	Plan           string         `gorm:"default:'free'" json:"plan"`     // free, standard, pro, enterprise
	Permissions    pq.StringArray `gorm:"type:text[]" json:"permissions"` // e.g. ["manage_websites", "view_analytics"]
	Status         string         `gorm:"default:'active'" json:"status"`
	CustomerID     string         `json:"customer_id,omitempty"`     // Lemon Squeezy Customer ID
	SubscriptionID string         `json:"subscription_id,omitempty"` // Lemon Squeezy Subscription ID
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`

	Websites []Website `gorm:"foreignKey:UserID" json:"websites,omitempty"`
}

type Subscription struct {
	ID        uint       `gorm:"primaryKey" json:"id"`
	UserID    uint       `gorm:"index;not null" json:"user_id"`
	LemonID   string     `gorm:"uniqueIndex" json:"lemon_id"` // Lemon Squeezy ID
	Plan      string     `json:"plan"`                        // free, standard, pro, enterprise
	Status    string     `json:"status"`                      // active, trialing, past_due, canceled
	RenewsAt  time.Time  `json:"renews_at"`
	EndsAt    *time.Time `json:"ends_at"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}
