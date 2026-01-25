package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
)

type Event struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	WebsiteID   string     `json:"website_id" db:"website_id"`
	VisitorID   string     `json:"visitor_id" db:"visitor_id"`
	SessionID   string     `json:"session_id" db:"session_id"`
	EventType   string     `json:"event_type" db:"event_type"`
	Page        string     `json:"page" db:"page"`
	Referrer    *string    `json:"referrer,omitempty" db:"referrer"`
	UserAgent   *string    `json:"user_agent,omitempty" db:"user_agent"`
	IPAddress   *string    `json:"ip_address,omitempty" db:"ip_address"`
	Country     *string    `json:"country,omitempty" db:"country"`
	CountryCode *string    `json:"country_code,omitempty" db:"country_code"`
	City        *string    `json:"city,omitempty" db:"city"`
	Continent   *string    `json:"continent,omitempty" db:"continent"`
	Region      *string    `json:"region,omitempty" db:"region"`
	Browser     *string    `json:"browser,omitempty" db:"browser"`
	Device      *string    `json:"device,omitempty" db:"device"`
	OS          *string    `json:"os,omitempty" db:"os"`
	UTMSource   *string    `json:"utm_source,omitempty" db:"utm_source"`
	UTMMedium   *string    `json:"utm_medium,omitempty" db:"utm_medium"`
	UTMCampaign *string    `json:"utm_campaign,omitempty" db:"utm_campaign"`
	UTMTerm     *string    `json:"utm_term,omitempty" db:"utm_term"`
	UTMContent  *string    `json:"utm_content,omitempty" db:"utm_content"`
	TimeOnPage  *int       `json:"time_on_page,omitempty" db:"time_on_page"`
	Properties  Properties `json:"properties,omitempty" db:"properties"`
	Timestamp   time.Time  `json:"timestamp" db:"timestamp"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
}

// Properties is a custom type for JSONB handling
type Properties map[string]interface{}

func (p Properties) Value() (driver.Value, error) {
	if p == nil {
		return nil, nil
	}
	return json.Marshal(p)
}

func (p *Properties) Scan(value interface{}) error {
	if value == nil {
		*p = nil
		return nil
	}

	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("failed to unmarshal JSONB value")
	}

	return json.Unmarshal(bytes, p)
}

type BatchEventRequest struct {
	SiteID string  `json:"siteId"`
	Domain string  `json:"domain"`
	Events []Event `json:"events"`
}

type EventResponse struct {
	Status    string `json:"status"`
	EventID   string `json:"event_id"`
	VisitorID string `json:"visitor_id"`
	SessionID string `json:"session_id"`
}

type BatchEventResponse struct {
	Status      string `json:"status"`
	EventsCount int    `json:"events_count"`
	ProcessedAt int64  `json:"processed_at"`
}
