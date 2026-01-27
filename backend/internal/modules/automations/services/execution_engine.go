package services

import (
	"analytics-app/internal/modules/automations/models"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/rs/zerolog"
)

// ExecutionEngine handles automation execution
type ExecutionEngine struct {
	service *AutomationService
	logger  zerolog.Logger
}

func NewExecutionEngine(service *AutomationService, logger zerolog.Logger) *ExecutionEngine {
	return &ExecutionEngine{
		service: service,
		logger:  logger,
	}
}

// ExecuteAutomation executes an automation for a given trigger event
func (e *ExecutionEngine) ExecuteAutomation(ctx context.Context, automation *models.Automation, triggerData map[string]interface{}) error {
	execution := &models.AutomationExecution{
		AutomationID:  automation.ID,
		WebsiteID:     automation.WebsiteID,
		Status:        "running",
		ExecutionData: triggerData,
		ExecutedAt:    time.Now(),
	}

	// Extract visitor/session IDs from trigger data
	if visitorID, ok := triggerData["visitor_id"].(string); ok {
		execution.VisitorID = &visitorID
	}
	if sessionID, ok := triggerData["session_id"].(string); ok {
		execution.SessionID = &sessionID
	}

	// Check frequency control
	if !e.shouldExecute(ctx, automation, execution) {
		e.logger.Debug().
			Str("automation_id", automation.ID).
			Msg("Automation skipped due to frequency control")
		return nil
	}

	// Evaluate conditions
	if !e.evaluateConditions(automation.Conditions, triggerData) {
		e.logger.Debug().
			Str("automation_id", automation.ID).
			Msg("Automation conditions not met")
		return nil
	}

	// Execute actions in order
	var executionError error
	for _, action := range automation.Actions {
		err := e.executeAction(ctx, action, triggerData)
		if err != nil {
			e.logger.Error().
				Err(err).
				Str("automation_id", automation.ID).
				Str("action_type", action.ActionType).
				Msg("Action execution failed")
			executionError = err
			break
		}
	}

	// Update execution status
	now := time.Now()
	execution.CompletedAt = &now
	if executionError != nil {
		execution.Status = "failed"
		errMsg := executionError.Error()
		execution.ErrorMessage = &errMsg
	} else {
		execution.Status = "success"
	}

	// Record execution
	return e.service.TrackExecution(ctx, execution)
}

// shouldExecute checks frequency control rules
func (e *ExecutionEngine) shouldExecute(ctx context.Context, automation *models.Automation, execution *models.AutomationExecution) bool {
	// Extract frequency config from trigger config
	frequency, ok := automation.TriggerConfig["frequency"].(string)
	if !ok || frequency == "" {
		frequency = "always" // default
	}

	switch frequency {
	case "once_per_session":
		// Check if already executed in this session
		if execution.SessionID == nil {
			return true
		}
		// TODO: Query database to check if executed in this session
		return true

	case "once_per_visitor":
		// Check if already executed for this visitor
		if execution.VisitorID == nil {
			return true
		}
		// TODO: Query database to check if executed for this visitor
		return true

	case "once_per_day":
		// Check if already executed today for this visitor
		if execution.VisitorID == nil {
			return true
		}
		// TODO: Query database to check if executed today
		return true

	case "always":
		return true

	default:
		return true
	}
}

// evaluateConditions checks if all conditions are met
func (e *ExecutionEngine) evaluateConditions(conditions []models.AutomationCondition, data map[string]interface{}) bool {
	if len(conditions) == 0 {
		return true // No conditions = always execute
	}

	for _, condition := range conditions {
		if !e.evaluateCondition(condition, data) {
			return false
		}
	}
	return true
}

// evaluateCondition evaluates a single condition
func (e *ExecutionEngine) evaluateCondition(condition models.AutomationCondition, data map[string]interface{}) bool {
	switch condition.ConditionType {
	case "page_match":
		page, _ := data["page"].(string)
		targetPage, _ := condition.ConditionConfig["page"].(string)
		return page == targetPage

	case "event_property":
		properties, _ := data["properties"].(map[string]interface{})
		key, _ := condition.ConditionConfig["key"].(string)
		value, _ := condition.ConditionConfig["value"]
		return properties[key] == value

	case "visitor_count":
		// TODO: Implement visitor count condition
		return true

	case "time_on_page":
		// TODO: Implement time on page condition
		return true

	default:
		return true
	}
}

// executeAction executes a single action
func (e *ExecutionEngine) executeAction(ctx context.Context, action models.AutomationAction, data map[string]interface{}) error {
	switch action.ActionType {
	case "webhook":
		return e.executeWebhook(ctx, action, data)
	case "email":
		return e.executeEmail(ctx, action, data)
	case "script":
		// Script injection is handled client-side
		return nil
	case "banner":
		// Banner display is handled client-side
		return nil
	default:
		return fmt.Errorf("unknown action type: %s", action.ActionType)
	}
}

// executeWebhook sends a webhook
func (e *ExecutionEngine) executeWebhook(ctx context.Context, action models.AutomationAction, data map[string]interface{}) error {
	url, ok := action.ActionConfig["url"].(string)
	if !ok || url == "" {
		return fmt.Errorf("webhook URL is required")
	}

	method, _ := action.ActionConfig["method"].(string)
	if method == "" {
		method = "POST"
	}

	headers, _ := action.ActionConfig["headers"].(map[string]interface{})
	body, _ := action.ActionConfig["body"].(map[string]interface{})

	// Merge trigger data with custom body
	payload := make(map[string]interface{})
	for k, v := range data {
		payload[k] = v
	}
	for k, v := range body {
		payload[k] = v
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal webhook payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create webhook request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	for key, value := range headers {
		if strValue, ok := value.(string); ok {
			req.Header.Set(key, strValue)
		}
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("webhook request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("webhook returned status %d", resp.StatusCode)
	}

	e.logger.Info().
		Str("url", url).
		Int("status", resp.StatusCode).
		Msg("Webhook sent successfully")

	return nil
}

// executeEmail sends an email
func (e *ExecutionEngine) executeEmail(ctx context.Context, action models.AutomationAction, data map[string]interface{}) error {
	to, ok := action.ActionConfig["to"].(string)
	if !ok || to == "" {
		return fmt.Errorf("email recipient is required")
	}

	subject, _ := action.ActionConfig["subject"].(string)
	emailBody, _ := action.ActionConfig["body"].(string)

	// TODO: Integrate with email service (SendGrid, AWS SES, etc.)
	// For now, just log
	e.logger.Info().
		Str("to", to).
		Str("subject", subject).
		Str("body", emailBody).
		Msg("Email would be sent (email service not configured)")

	return nil
}

// ProcessEvent processes an analytics event and triggers matching automations
func (e *ExecutionEngine) ProcessEvent(ctx context.Context, websiteID string, eventData map[string]interface{}) error {
	// Get active automations for this website
	automations, err := e.service.GetActiveAutomations(ctx, websiteID)
	if err != nil {
		return fmt.Errorf("failed to get active automations: %w", err)
	}

	eventType, _ := eventData["event_type"].(string)

	// Find matching automations
	for _, automation := range automations {
		if e.matchesTrigger(automation, eventType, eventData) {
			// Execute in background to not block event processing
			go func(auto models.Automation) {
				bgCtx := context.Background()
				if err := e.ExecuteAutomation(bgCtx, &auto, eventData); err != nil {
					e.logger.Error().
						Err(err).
						Str("automation_id", auto.ID).
						Msg("Failed to execute automation")
				}
			}(automation)
		}
	}

	return nil
}

// matchesTrigger checks if an event matches an automation trigger
func (e *ExecutionEngine) matchesTrigger(automation models.Automation, eventType string, eventData map[string]interface{}) bool {
	switch automation.TriggerType {
	case "pageview":
		return eventType == "pageview"
	case "event":
		triggerEvent, _ := automation.TriggerConfig["event_name"].(string)
		return eventType == triggerEvent
	case "page_exit":
		return eventType == "page_exit"
	case "time_on_page":
		return eventType == "pageview" // Will be evaluated by conditions
	default:
		return false
	}
}
