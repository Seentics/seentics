package services

import (
	"analytics-app/internal/modules/automations/models"
	"analytics-app/internal/modules/automations/repository"
	"context"
	"fmt"
)

type AutomationService struct {
	repo *repository.AutomationRepository
}

func NewAutomationService(repo *repository.AutomationRepository) *AutomationService {
	return &AutomationService{
		repo: repo,
	}
}

// ListAutomations retrieves all automations for a website with stats
func (s *AutomationService) ListAutomations(ctx context.Context, websiteID string) ([]models.Automation, error) {
	automations, err := s.repo.ListAutomations(ctx, websiteID)
	if err != nil {
		return nil, fmt.Errorf("failed to list automations: %w", err)
	}

	// Load stats for each automation
	for i := range automations {
		stats, err := s.repo.GetAutomationStats(ctx, automations[i].ID)
		if err == nil {
			automations[i].Stats = stats
		}
	}

	return automations, nil
}

// GetAutomation retrieves a single automation by ID
func (s *AutomationService) GetAutomation(ctx context.Context, id string) (*models.Automation, error) {
	automation, err := s.repo.GetAutomationByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get automation: %w", err)
	}

	// Load stats
	stats, err := s.repo.GetAutomationStats(ctx, automation.ID)
	if err == nil {
		automation.Stats = stats
	}

	return automation, nil
}

// CreateAutomation creates a new automation
func (s *AutomationService) CreateAutomation(ctx context.Context, req *models.CreateAutomationRequest, websiteID, userID string) (*models.Automation, error) {
	// Validate request
	if req.Name == "" {
		return nil, fmt.Errorf("automation name is required")
	}
	if req.TriggerType == "" {
		return nil, fmt.Errorf("trigger type is required")
	}
	if len(req.Actions) == 0 {
		return nil, fmt.Errorf("at least one action is required")
	}

	// Create automation model
	automation := &models.Automation{
		WebsiteID:     websiteID,
		UserID:        userID,
		Name:          req.Name,
		Description:   req.Description,
		TriggerType:   req.TriggerType,
		TriggerConfig: req.TriggerConfig,
		IsActive:      true,
		Actions:       req.Actions,
		Conditions:    req.Conditions,
	}

	// Save to database
	err := s.repo.CreateAutomation(ctx, automation)
	if err != nil {
		return nil, fmt.Errorf("failed to create automation: %w", err)
	}

	// Reload to get complete data
	return s.repo.GetAutomationByID(ctx, automation.ID)
}

// UpdateAutomation updates an existing automation
func (s *AutomationService) UpdateAutomation(ctx context.Context, id string, req *models.UpdateAutomationRequest) (*models.Automation, error) {
	// Check if automation exists
	existing, err := s.repo.GetAutomationByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("automation not found: %w", err)
	}

	// Update automation
	err = s.repo.UpdateAutomation(ctx, id, req)
	if err != nil {
		return nil, fmt.Errorf("failed to update automation: %w", err)
	}

	// Reload to get updated data
	return s.repo.GetAutomationByID(ctx, existing.ID)
}

// DeleteAutomation deletes an automation
func (s *AutomationService) DeleteAutomation(ctx context.Context, id string) error {
	err := s.repo.DeleteAutomation(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to delete automation: %w", err)
	}
	return nil
}

// ToggleAutomation toggles the active status of an automation
func (s *AutomationService) ToggleAutomation(ctx context.Context, id string) (*models.Automation, error) {
	automation, err := s.repo.GetAutomationByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("automation not found: %w", err)
	}

	newStatus := !automation.IsActive
	err = s.repo.UpdateAutomation(ctx, id, &models.UpdateAutomationRequest{
		IsActive: &newStatus,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to toggle automation: %w", err)
	}

	return s.repo.GetAutomationByID(ctx, id)
}

// GetAutomationStats retrieves statistics for an automation
func (s *AutomationService) GetAutomationStats(ctx context.Context, id string) (*models.AutomationStats, error) {
	stats, err := s.repo.GetAutomationStats(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get automation stats: %w", err)
	}
	return stats, nil
}

// GetActiveAutomations retrieves all active automations for a website
func (s *AutomationService) GetActiveAutomations(ctx context.Context, websiteID string) ([]models.Automation, error) {
	return s.repo.GetActiveAutomations(ctx, websiteID)
}

// TrackExecution records an automated action execution
func (s *AutomationService) TrackExecution(ctx context.Context, exec *models.AutomationExecution) error {
	return s.repo.CreateExecution(ctx, exec)
}
