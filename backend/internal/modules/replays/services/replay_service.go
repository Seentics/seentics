package services

import (
	billingServicePkg "analytics-app/internal/modules/billing/services"
	"analytics-app/internal/modules/replays/models"
	"analytics-app/internal/modules/replays/repository"
	websiteServicePkg "analytics-app/internal/modules/websites/services"
	"context"
	"encoding/json"
	"fmt"
)

type ReplayService interface {
	RecordReplay(ctx context.Context, req models.RecordReplayRequest) error
	GetReplay(ctx context.Context, websiteID, sessionID string) ([]models.SessionReplayChunk, error)
	ListSessions(ctx context.Context, websiteID string) ([]models.ReplaySessionMetadata, error)
	DeleteReplay(ctx context.Context, websiteID, sessionID string) error
}

type replayService struct {
	repo     repository.ReplayRepository
	websites *websiteServicePkg.WebsiteService
	billing  *billingServicePkg.BillingService
}

func NewReplayService(repo repository.ReplayRepository, websites *websiteServicePkg.WebsiteService, billing *billingServicePkg.BillingService) ReplayService {
	return &replayService{
		repo:     repo,
		websites: websites,
		billing:  billing,
	}
}

func (s *replayService) RecordReplay(ctx context.Context, req models.RecordReplayRequest) error {
	// 1. Canonicalize WebsiteID to ensure it matches the 24-char SiteID used in analytics events
	// This is critical for metadata joins (browser, country, etc.)
	// We use GetWebsiteByAnyID to handle both SiteID and internal UUID
	website, err := s.websites.GetWebsiteByAnyID(ctx, req.WebsiteID)
	if err == nil {
		req.WebsiteID = website.SiteID

		// 1.1 Enforcement: Check limits on new session (sequence == 0)
		if req.Sequence == 0 {
			usage, usageErr := s.billing.GetUserSubscriptionData(ctx, website.UserID.String())
			if usageErr == nil {
				// We check if the user can create more replays
				if !usage.Usage.Replays.CanCreate {
					return fmt.Errorf("session recording limit reached (%d/%d sessions). upgrade for more recordings",
						usage.Usage.Replays.Current, usage.Usage.Replays.Limit)
				}
			}
		}
	}

	// 2. Group events into a single JSON array for storage efficiency
	data, err := json.Marshal(req.Events)
	if err != nil {
		return err
	}

	return s.repo.SaveChunk(ctx, req.WebsiteID, req.SessionID, data, req.Sequence)
}

func (s *replayService) GetReplay(ctx context.Context, websiteID string, sessionID string) ([]models.SessionReplayChunk, error) {
	// Canonicalize WebsiteID
	website, err := s.websites.GetWebsiteByAnyID(ctx, websiteID)
	if err == nil {
		websiteID = website.SiteID
	}
	return s.repo.GetChunks(ctx, websiteID, sessionID)
}

func (s *replayService) ListSessions(ctx context.Context, websiteID string) ([]models.ReplaySessionMetadata, error) {
	// Canonicalize WebsiteID
	website, err := s.websites.GetWebsiteByAnyID(ctx, websiteID)
	if err == nil {
		websiteID = website.SiteID
	}
	return s.repo.ListSessionsWithMetadata(ctx, websiteID)
}

func (s *replayService) DeleteReplay(ctx context.Context, websiteID string, sessionID string) error {
	// Canonicalize WebsiteID
	website, err := s.websites.GetWebsiteByAnyID(ctx, websiteID)
	if err == nil {
		websiteID = website.SiteID
	}
	return s.repo.DeleteSessionReplay(ctx, websiteID, sessionID)
}
