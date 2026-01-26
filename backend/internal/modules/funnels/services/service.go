package services

import (
	"analytics-app/internal/modules/funnels/models"
	"analytics-app/internal/modules/funnels/repository"
	"context"
	"fmt"
)

type FunnelService struct {
	repo *repository.FunnelRepository
}

func NewFunnelService(repo *repository.FunnelRepository) *FunnelService {
	return &FunnelService{
		repo: repo,
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
	return s.repo.DeleteFunnel(ctx, id)
}

// GetFunnelStats aggregated funnel performance stats
// In a real scenario, this would involve complex multi-step aggregation queries
func (s *FunnelService) GetFunnelStats(ctx context.Context, id string) (*models.FunnelStats, error) {
	// For now, return mock stats as the aggregation engine is built in a separate module
	// In the future, this would call the analytics engine
	return &models.FunnelStats{
		TotalEntries:   1000,
		Completions:    250,
		ConversionRate: 25.0,
		StepBreakdown: []models.StepStats{
			{StepOrder: 0, StepName: "Step 1", Count: 1000, DropoffCount: 200, DropoffRate: 20.0, ConversionRate: 100.0},
			{StepOrder: 1, StepName: "Step 2", Count: 800, DropoffCount: 300, DropoffRate: 37.5, ConversionRate: 80.0},
			{StepOrder: 2, StepName: "Step 3", Count: 500, DropoffCount: 250, DropoffRate: 50.0, ConversionRate: 62.5},
			{StepOrder: 3, StepName: "Step 4", Count: 250, DropoffCount: 0, DropoffRate: 0.0, ConversionRate: 50.0},
		},
	}, nil
}
