package services

import (
	billingModels "analytics-app/internal/modules/billing/models"
	billingServicePkg "analytics-app/internal/modules/billing/services"
	"analytics-app/internal/modules/funnels/models"
	"analytics-app/internal/modules/funnels/repository"
	"context"
	"fmt"
)

type FunnelService struct {
	repo    *repository.FunnelRepository
	billing *billingServicePkg.BillingService
}

func NewFunnelService(repo *repository.FunnelRepository, billing *billingServicePkg.BillingService) *FunnelService {
	return &FunnelService{
		repo:    repo,
		billing: billing,
	}
}

// ListFunnels retrieves all funnels for a website with enriched stats
func (s *FunnelService) ListFunnels(ctx context.Context, websiteID string) ([]models.Funnel, error) {
	funnels, err := s.repo.ListFunnels(ctx, websiteID)
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

// GetActiveFunnels retrieves all active funnels for a website
func (s *FunnelService) GetActiveFunnels(ctx context.Context, websiteID string) ([]models.Funnel, error) {
	return s.repo.GetActiveFunnels(ctx, websiteID)
}

// TrackFunnelEvent processes a tracking event from the frontend
func (s *FunnelService) TrackFunnelEvent(ctx context.Context, req *models.TrackFunnelEventRequest) error {
	// For now, we'll just log this and record in analytics if implemented
	// In a full implementation, we'd store raw events or update real-time stats
	return nil
}

// GetFunnel retrieves a funnel by ID
func (s *FunnelService) GetFunnel(ctx context.Context, id string) (*models.Funnel, error) {
	funnel, err := s.repo.GetFunnelByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get funnel: %w", err)
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
	funnel := &models.Funnel{
		WebsiteID:   websiteID,
		UserID:      userID,
		Name:        req.Name,
		Description: req.Description,
		IsActive:    true,
		Steps:       req.Steps,
	}

	err := s.repo.CreateFunnel(ctx, funnel)
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
func (s *FunnelService) UpdateFunnel(ctx context.Context, id string, req *models.UpdateFunnelRequest) (*models.Funnel, error) {
	err := s.repo.UpdateFunnel(ctx, id, req)
	if err != nil {
		return nil, fmt.Errorf("failed to update funnel: %w", err)
	}

	return s.repo.GetFunnelByID(ctx, id)
}

// DeleteFunnel deletes a funnel
func (s *FunnelService) DeleteFunnel(ctx context.Context, id string) error {
	// Get funnel to extract userID before deletion
	funnel, err := s.repo.GetFunnelByID(ctx, id)
	if err != nil {
		return err
	}

	if err := s.repo.DeleteFunnel(ctx, id); err != nil {
		return err
	}

	// Decrement usage in Redis
	if s.billing != nil {
		if err := s.billing.IncrementUsageRedis(ctx, funnel.UserID, billingModels.ResourceFunnels, -1); err != nil {
			fmt.Printf("Warning: failed to decrement funnel usage: %v\n", err)
		}
	}

	return nil
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
