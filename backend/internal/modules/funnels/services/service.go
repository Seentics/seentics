package services

import (
	billingModels "analytics-app/internal/modules/billing/models"
	billingServicePkg "analytics-app/internal/modules/billing/services"
	"analytics-app/internal/modules/funnels/models"
	"analytics-app/internal/modules/funnels/repository"
	websiteServicePkg "analytics-app/internal/modules/websites/services"
	"context"
	"fmt"

	"github.com/google/uuid"
)

type FunnelService struct {
	repo     *repository.FunnelRepository
	billing  *billingServicePkg.BillingService
	websites *websiteServicePkg.WebsiteService
}

func NewFunnelService(repo *repository.FunnelRepository, billing *billingServicePkg.BillingService, websites *websiteServicePkg.WebsiteService) *FunnelService {
	return &FunnelService{
		repo:     repo,
		billing:  billing,
		websites: websites,
	}
}

// validateOwnership ensures the website belongs to the user
func (s *FunnelService) validateOwnership(ctx context.Context, websiteID string, userID string) (string, error) {
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

// ListFunnels retrieves all funnels for a website with enriched stats
func (s *FunnelService) ListFunnels(ctx context.Context, websiteID string, userID string) ([]models.Funnel, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}

	funnels, err := s.repo.ListFunnels(ctx, canonicalID)
	if err != nil {
		return nil, fmt.Errorf("failed to list funnels: %w", err)
	}

	// Enrich with stats
	for i := range funnels {
		stats, err := s.GetFunnelStats(ctx, funnels[i].ID)
		if err == nil {
			funnels[i].Stats = stats
		}
	}

	return funnels, nil
}

// GetActiveFunnels retrieves all active funnels for a website (Public version)
func (s *FunnelService) GetActiveFunnels(ctx context.Context, websiteID string, origin string) ([]models.Funnel, error) {
	w, err := s.websites.GetWebsiteBySiteID(ctx, websiteID)
	if err != nil {
		return nil, fmt.Errorf("website not found")
	}

	if !s.websites.ValidateOriginDomain(origin, w.URL) {
		return nil, fmt.Errorf("domain mismatch")
	}

	if !w.FunnelEnabled {
		return []models.Funnel{}, nil
	}

	return s.repo.GetActiveFunnels(ctx, w.SiteID)
}

// TrackFunnelEvent processes a tracking event from the frontend (Public)
func (s *FunnelService) TrackFunnelEvent(ctx context.Context, req *models.TrackFunnelEventRequest, origin string) error {
	w, err := s.websites.GetWebsiteBySiteID(ctx, req.WebsiteID)
	if err != nil {
		return fmt.Errorf("website not found")
	}

	if !s.websites.ValidateOriginDomain(origin, w.URL) {
		return fmt.Errorf("domain mismatch")
	}

	if !w.FunnelEnabled {
		return fmt.Errorf("funnel tracking is disabled for this website")
	}

	// Funnel events also count towards the event quota
	if s.billing != nil {
		can, err := s.billing.CanTrackEvent(ctx, w.UserID.String())
		if err != nil {
			return err
		}
		if !can {
			return fmt.Errorf("monthly event limit reached")
		}
	}

	// For now, these events are primarily used for real-time calculation in GetFunnelStats
	// which looks at the main 'events' table. We could record them separately if needed.
	return nil
}

// GetFunnel retrieves a funnel by ID
func (s *FunnelService) GetFunnel(ctx context.Context, id string, userID string) (*models.Funnel, error) {
	funnel, err := s.repo.GetFunnelByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get funnel: %w", err)
	}

	// Verify owner
	if userID != "system" && funnel.UserID != userID {
		return nil, fmt.Errorf("unauthorized access to funnel")
	}

	// Enrich with stats
	stats, err := s.GetFunnelStats(ctx, funnel.ID)
	if err == nil {
		funnel.Stats = stats
	}

	return funnel, nil
}

// CreateFunnel creates a new funnel
func (s *FunnelService) CreateFunnel(ctx context.Context, req *models.CreateFunnelRequest, websiteID, userID string) (*models.Funnel, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}

	funnel := &models.Funnel{
		WebsiteID:   canonicalID,
		UserID:      userID,
		Name:        req.Name,
		Description: req.Description,
		IsActive:    true,
		Steps:       req.Steps,
	}

	err = s.repo.CreateFunnel(ctx, funnel)
	if err != nil {
		return nil, fmt.Errorf("failed to create funnel: %w", err)
	}

	// Track usage in Redis
	if s.billing != nil {
		if err := s.billing.IncrementUsageRedis(ctx, userID, billingModels.ResourceFunnels, 1); err != nil {
			fmt.Printf("Warning: failed to track funnel usage: %v\n", err)
		}
	}

	return s.repo.GetFunnelByID(ctx, funnel.ID)
}

// UpdateFunnel updates an existing funnel
func (s *FunnelService) UpdateFunnel(ctx context.Context, id string, req *models.UpdateFunnelRequest, userID string) (*models.Funnel, error) {
	// 1. Check ownership
	existing, err := s.GetFunnel(ctx, id, userID)
	if err != nil {
		return nil, err
	}

	err = s.repo.UpdateFunnel(ctx, existing.ID, req)
	if err != nil {
		return nil, fmt.Errorf("failed to update funnel: %w", err)
	}

	return s.repo.GetFunnelByID(ctx, id)
}

// DeleteFunnel removes a funnel
func (s *FunnelService) DeleteFunnel(ctx context.Context, id string, userID string) error {
	// 1. Check ownership
	_, err := s.GetFunnel(ctx, id, userID)
	if err != nil {
		return err
	}

	return s.repo.DeleteFunnel(ctx, id)
}

// GetFunnelStats aggregated funnel performance stats
func (s *FunnelService) GetFunnelStats(ctx context.Context, id string) (*models.FunnelStats, error) {
	// Retrieve funnel to get websiteID
	funnel, err := s.repo.GetFunnelByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Call repository for real-time stats
	return s.repo.GetFunnelStats(ctx, funnel.ID, funnel.WebsiteID)
}
