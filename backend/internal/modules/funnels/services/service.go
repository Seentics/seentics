package services

import (
	"analytics-app/internal/modules/funnels/models"
	"analytics-app/internal/modules/funnels/repository"
)

type FunnelService struct {
	repo *repository.FunnelRepository
}

func NewFunnelService(repo *repository.FunnelRepository) *FunnelService {
	return &FunnelService{
		repo: repo,
	}
}

func (s *FunnelService) ListFunnels(websiteID string) ([]models.Funnel, error) {
	// Placeholder
	return []models.Funnel{}, nil
}
