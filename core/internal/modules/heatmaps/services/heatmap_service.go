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
	GetHeatmapData(ctx context.Context, websiteID string, url string, heatmapType string, deviceType string, from, to time.Time, userID string) ([]models.HeatmapPoint, error)
	GetHeatmapPages(ctx context.Context, websiteID string, userID string) ([]models.HeatmapPageStat, error)
	GetTrackedURLs(ctx context.Context, websiteID string) ([]string, error)
	GetTopElements(ctx context.Context, websiteID string, url string, eventType string, from, to time.Time, userID string) ([]models.TopElement, error)
	DeleteHeatmapPage(ctx context.Context, websiteID string, url string, userID string) error
	BulkDeleteHeatmapPages(ctx context.Context, websiteID string, urls []string, userID string) error
}

func (s *heatmapService) RecordHeatmapData(req models.HeatmapRecordRequest, origin string) error {
	// Validate website existence
	w, err := s.websites.GetWebsiteByAnyID(context.Background(), req.WebsiteID)
	if err != nil {
		return fmt.Errorf("invalid website_id: %s", req.WebsiteID)
	}

	if !w.IsActive {
		return fmt.Errorf("website is inactive: %s", req.WebsiteID)
	}

	// 1. Domain Validation
	if !s.websites.ValidateOriginDomain(origin, w.URL) {
		return fmt.Errorf("domain mismatch: origin=%s, expected=%s", origin, w.URL)
	}

	// 2. Feature Toggle Check - Only check if explicitly disabled (manual override)
	if !w.HeatmapEnabled {
		return fmt.Errorf("heatmap recording is manually disabled for this website. enable it in settings")
	}

	return s.repo.RecordHeatmap(context.Background(), w.ID.String(), req.Points)
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

// validateOwnership ensures the website belongs to the user and returns (canonicalUUID, siteID, error)
func (s *heatmapService) validateOwnership(ctx context.Context, websiteID string, userID string) (string, string, error) {
	if userID == "" {
		return "", "", fmt.Errorf("user_id is required")
	}

	uid, err := uuid.Parse(userID)
	if err != nil {
		return "", "", fmt.Errorf("invalid user_id format")
	}

	w, err := s.websites.GetWebsiteByAnyID(ctx, websiteID)
	if err != nil {
		return "", "", fmt.Errorf("website not found")
	}

	if w.UserID != uid {
		return "", "", fmt.Errorf("unauthorized access to website data")
	}

	return w.ID.String(), w.SiteID, nil
}

func (s *heatmapService) GetHeatmapData(ctx context.Context, websiteID string, url string, heatmapType string, deviceType string, from, to time.Time, userID string) ([]models.HeatmapPoint, error) {
	canonicalID, _, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetHeatmapData(ctx, canonicalID, url, heatmapType, deviceType, from, to)
}

func (s *heatmapService) GetHeatmapPages(ctx context.Context, websiteID string, userID string) ([]models.HeatmapPageStat, error) {
	canonicalID, _, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetHeatmapPages(ctx, canonicalID)
}

func (s *heatmapService) GetTrackedURLs(ctx context.Context, websiteID string) ([]string, error) {
	// Note: We don't use validateOwnership here because this is called by the internal WebsiteService
	// for the tracker config, which already has the website object.
	return s.repo.GetTrackedURLs(ctx, websiteID)
}

func (s *heatmapService) GetTopElements(ctx context.Context, websiteID string, url string, eventType string, from, to time.Time, userID string) ([]models.TopElement, error) {
	canonicalID, _, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetTopElements(ctx, canonicalID, url, eventType, from, to)
}

func (s *heatmapService) DeleteHeatmapPage(ctx context.Context, websiteID string, url string, userID string) error {
	canonicalID, _, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return err
	}
	return s.repo.DeleteHeatmapPage(ctx, canonicalID, url)
}

func (s *heatmapService) BulkDeleteHeatmapPages(ctx context.Context, websiteID string, urls []string, userID string) error {
	canonicalID, _, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return err
	}
	return s.repo.BulkDeleteHeatmapPages(ctx, canonicalID, urls)
}
