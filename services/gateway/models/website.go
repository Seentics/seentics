package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"gorm.io/gorm"
)

type WebsiteSettings struct {
	AllowedOrigins     []string `json:"allowedOrigins"`
	TrackingEnabled    bool     `json:"trackingEnabled"`
	DataRetentionDays  int      `json:"dataRetentionDays"`
	UseIpAnonymization bool     `json:"useIpAnonymization"`
	RespectDoNotTrack  bool     `json:"respectDoNotTrack"`
	AllowRawDataExport bool     `json:"allowRawDataExport"`
}

// Value implements the driver.Valuer interface for JSON storage
func (s WebsiteSettings) Value() (driver.Value, error) {
	return json.Marshal(s)
}

// Scan implements the sql.Scanner interface for JSON storage
func (s *WebsiteSettings) Scan(value interface{}) error {
	if value == nil {
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}
	return json.Unmarshal(bytes, &s)
}

type Website struct {
	ID                uint            `gorm:"primaryKey" json:"id"`
	UserID            uint            `gorm:"index;not null" json:"user_id"`
	Name              string          `json:"name"`
	URL               string          `gorm:"not null" json:"url"`
	SiteID            string          `gorm:"uniqueIndex;not null" json:"site_id"` // Public identifier for tracking
	IsVerified        bool            `gorm:"default:false" json:"is_verified"`
	VerificationToken string          `json:"verification_token"`
	IsActive          bool            `gorm:"default:true" json:"is_active"`
	Settings          WebsiteSettings `gorm:"type:jsonb;default:'{}'" json:"settings"`
	CreatedAt         time.Time       `json:"created_at"`
	UpdatedAt         time.Time       `json:"updated_at"`
	DeletedAt         gorm.DeletedAt  `gorm:"index" json:"-"`
}
