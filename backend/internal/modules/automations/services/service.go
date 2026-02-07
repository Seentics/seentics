package services

import (
	"analytics-app/internal/modules/automations/models"
	"analytics-app/internal/modules/automations/repository"
	billingModels "analytics-app/internal/modules/billing/models"
	billingServicePkg "analytics-app/internal/modules/billing/services"
	websiteServicePkg "analytics-app/internal/modules/websites/services"
	"context"
	"fmt"

	"github.com/google/uuid"
)

type AutomationService struct {
	repo     *repository.AutomationRepository
	billing  *billingServicePkg.BillingService
	websites *websiteServicePkg.WebsiteService
}

func NewAutomationService(repo *repository.AutomationRepository, billing *billingServicePkg.BillingService, websites *websiteServicePkg.WebsiteService) *AutomationService {
	return &AutomationService{
		repo:     repo,
		billing:  billing,
		websites: websites,
	}
}

// validateOwnership ensures the website belongs to the user
func (s *AutomationService) validateOwnership(ctx context.Context, websiteID string, userID string) (string, error) {
	if userID == "" {
		return "", fmt.Errorf("user_id is required")
	}

	uid, err := uuid.Parse(userID)
	if err != nil {
		return "", fmt.Errorf("invalid user_id format")
	}

	w, err := s.websites.GetWebsiteBySiteID(ctx, websiteID)
	if err != nil {
		return "", fmt.Errorf("website not found")
	}

	if w.UserID != uid {
		return "", fmt.Errorf("unauthorized access to website data")
	}

	return w.SiteID, nil
}

// ListAutomations retrieves all automations for a website with stats
func (s *AutomationService) ListAutomations(ctx context.Context, websiteID string, userID string) ([]models.Automation, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}

	automations, err := s.repo.ListAutomations(ctx, canonicalID)
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
func (s *AutomationService) GetAutomation(ctx context.Context, id string, userID string) (*models.Automation, error) {
	automation, err := s.repo.GetAutomationByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get automation: %w", err)
	}

	// Verify owner
	if userID != "system" && automation.UserID != userID {
		return nil, fmt.Errorf("unauthorized access to automation")
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
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}

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
		WebsiteID:     canonicalID,
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
	err = s.repo.CreateAutomation(ctx, automation)
	if err != nil {
		return nil, fmt.Errorf("failed to create automation: %w", err)
	}

	// Track usage in Redis
	if s.billing != nil {
		if err := s.billing.IncrementUsageRedis(ctx, userID, billingModels.ResourceAutomations, 1); err != nil {
			fmt.Printf("Warning: failed to track automation usage: %v\n", err)
		}
	}

	// Reload to get complete data
	return s.repo.GetAutomationByID(ctx, automation.ID)
}

// UpdateAutomation updates an existing automation
func (s *AutomationService) UpdateAutomation(ctx context.Context, id string, req *models.UpdateAutomationRequest, userID string) (*models.Automation, error) {
	// Check ownership
	existing, err := s.GetAutomation(ctx, id, userID)
	if err != nil {
		return nil, err
	}

	err = s.repo.UpdateAutomation(ctx, existing.ID, req)
	if err != nil {
		return nil, fmt.Errorf("failed to update automation: %w", err)
	}

	// Reload to get updated data
	return s.repo.GetAutomationByID(ctx, existing.ID)
}

// DeleteAutomation removes an automation
func (s *AutomationService) DeleteAutomation(ctx context.Context, id string, userID string) error {
	// Check ownership
	_, err := s.GetAutomation(ctx, id, userID)
	if err != nil {
		return err
	}

	return s.repo.DeleteAutomation(ctx, id)
}

// ToggleAutomation toggles the active status of an automation
func (s *AutomationService) ToggleAutomation(ctx context.Context, id string, userID string) (*models.Automation, error) {
	// Check ownership
	existing, err := s.GetAutomation(ctx, id, userID)
	if err != nil {
		return nil, err
	}

	newStatus := !existing.IsActive
	err = s.repo.UpdateAutomation(ctx, id, &models.UpdateAutomationRequest{
		IsActive: &newStatus,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to toggle automation: %w", err)
	}

	return s.repo.GetAutomationByID(ctx, id)
}

// GetAutomationStats retrieves statistics for an automation
func (s *AutomationService) GetAutomationStats(ctx context.Context, id string, userID string) (*models.AutomationStats, error) {
	// Check ownership
	_, err := s.GetAutomation(ctx, id, userID)
	if err != nil {
		return nil, err
	}

	stats, err := s.repo.GetAutomationStats(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get automation stats: %w", err)
	}
	return stats, nil
}

// GetActiveAutomations retrieves all active automations for a website (Public)
func (s *AutomationService) GetActiveAutomations(ctx context.Context, websiteID string, origin string) ([]models.Automation, error) {
	w, err := s.websites.GetWebsiteBySiteID(ctx, websiteID)
	if err != nil {
		return nil, fmt.Errorf("website not found")
	}

	if !s.websites.ValidateOriginDomain(origin, w.URL) {
		return nil, fmt.Errorf("domain mismatch")
	}

	if !w.AutomationEnabled {
		return []models.Automation{}, nil
	}

	return s.repo.GetActiveAutomations(ctx, w.SiteID)
}

// TrackExecution records an automated action execution (Public)
func (s *AutomationService) TrackExecution(ctx context.Context, exec *models.AutomationExecution, origin string) error {
	w, err := s.websites.GetWebsiteBySiteID(ctx, exec.WebsiteID)
	if err != nil {
		return fmt.Errorf("website not found")
	}

	if !s.websites.ValidateOriginDomain(origin, w.URL) {
		return fmt.Errorf("domain mismatch")
	}

	if !w.AutomationEnabled {
		return fmt.Errorf("automation is disabled for this website")
	}

	// Check if user still has event quota (executions count as data points/events)
	if s.billing != nil {
		can, err := s.billing.CanTrackEvent(ctx, w.UserID.String())
		if err != nil {
			return err
		}
		if !can {
			return fmt.Errorf("monthly event limit reached")
		}
	}

	return s.repo.CreateExecution(ctx, exec)
}
