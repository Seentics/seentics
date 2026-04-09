package services

import (
	"context"
	"fmt"
	"time"

	"github.com/Seentics/seentics/internal/modules/automations/models"
	"github.com/Seentics/seentics/internal/modules/automations/repository"
	"github.com/Seentics/seentics/internal/shared/cache"
	"github.com/rs/zerolog"
)

const (
	autoActiveCacheTTL = 5 * time.Minute
	autoGetCacheTTL    = 5 * time.Minute
)

// TrackerEvent is the wire-format event emitted by seentics.js
type TrackerEvent struct {
	Type      string                 `json:"type"`
	Data      map[string]interface{} `json:"data"`
	TS        int64                  `json:"ts"`
	URL       string                 `json:"url"`
	SID       string                 `json:"sid"`
	VID       string                 `json:"vid"`
	WebsiteID string                 `json:"-"`
}

// AutomationService orchestrates automation logic
type AutomationService struct {
	repo   *repository.AutomationRepository
	cache  *cache.Cache
	logger zerolog.Logger
}

// NewAutomationService creates a new AutomationService
func NewAutomationService(repo *repository.AutomationRepository, c *cache.Cache, logger zerolog.Logger) *AutomationService {
	return &AutomationService{repo: repo, cache: c, logger: logger}
}

// ProcessTriggers handles automation_trigger events from the tracker.
// Events are deduplicated by automation_id so each unique automation is
// looked up only once per batch (and that lookup is Redis-cached).
// ProcessTriggers handles automation_trigger events from the tracker.
// Each event carries its own WebsiteID so events from multiple sites can
// be processed in a single global call.
func (s *AutomationService) ProcessTriggers(ctx context.Context, events []TrackerEvent) error {
	// Group executions by automation_id — one DB/cache lookup per unique automation
	type pending struct{ execs []models.AutomationExecution }
	byID := make(map[string]*pending)

	for _, ev := range events {
		if ev.Type != "automation_trigger" {
			continue
		}
		automationID, _ := ev.Data["automation_id"].(string)
		if automationID == "" {
			s.logger.Warn().Str("website_id", ev.WebsiteID).Msg("automation trigger: missing automation_id")
			continue
		}
		if byID[automationID] == nil {
			byID[automationID] = &pending{}
		}
		byID[automationID].execs = append(byID[automationID].execs, models.AutomationExecution{
			AutomationID: automationID,
			WebsiteID:    ev.WebsiteID,
			VisitorID:    ev.VID,
			SessionID:    ev.SID,
			Status:       "completed",
		})
	}

	for automationID, p := range byID {
		auto, err := s.Get(ctx, automationID, p.execs[0].WebsiteID) // cached
		if err != nil {
			s.logger.Warn().Err(err).Str("automation_id", automationID).Msg("automation trigger: not found")
			continue
		}
		if !auto.IsActive {
			continue
		}
		for _, exec := range p.execs {
			if err := s.repo.RecordExecution(ctx, exec); err != nil {
				s.logger.Warn().Err(err).Str("automation_id", automationID).Msg("automation trigger: record execution failed")
			}
		}
	}
	return nil
}

// GetActive returns all active automations for a website (used by tracker init).
// Result is cached for 5 minutes.
func (s *AutomationService) GetActive(ctx context.Context, websiteID string) ([]models.Automation, error) {
	key := "auto:active:" + websiteID
	var cached []models.Automation
	if s.cache.Get(key, &cached) {
		return cached, nil
	}
	automations, err := s.repo.GetActive(ctx, websiteID)
	if err != nil {
		return nil, fmt.Errorf("get active automations: %w", err)
	}
	_ = s.cache.Set(key, automations, autoActiveCacheTTL)
	return automations, nil
}

// Get retrieves a single automation by id. Result is cached for 5 minutes.
func (s *AutomationService) Get(ctx context.Context, id, websiteID string) (*models.Automation, error) {
	key := "auto:" + id + ":" + websiteID
	var cached models.Automation
	if s.cache.Get(key, &cached) {
		return &cached, nil
	}
	auto, err := s.repo.Get(ctx, id, websiteID)
	if err != nil {
		return nil, fmt.Errorf("get automation: %w", err)
	}
	_ = s.cache.Set(key, auto, autoGetCacheTTL)
	return auto, nil
}

// Create creates a new automation and evicts the active-list cache.
func (s *AutomationService) Create(ctx context.Context, websiteID, userID string, req models.CreateAutomationRequest) (*models.Automation, error) {
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}
	auto := models.Automation{
		WebsiteID: websiteID, UserID: userID, Name: req.Name,
		Description: req.Description, TriggerType: req.TriggerType,
		TriggerConfig: req.TriggerConfig, IsActive: isActive, Actions: req.Actions,
	}
	result, err := s.repo.Create(ctx, auto)
	if err != nil {
		return nil, fmt.Errorf("create automation: %w", err)
	}
	s.cache.Delete("auto:active:" + websiteID)
	return result, nil
}

// List returns all automations for a website (admin view, no cache).
func (s *AutomationService) List(ctx context.Context, websiteID string) ([]models.Automation, error) {
	automations, err := s.repo.List(ctx, websiteID)
	if err != nil {
		return nil, fmt.Errorf("list automations: %w", err)
	}
	return automations, nil
}

// Update applies a partial update and evicts related cache entries.
func (s *AutomationService) Update(ctx context.Context, id, websiteID string, req models.UpdateRequest) (*models.Automation, error) {
	auto, err := s.repo.Update(ctx, id, websiteID, req)
	if err != nil {
		return nil, fmt.Errorf("update automation: %w", err)
	}
	s.cache.Delete("auto:active:" + websiteID)
	s.cache.Delete("auto:" + id + ":" + websiteID)
	return auto, nil
}

// Delete removes an automation and evicts related cache entries.
func (s *AutomationService) Delete(ctx context.Context, id, websiteID string) error {
	if err := s.repo.Delete(ctx, id, websiteID); err != nil {
		return fmt.Errorf("delete automation: %w", err)
	}
	s.cache.Delete("auto:active:" + websiteID)
	s.cache.Delete("auto:" + id + ":" + websiteID)
	return nil
}

// BulkDelete removes multiple automations and evicts related cache entries.
func (s *AutomationService) BulkDelete(ctx context.Context, websiteID string, ids []string) error {
	for _, id := range ids {
		if err := s.Delete(ctx, id, websiteID); err != nil {
			s.logger.Error().Err(err).Str("id", id).Msg("bulk delete: failed for one automation")
		}
	}
	return nil
}


// ListExecutions returns recent executions for an automation.
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
