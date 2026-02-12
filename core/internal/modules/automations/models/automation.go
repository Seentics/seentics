package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// JSONB is a custom type for PostgreSQL JSONB fields
type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	return json.Marshal(j)
}

func (j *JSONB) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}

	var bytes []byte
	switch v := value.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	default:
		return fmt.Errorf("unsupported type for JSONB: %T", value)
	}

	if len(bytes) == 0 {
		*j = nil
		return nil
	}

	return json.Unmarshal(bytes, j)
}

// Automation represents an automation workflow
type Automation struct {
	ID            string    `json:"id" db:"id"`
	WebsiteID     string    `json:"websiteId" db:"website_id"`
	UserID        string    `json:"userId" db:"user_id"`
	Name          string    `json:"name" db:"name"`
	Description   string    `json:"description" db:"description"`
	TriggerType   string    `json:"triggerType" db:"trigger_type"`
	TriggerConfig JSONB     `json:"triggerConfig" db:"trigger_config"`
	IsActive      bool      `json:"isActive" db:"is_active"`
	CreatedAt     time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt     time.Time `json:"updatedAt" db:"updated_at"`

	// Relations (not stored in DB, loaded separately)
	Actions    []AutomationAction    `json:"actions,omitempty" db:"-"`
	Conditions []AutomationCondition `json:"conditions,omitempty" db:"-"`
	Stats      *AutomationStats      `json:"stats,omitempty" db:"-"`
}

// AutomationAction represents an action to be performed
type AutomationAction struct {
	ID           string    `json:"id" db:"id"`
	AutomationID string    `json:"automationId" db:"automation_id"`
	ActionType   string    `json:"actionType" db:"action_type"`
	ActionConfig JSONB     `json:"actionConfig" db:"action_config"`
	OrderIndex   int       `json:"orderIndex" db:"order_index"`
	CreatedAt    time.Time `json:"createdAt" db:"created_at"`
	UpdatedAt    time.Time `json:"updatedAt" db:"updated_at"`
}

// AutomationCondition represents a condition for automation execution
type AutomationCondition struct {
	ID              string    `json:"id" db:"id"`
	AutomationID    string    `json:"automationId" db:"automation_id"`
	ConditionType   string    `json:"conditionType" db:"condition_type"`
	ConditionConfig JSONB     `json:"conditionConfig" db:"condition_config"`
	OrderIndex      int       `json:"orderIndex" db:"order_index"`
	CreatedAt       time.Time `json:"createdAt" db:"created_at"`
}

// AutomationExecution represents a single execution of an automation
type AutomationExecution struct {
	ID             string     `json:"id" db:"id"`
	AutomationID   string     `json:"automationId" db:"automation_id"`
	WebsiteID      string     `json:"websiteId" db:"website_id"`
	VisitorID      *string    `json:"visitorId,omitempty" db:"visitor_id"`
	SessionID      *string    `json:"sessionId,omitempty" db:"session_id"`
	TriggerEventID *string    `json:"triggerEventId,omitempty" db:"trigger_event_id"`
	Status         string     `json:"status" db:"status"`
	ExecutionData  JSONB      `json:"executionData,omitempty" db:"execution_data"`
	ErrorMessage   *string    `json:"errorMessage,omitempty" db:"error_message"`
	ExecutedAt     time.Time  `json:"executedAt" db:"executed_at"`
	CompletedAt    *time.Time `json:"completedAt,omitempty" db:"completed_at"`
}

// AutomationStats represents statistics for an automation
type AutomationStats struct {
	TotalExecutions int     `json:"totalExecutions"`
	SuccessCount    int     `json:"successCount"`
	FailureCount    int     `json:"failureCount"`
	SuccessRate     float64 `json:"successRate"`
	Last30Days      int     `json:"last30Days"`
}

// CreateAutomationRequest represents the request to create an automation
type CreateAutomationRequest struct {
	Name          string                `json:"name" binding:"required"`
	Description   string                `json:"description"`
	TriggerType   string                `json:"triggerType" binding:"required"`
	TriggerConfig JSONB                 `json:"triggerConfig"`
	Actions       []AutomationAction    `json:"actions" binding:"required,min=1"`
	Conditions    []AutomationCondition `json:"conditions"`
}

// BatchExecutionRequest represents a batch of automation executions
type BatchExecutionRequest struct {
	WebsiteID  string                `json:"website_id" binding:"required"`
	Executions []AutomationExecution `json:"executions" binding:"required"`
}

// UpdateAutomationRequest represents the request to update an automation
type UpdateAutomationRequest struct {
	Name          *string                `json:"name"`
	Description   *string                `json:"description"`
	TriggerType   *string                `json:"triggerType"`
	TriggerConfig JSONB                  `json:"triggerConfig"`
	IsActive      *bool                  `json:"isActive"`
	Actions       *[]AutomationAction    `json:"actions"`
	Conditions    *[]AutomationCondition `json:"conditions"`
}

// Test automation models
type TestAutomationResult struct {
	Success    bool                  `json:"success"`
	Message    string                `json:"message"`
	Trigger    *TestTriggerResult    `json:"trigger,omitempty"`
	Conditions *TestConditionsResult `json:"conditions,omitempty"`
	Actions    *TestActionsResult    `json:"actions,omitempty"`
}

type TestTriggerResult struct {
	Matched bool   `json:"matched"`
	Message string `json:"message"`
}

type TestConditionsResult struct {
	Total   int                   `json:"total"`
	Passed  int                   `json:"passed"`
	Failed  int                   `json:"failed"`
	Details []TestConditionDetail `json:"details"`
}

type TestConditionDetail struct {
	Index   int    `json:"index"`
	Type    string `json:"type"`
	Passed  bool   `json:"passed"`
	Message string `json:"message"`
}

type TestActionsResult struct {
	Total    int                `json:"total"`
	Executed int                `json:"executed"`
	Details  []TestActionDetail `json:"details"`
}

type TestActionDetail struct {
	Index    int    `json:"index"`
	Type     string `json:"type"`
	WouldRun bool   `json:"wouldRun"`
	Message  string `json:"message"`
}

type TestAutomationRequest struct {
	Automation struct {
		ID      string `json:"id"`
		Name    string `json:"name"`
		Trigger struct {
			Type   string                 `json:"type"`
			Config map[string]interface{} `json:"config"`
		} `json:"trigger"`
		Conditions []struct {
			Type   string                 `json:"type"`
			Config map[string]interface{} `json:"config"`
		} `json:"conditions"`
		Actions []struct {
			Type   string                 `json:"type"`
			Config map[string]interface{} `json:"config"`
		} `json:"actions"`
	} `json:"automation"`
	TestData map[string]interface{} `json:"testData"`
}
