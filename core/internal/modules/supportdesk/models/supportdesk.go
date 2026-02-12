package models

import (
	"encoding/json"
	"time"
)

type SupportForm struct {
	ID          string          `json:"id"`
	WebsiteID   string          `json:"website_id"`
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Fields      json.RawMessage `json:"fields"`
	IsActive    bool            `json:"is_active"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

type FormSubmission struct {
	ID        string          `json:"id"`
	FormID    string          `json:"form_id"`
	Data      json.RawMessage `json:"data"`
	IPAddress string          `json:"ip_address"`
	UserAgent string          `json:"user_agent"`
	CreatedAt time.Time       `json:"created_at"`
}

type ChatWidget struct {
	ID        string          `json:"id"`
	WebsiteID string          `json:"website_id"`
	Name      string          `json:"name"`
	Config    json.RawMessage `json:"config"`
	IsActive  bool            `json:"is_active"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

type Ticket struct {
	ID          string          `json:"id"`
	WebsiteID   string          `json:"website_id"`
	UserID      *string         `json:"user_id,omitempty"`
	Subject     string          `json:"subject"`
	Description string          `json:"description"`
	Status      string          `json:"status"`
	Priority    string          `json:"priority"`
	Source      string          `json:"source"`
	Metadata    json.RawMessage `json:"metadata"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

type TicketReply struct {
	ID        string    `json:"id"`
	TicketID  string    `json:"ticket_id"`
	UserID    *string   `json:"user_id,omitempty"`
	Message   string    `json:"message"`
	IsPrivate bool      `json:"is_private"`
	CreatedAt time.Time `json:"created_at"`
}
