package models

import (
	"encoding/json"
	"time"
)

// Automation represents a configured automation rule
type Automation struct {
	ID            string              `json:"id"`
	WebsiteID     string              `json:"website_id"`
	UserID        string              `json:"user_id"`
	Name          string              `json:"name"`
	Description   string              `json:"description"`
	TriggerType   string              `json:"trigger_type"`
	TriggerConfig json.RawMessage     `json:"trigger_config"`
	IsActive      bool                `json:"is_active"`
	CreatedAt     time.Time           `json:"created_at"`
	UpdatedAt     time.Time           `json:"updated_at"`

	// Relations
	Actions []AutomationAction `json:"actions,omitempty"`
}

// AutomationAction represents a single action within an automation
type AutomationAction struct {
	ID           string          `json:"id"`
	AutomationID string          `json:"automation_id"`
	ActionType   string          `json:"action_type"`
	ActionConfig json.RawMessage `json:"action_config"`
	OrderIndex   int             `json:"order_index"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

// AutomationExecution records a single run of an automation
type AutomationExecution struct {
	ID            string          `json:"id"`
	AutomationID  string          `json:"automation_id"`
	WebsiteID     string          `json:"website_id"`
	VisitorID     string          `json:"visitor_id"`
	SessionID     string          `json:"session_id"`
	Status        string          `json:"status"`
	ExecutionData json.RawMessage `json:"execution_data,omitempty"`
	ErrorMessage  string          `json:"error_message,omitempty"`
	ExecutedAt    time.Time       `json:"executed_at"`
	CompletedAt   *time.Time      `json:"completed_at,omitempty"`
}

// CreateAutomationRequest is the payload for creating a new automation
type CreateAutomationRequest struct {
	Name          string              `json:"name" binding:"required"`
	Description   string              `json:"description"`
	TriggerType   string              `json:"trigger_type" binding:"required"`
	TriggerConfig json.RawMessage     `json:"trigger_config"`
	IsActive      *bool               `json:"is_active"`
	Actions       []AutomationAction  `json:"actions"`
}

// UpdateRequest carries the fields that may be updated on an automation
type UpdateRequest struct {
	Name          *string             `json:"name"`
	Description   *string             `json:"description"`
	TriggerType   *string             `json:"trigger_type"`
	TriggerConfig json.RawMessage     `json:"trigger_config"`
	IsActive      *bool               `json:"is_active"`
	Actions       *[]AutomationAction `json:"actions"`
}
