package services

import (
	billingModels "analytics-app/internal/modules/billing/models"
	billingServicePkg "analytics-app/internal/modules/billing/services"
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

	// 1. Domain Validation
	if !s.websites.ValidateOriginDomain(origin, w.URL) {
		return fmt.Errorf("domain mismatch")
	}

	// 2. Feature Toggle Check
	if !w.HeatmapEnabled {
		return fmt.Errorf("heatmap recording is disabled for this website")
	}

	// 3. Billing Check - Count heatmaps as a separate resource check
	// We count a "session" of heatmap data as 1 toward the limit if it doesn't already exist for this URL
	// But simpler: Check if user plane allows heatmaps at all
	sub, err := s.billing.GetSubscription(context.Background(), w.UserID.String())
	if err != nil {
		return fmt.Errorf("failed to verify subscription")
	}

	plan := &billingModels.Plan{ID: billingModels.PlanStarter, MaxHeatmaps: 0}
	if sub != nil && sub.Plan != nil {
		plan = sub.Plan
	}

	if plan.MaxHeatmaps == 0 {
		return fmt.Errorf("heatmaps are not available on your current plan. please upgrade to enable this feature")
	}

	// If MaxHeatmaps > 0, we should ideally check how many unique URLs have heatmap data for this website
	if plan.MaxHeatmaps > 0 && len(req.Points) > 0 {
		count, _ := s.repo.CountHeatmapPages(context.Background(), w.SiteID)
		if count >= plan.MaxHeatmaps {
			// Check if the URL from the first point already exists
			url := req.Points[0].URL
			exists, _ := s.repo.HeatmapExistsForURL(context.Background(), w.SiteID, url)
			if !exists {
				return fmt.Errorf("heatmap limit reached for this website (%d/%d). please upgrade for more", count, plan.MaxHeatmaps)
			}
		}
	}

	return s.repo.RecordHeatmap(context.Background(), w.SiteID, req.Points)
}

type heatmapService struct {
	repo     repository.HeatmapRepository
	websites *websiteServicePkg.WebsiteService
	billing  *billingServicePkg.BillingService
}

func NewHeatmapService(repo repository.HeatmapRepository, websites *websiteServicePkg.WebsiteService, billing *billingServicePkg.BillingService) HeatmapService {
	return &heatmapService{
		repo:     repo,
		websites: websites,
		billing:  billing,
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
