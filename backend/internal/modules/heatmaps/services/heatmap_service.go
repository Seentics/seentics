package services

import (
	"analytics-app/internal/modules/heatmaps/models"
	"analytics-app/internal/modules/heatmaps/repository"
	websiteServicePkg "analytics-app/internal/modules/websites/services"
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type HeatmapService interface {
	RecordHeatmapData(req models.HeatmapRecordRequest, origin string) error
	GetHeatmapData(ctx context.Context, websiteID string, url string, heatmapType string, from, to time.Time, userID string) ([]models.HeatmapPoint, error)
	GetHeatmapPages(ctx context.Context, websiteID string, userID string) ([]string, error)
}

func (s *heatmapService) RecordHeatmapData(req models.HeatmapRecordRequest, origin string) error {
	// Validate website existence
	w, err := s.websites.GetWebsiteBySiteID(context.Background(), req.WebsiteID)
	if err != nil {
		return fmt.Errorf("invalid website_id")
	}

	if !w.IsActive {
		return fmt.Errorf("website is inactive")
	}

	// Domain Validation
	if !s.websites.ValidateOriginDomain(origin, w.URL) {
		return fmt.Errorf("domain mismatch")
	}

	if !w.HeatmapEnabled {
		return fmt.Errorf("heatmap recording is disabled for this website")
	}

	return s.repo.RecordHeatmap(context.Background(), w.SiteID, req.Points)
}

type heatmapService struct {
	repo     repository.HeatmapRepository
	websites *websiteServicePkg.WebsiteService
}

func NewHeatmapService(repo repository.HeatmapRepository, websites *websiteServicePkg.WebsiteService) HeatmapService {
	return &heatmapService{
		repo:     repo,
		websites: websites,
	}
}

// validateOwnership ensures the website belongs to the user
func (s *heatmapService) validateOwnership(ctx context.Context, websiteID string, userID string) (string, error) {
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

func (s *heatmapService) GetHeatmapData(ctx context.Context, websiteID string, url string, heatmapType string, from, to time.Time, userID string) ([]models.HeatmapPoint, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetHeatmapData(ctx, canonicalID, url, heatmapType, from, to)
}

func (s *heatmapService) GetHeatmapPages(ctx context.Context, websiteID string, userID string) ([]string, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetHeatmapPages(ctx, canonicalID)
}
