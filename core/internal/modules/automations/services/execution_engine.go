package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/Seentics/seentics/internal/modules/automations/models"

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
	return e.service.TrackExecution(ctx, execution, "")
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
		if execution.SessionID == nil {
			return true
		}
		executed, err := e.service.HasExecutedInSession(ctx, automation.ID, *execution.SessionID)
		if err != nil {
			e.logger.Error().Err(err).Msg("Failed to check once_per_session execution")
			return false // Fail safe
		}
		return !executed

	case "once_per_visitor":
		if execution.VisitorID == nil {
			return true
		}
		executed, err := e.service.HasExecutedForVisitor(ctx, automation.ID, *execution.VisitorID)
		if err != nil {
			e.logger.Error().Err(err).Msg("Failed to check once_per_visitor execution")
			return false
		}
		return !executed

	case "once_per_day":
		if execution.VisitorID == nil {
			return true
		}
		executed, err := e.service.HasExecutedToday(ctx, automation.ID, *execution.VisitorID)
		if err != nil {
			e.logger.Error().Err(err).Msg("Failed to check once_per_day execution")
			return false
		}
		return !executed

	case "always":
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
	case "slack":
		return e.executeSlack(ctx, action, data)
	case "whatsapp":
		return e.executeWhatsApp(ctx, action, data)
	case "email":
		return e.executeEmail(ctx, action, data)
	case "script", "javascript":
		// Handled client-side
		return nil
	case "banner", "modal", "notification", "hideElement", "showElement", "redirect", "setCookie":
		// Handled client-side in the browser tracker
		e.logger.Debug().
			Str("action_type", action.ActionType).
			Msg("Browser-based action recorded for delivery")
		return nil
	case "trackEvent":
		// Server-side event tracking (can be used to pipe data back into analytics)
		e.logger.Info().Msg("Track Event action would record a new event")
		return nil
	default:
		return fmt.Errorf("unknown action type: %s", action.ActionType)
	}
}

// executeEmail stays as a stub for now
func (e *ExecutionEngine) executeEmail(ctx context.Context, action models.AutomationAction, data map[string]interface{}) error {
	recipient, _ := action.ActionConfig["recipient"].(string)
	subject, _ := action.ActionConfig["subject"].(string)

	recipient = e.replaceVariables(recipient, data)
	subject = e.replaceVariables(subject, data)

	e.logger.Info().
		Str("recipient", recipient).
		Str("subject", subject).
		Msg("Email notification would be sent (Email server not configured)")

	return nil
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

// executeSlack sends a message to Slack via Webhook
func (e *ExecutionEngine) executeSlack(ctx context.Context, action models.AutomationAction, data map[string]interface{}) error {
	webhookURL, _ := action.ActionConfig["webhookUrl"].(string)
	message, _ := action.ActionConfig["message"].(string)

	if webhookURL == "" {
		e.logger.Warn().Msg("Slack action skipped: No webhookUrl configured")
		return nil
	}

	// 1. Replace variables in message
	message = e.replaceVariables(message, data)

	// 2. Prepare simple Slack payload
	payload := map[string]interface{}{
		"text": message,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal slack payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", webhookURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create slack request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("slack request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("slack returned status %d", resp.StatusCode)
	}

	e.logger.Info().Str("webhook", webhookURL).Msg("Slack notification sent successfully")
	return nil
}

func (e *ExecutionEngine) replaceVariables(text string, data map[string]interface{}) string {
	if text == "" {
		return text
	}

	// Find all {{variable}} patterns
	re := regexp.MustCompile(`\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}`)
	return re.ReplaceAllStringFunc(text, func(match string) string {
		// Extract key from {{key}}
		submatches := re.FindStringSubmatch(match)
		if len(submatches) < 2 {
			return match
		}
		key := submatches[1]

		// Find value in data
		if val, ok := data[key]; ok {
			return fmt.Sprintf("%v", val)
		}

		// Fallback to empty string or original match if not found
		return ""
	})
}

// executeWhatsApp stays as a stub for now
func (e *ExecutionEngine) executeWhatsApp(ctx context.Context, action models.AutomationAction, data map[string]interface{}) error {
	phone, _ := action.ActionConfig["phoneNumber"].(string)
	message, _ := action.ActionConfig["message"].(string)

	phone = e.replaceVariables(phone, data)
	message = e.replaceVariables(message, data)

	e.logger.Info().
		Str("phone", phone).
		Str("message", message).
		Msg("WhatsApp message would be sent (WhatsApp API not configured in core)")

	return nil
}

// ProcessEvent processes an analytics event and triggers matching automations
func (e *ExecutionEngine) ProcessEvent(ctx context.Context, websiteID string, eventData map[string]interface{}) error {
	// Get active automations for this website
	automations, err := e.service.GetActiveAutomations(ctx, websiteID, "")
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

// matchesTrigger checks if an analytics event matches an automation trigger
func (e *ExecutionEngine) matchesTrigger(automation models.Automation, eventType string, eventData map[string]interface{}) bool {
	// Normalized trigger type for matching
	tType := strings.ToLower(automation.TriggerType)

	switch tType {
	case "pageview":
		return eventType == "pageview"

	case "event", "customevent":
		// Custom analytics event match
		triggerEvent, _ := automation.TriggerConfig["event_name"].(string)
		return eventType == triggerEvent

	case "page_exit", "exitintent":
		return eventType == "page_exit" || eventType == "exit_intent"

	case "time_on_page", "timeonpage":
		// time_on_page usually comes as a pageview event but is processed after a delay
		// If it's sent as a specific event, match it
		return eventType == "time_on_page"

	case "scroll":
		return eventType == "scroll"

	case "inactivity":
		return eventType == "inactivity"

	case "rageclicks", "rage_clicks":
		return eventType == "rage_click" || eventType == "rage_clicks"

	case "formsubmit":
		return eventType == "form_submit"

	case "funnelcomplete":
		if eventType != "funnel_complete" {
			return false
		}
		// Optional: Match specific funnel ID
		funnelID, _ := automation.TriggerConfig["funnel_id"].(string)
		if funnelID != "" {
			eventFunnelID, _ := eventData["funnel_id"].(string)
			return funnelID == eventFunnelID
		}
		return true

	case "funneldropoff":
		if eventType != "funnel_drop_off" && eventType != "funnel_dropoff" {
			return false
		}
		// Optional: Match specific funnel ID
		funnelID, _ := automation.TriggerConfig["funnel_id"].(string)
		if funnelID != "" {
			eventFunnelID, _ := eventData["funnel_id"].(string)
			return funnelID == eventFunnelID
		}
		return true

	case "goalcompleted":
		if eventType != "goal_completed" {
			return false
		}
		// Optional: Match goal name
		goalName, _ := automation.TriggerConfig["goal_name"].(string)
		if goalName != "" {
			eventGoalName, _ := eventData["goal_name"].(string)
			return goalName == eventGoalName
		}
		return true

	default:
		// Attempt exact match for any other custom types
		return eventType == tType
	}
}
