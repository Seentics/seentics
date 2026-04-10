package services

import (
	"context"
	"fmt"
	"time"

	"github.com/Seentics/seentics/internal/modules/funnels/models"
	"github.com/Seentics/seentics/internal/modules/funnels/repository"
	"github.com/Seentics/seentics/internal/shared/cache"
	websiteServicePkg "github.com/Seentics/seentics/internal/modules/websites/services"

	"github.com/google/uuid"
)

const funnelActiveCacheTTL = 5 * time.Minute

type FunnelService struct {
	repo     *repository.FunnelRepository
	websites *websiteServicePkg.WebsiteService
	cache    *cache.Cache
}

func NewFunnelService(repo *repository.FunnelRepository, websites *websiteServicePkg.WebsiteService, c *cache.Cache) *FunnelService {
	return &FunnelService{repo: repo, websites: websites, cache: c}
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
	w, err := s.websites.GetWebsiteByID(ctx, websiteID)
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
	funnels, _, err := s.ListFunnelsPaginated(ctx, websiteID, userID, 0, 0)
	return funnels, err
}

// ListFunnelsPaginated retrieves funnels with pagination and enriched stats
func (s *FunnelService) ListFunnelsPaginated(ctx context.Context, websiteID string, userID string, limit, offset int) ([]models.Funnel, int, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, 0, err
	}
	funnels, total, err := s.repo.ListFunnelsPaginated(ctx, canonicalID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list funnels: %w", err)
	}
	if len(funnels) > 0 {
		funnelIDs := make([]string, len(funnels))
		for i := range funnels {
			funnelIDs[i] = funnels[i].ID
		}
		if statsMap, err := s.repo.GetBatchFunnelSummaryStats(ctx, funnelIDs); err == nil {
			for i := range funnels {
				if stats, ok := statsMap[funnels[i].ID]; ok {
					funnels[i].Stats = stats
				}
			}
		}
	}
	return funnels, total, nil
}

// GetActiveFunnels retrieves all active funnels for a website (public tracker endpoint).
// websiteID is the website UUID (same as dashboard / embed). Result is cached for 5 minutes; evicted on create/update/delete.
func (s *FunnelService) GetActiveFunnels(ctx context.Context, websiteID string, origin string) ([]models.Funnel, error) {
	w, err := s.websites.GetWebsiteByID(ctx, websiteID)
	if err != nil {
		return nil, fmt.Errorf("website not found")
	}
	if !s.websites.ValidateOriginDomain(origin, w.URL) {
		return nil, fmt.Errorf("domain mismatch")
	}
	if !w.FunnelEnabled {
		return []models.Funnel{}, nil
	}

	key := "funnel:active:" + w.SiteID
	var cached []models.Funnel
	if s.cache.Get(key, &cached) {
		return cached, nil
	}
	funnels, err := s.repo.GetActiveFunnels(ctx, w.SiteID)
	if err != nil {
		return nil, err
	}
	_ = s.cache.Set(key, funnels, funnelActiveCacheTTL)
	return funnels, nil
}

// TrackFunnelEvent processes a tracking event from the frontend (public)
func (s *FunnelService) TrackFunnelEvent(ctx context.Context, req *models.TrackFunnelEventRequest, origin string) error {
	w, err := s.websites.GetWebsiteByID(ctx, req.WebsiteID)
	if err != nil {
		return fmt.Errorf("website not found")
	}
	if !s.websites.ValidateOriginDomain(origin, w.URL) {
		return fmt.Errorf("domain mismatch")
	}
	if !w.FunnelEnabled {
		return fmt.Errorf("funnel tracking is disabled for this website")
	}
	return s.repo.TrackFunnelEvent(ctx, req)
}

// TrackFunnelEventBatch validates the website once then batch-inserts all events.
func (s *FunnelService) TrackFunnelEventBatch(ctx context.Context, siteID string, events []models.TrackFunnelEventRequest, origin string) error {
	if len(events) == 0 {
		return nil
	}
	w, err := s.websites.GetWebsiteByID(ctx, siteID)
	if err != nil {
		return fmt.Errorf("website not found")
	}
	if !s.websites.ValidateOriginDomain(origin, w.URL) {
		return fmt.Errorf("domain mismatch")
	}
	if !w.FunnelEnabled {
		return fmt.Errorf("funnel tracking is disabled for this website")
	}
	canonicalID := w.SiteID
	for i := range events {
		events[i].WebsiteID = canonicalID
	}
	return s.repo.BatchTrackFunnelEvents(ctx, events)
}

// GetFunnel retrieves a funnel by ID
func (s *FunnelService) GetFunnel(ctx context.Context, id string, userID string) (*models.Funnel, error) {
	funnel, err := s.repo.GetFunnelByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get funnel: %w", err)
	}
	if userID != "system" && funnel.UserID != userID {
		return nil, fmt.Errorf("unauthorized access to funnel")
	}
	if stats, err := s.GetFunnelStats(ctx, funnel.ID, funnel.WebsiteID, 30); err == nil {
		funnel.Stats = stats
	}
	return funnel, nil
}

// CreateFunnel creates a new funnel and evicts the active cache.
func (s *FunnelService) CreateFunnel(ctx context.Context, req *models.CreateFunnelRequest, websiteID, userID string) (*models.Funnel, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	funnel := &models.Funnel{
		WebsiteID: canonicalID, UserID: userID, Name: req.Name,
		Description: req.Description, IsActive: true, Steps: req.Steps,
	}
	if err := s.repo.CreateFunnel(ctx, funnel); err != nil {
		return nil, fmt.Errorf("failed to create funnel: %w", err)
	}
	s.cache.Delete("funnel:active:" + canonicalID)
	return s.repo.GetFunnelByID(ctx, funnel.ID)
}

// UpdateFunnel updates an existing funnel and evicts the active cache.
func (s *FunnelService) UpdateFunnel(ctx context.Context, id string, req *models.UpdateFunnelRequest, userID string) (*models.Funnel, error) {
	existing, err := s.GetFunnel(ctx, id, userID)
	if err != nil {
		return nil, err
	}
	if err := s.repo.UpdateFunnel(ctx, existing.ID, req); err != nil {
		return nil, fmt.Errorf("failed to update funnel: %w", err)
	}
	s.cache.Delete("funnel:active:" + existing.WebsiteID)
	return s.repo.GetFunnelByID(ctx, id)
}

// DeleteFunnel removes a funnel and evicts the active cache.
func (s *FunnelService) DeleteFunnel(ctx context.Context, id string, userID string) error {
	existing, err := s.GetFunnel(ctx, id, userID)
	if err != nil {
		return err
	}
	if err := s.repo.DeleteFunnel(ctx, id); err != nil {
		return err
	}
	s.cache.Delete("funnel:active:" + existing.WebsiteID)
	return nil
}

// DeleteFunnels removes multiple funnels and evicts the active cache for each website.
func (s *FunnelService) DeleteFunnels(ctx context.Context, ids []string, userID string) error {
	validIDs, err := s.repo.FilterIDsByUser(ctx, ids, userID)
	if err != nil || len(validIDs) == 0 {
		return err
	}
	// Collect websiteIDs for cache eviction before deletion
	websiteIDs := make(map[string]struct{})
	for _, id := range validIDs {
		if f, err := s.repo.GetFunnelByID(ctx, id); err == nil {
			websiteIDs[f.WebsiteID] = struct{}{}
		}
	}
	if err := s.repo.DeleteFunnels(ctx, validIDs); err != nil {
		return err
	}
	for wsID := range websiteIDs {
		s.cache.Delete("funnel:active:" + wsID)
	}
	return nil
}

// GetFunnelStats returns real-time performance stats for a funnel over the last `days` days.
func (s *FunnelService) GetFunnelStats(ctx context.Context, id string, websiteID string, days int) (*models.FunnelStats, error) {
	return s.repo.GetFunnelStats(ctx, id, websiteID, days)
}

// GetFunnelStatsForDashboard verifies ownership and returns stats for the given window.
func (s *FunnelService) GetFunnelStatsForDashboard(ctx context.Context, funnelID string, userID string, days int) (*models.FunnelStats, error) {
	funnel, err := s.repo.GetFunnelByID(ctx, funnelID)
	if err != nil {
		return nil, err
	}
	if userID != "system" && funnel.UserID != userID {
		return nil, fmt.Errorf("unauthorized access to funnel")
	}
	return s.repo.GetFunnelStats(ctx, funnelID, funnel.WebsiteID, days)
}
