package services

import (
	"context"
	"fmt"

	"github.com/Seentics/seentics/internal/modules/automations/models"
	"github.com/Seentics/seentics/internal/modules/automations/repository"
	"github.com/rs/zerolog"
)

// TrackerEvent is the wire-format event emitted by seentics.js
type TrackerEvent struct {
	Type string                 `json:"type"`
	Data map[string]interface{} `json:"data"`
	TS   int64                  `json:"ts"`
	URL  string                 `json:"url"`
	SID  string                 `json:"sid"`
	VID  string                 `json:"vid"`
}

// AutomationService orchestrates automation logic
type AutomationService struct {
	repo   *repository.AutomationRepository
	logger zerolog.Logger
}

// NewAutomationService creates a new AutomationService
func NewAutomationService(repo *repository.AutomationRepository, logger zerolog.Logger) *AutomationService {
	return &AutomationService{repo: repo, logger: logger}
}

// ProcessTriggers handles automation_trigger events from the tracker.
// For each event it verifies the referenced automation exists and is active for the
// given website, then records the execution.
func (s *AutomationService) ProcessTriggers(ctx context.Context, websiteID string, events []TrackerEvent) error {
	for _, ev := range events {
		if ev.Type != "automation_trigger" {
			continue
		}

		automationID, _ := ev.Data["automation_id"].(string)
		if automationID == "" {
			s.logger.Warn().Str("website_id", websiteID).Msg("automation trigger: missing automation_id")
			continue
		}

		// Verify automation exists and is active for this website
		auto, err := s.repo.Get(ctx, automationID, websiteID)
		if err != nil {
			s.logger.Warn().Err(err).Str("automation_id", automationID).Msg("automation trigger: automation not found")
			continue
		}
		if !auto.IsActive {
			s.logger.Debug().Str("automation_id", automationID).Msg("automation trigger: automation is inactive, skipping")
			continue
		}

		exec := models.AutomationExecution{
			AutomationID: automationID,
			WebsiteID:    websiteID,
			VisitorID:    ev.VID,
			SessionID:    ev.SID,
			Status:       "completed",
		}
		if err := s.repo.RecordExecution(ctx, exec); err != nil {
			s.logger.Warn().Err(err).Str("automation_id", automationID).Msg("automation trigger: record execution failed")
		}
	}
	return nil
}

// Create creates a new automation for a website
func (s *AutomationService) Create(ctx context.Context, websiteID, userID string, req models.CreateAutomationRequest) (*models.Automation, error) {
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	auto := models.Automation{
		WebsiteID:     websiteID,
		UserID:        userID,
		Name:          req.Name,
		Description:   req.Description,
		TriggerType:   req.TriggerType,
		TriggerConfig: req.TriggerConfig,
		IsActive:      isActive,
		Actions:       req.Actions,
	}

	result, err := s.repo.Create(ctx, auto)
	if err != nil {
		return nil, fmt.Errorf("create automation: %w", err)
	}
	return result, nil
}

// List returns all automations for a website
func (s *AutomationService) List(ctx context.Context, websiteID string) ([]models.Automation, error) {
	automations, err := s.repo.List(ctx, websiteID)
	if err != nil {
		return nil, fmt.Errorf("list automations: %w", err)
	}
	return automations, nil
}

// GetActive returns all active automations for a website (used by the tracker init endpoint)
func (s *AutomationService) GetActive(ctx context.Context, websiteID string) ([]models.Automation, error) {
	automations, err := s.repo.GetActive(ctx, websiteID)
	if err != nil {
		return nil, fmt.Errorf("get active automations: %w", err)
	}
	return automations, nil
}

// Get retrieves a single automation by id
func (s *AutomationService) Get(ctx context.Context, id, websiteID string) (*models.Automation, error) {
	auto, err := s.repo.Get(ctx, id, websiteID)
	if err != nil {
		return nil, fmt.Errorf("get automation: %w", err)
	}
	return auto, nil
}

// Update applies a partial update to an automation
func (s *AutomationService) Update(ctx context.Context, id, websiteID string, req models.UpdateRequest) (*models.Automation, error) {
	auto, err := s.repo.Update(ctx, id, websiteID, req)
	if err != nil {
		return nil, fmt.Errorf("update automation: %w", err)
	}
	return auto, nil
}

// Delete removes an automation
func (s *AutomationService) Delete(ctx context.Context, id, websiteID string) error {
	if err := s.repo.Delete(ctx, id, websiteID); err != nil {
		return fmt.Errorf("delete automation: %w", err)
	}
	return nil
}

// ListExecutions returns recent executions for an automation
func (s *AutomationService) ListExecutions(ctx context.Context, automationID, websiteID string, limit int) ([]models.AutomationExecution, error) {
	if limit <= 0 {
		limit = 50
	}
	execs, err := s.repo.ListExecutions(ctx, automationID, websiteID, limit)
	if err != nil {
		return nil, fmt.Errorf("list executions: %w", err)
	}
	return execs, nil
}
