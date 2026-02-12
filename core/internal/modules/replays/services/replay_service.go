package services

import (
	billingServicePkg "analytics-app/internal/modules/billing/services"
	"analytics-app/internal/modules/replays/models"
	"analytics-app/internal/modules/replays/repository"
	websiteServicePkg "analytics-app/internal/modules/websites/services"
	"analytics-app/internal/shared/storage"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
)

type ReplayService interface {
	RecordReplay(ctx context.Context, req models.RecordReplayRequest) error
	GetReplay(ctx context.Context, websiteID, sessionID string) ([]models.SessionReplayChunk, error)
	ListSessions(ctx context.Context, websiteID string) ([]models.ReplaySessionMetadata, error)
	DeleteReplay(ctx context.Context, websiteID, sessionID string) error
	GetPageSnapshot(ctx context.Context, websiteID, url string) (json.RawMessage, error)
}

type replayService struct {
	repo     repository.ReplayRepository
	websites *websiteServicePkg.WebsiteService
	billing  *billingServicePkg.BillingService
	store    *storage.S3Store
}

func NewReplayService(repo repository.ReplayRepository, websites *websiteServicePkg.WebsiteService, billing *billingServicePkg.BillingService, store *storage.S3Store) ReplayService {
	return &replayService{
		repo:     repo,
		websites: websites,
		billing:  billing,
		store:    store,
	}
}

func (s *replayService) RecordReplay(ctx context.Context, req models.RecordReplayRequest) error {
	// 1. Canonicalize WebsiteID
	website, err := s.websites.GetWebsiteByAnyID(ctx, req.WebsiteID)
	if err == nil {
		req.WebsiteID = website.SiteID

		// 1.1 Enforcement: Check limits on new session
		if req.Sequence == 0 {
			usage, usageErr := s.billing.GetUserSubscriptionData(ctx, website.UserID.String())
			if usageErr == nil {
				if !usage.Usage.Replays.CanCreate {
					return fmt.Errorf("session recording limit reached (%d/%d sessions). upgrade for more recordings",
						usage.Usage.Replays.Current, usage.Usage.Replays.Limit)
				}
			}
		}
	}

	// 2. Upload to S3
	data, err := json.Marshal(req.Events)
	if err != nil {
		return err
	}

	// Key format: replays/{website_id}/{session_id}/{sequence}.json
	key := fmt.Sprintf("replays/%s/%s/%d.json", req.WebsiteID, req.SessionID, req.Sequence)
	if err := s.store.Upload(ctx, key, bytes.NewReader(data)); err != nil {
		return fmt.Errorf("failed to upload to s3: %w", err)
	}

	// 3. Save reference to DB (empty data)
	// We need the record in DB for ordering and listing sessions
	return s.repo.SaveChunk(ctx, req.WebsiteID, req.SessionID, json.RawMessage("[]"), req.Sequence)
}

func (s *replayService) GetReplay(ctx context.Context, websiteID string, sessionID string) ([]models.SessionReplayChunk, error) {
	// Canonicalize WebsiteID
	website, err := s.websites.GetWebsiteByAnyID(ctx, websiteID)
	if err == nil {
		websiteID = website.SiteID
	}

	// 1. Get chunks metadata from DB to know sequences
	chunks, err := s.repo.GetChunks(ctx, websiteID, sessionID)
	if err != nil {
		return nil, err
	}

	// 2. Fetch data from S3 for each chunk
	// TODO: Optimize with parallel fetch
	for i, chunk := range chunks {
		key := fmt.Sprintf("replays/%s/%s/%d.json", websiteID, sessionID, chunk.Sequence)
		reader, err := s.store.Download(ctx, key)
		if err != nil {
			// Fallback: If S3 fails (or file missing during migration), check if DB has data
			if len(chunk.Data) > 2 { // "[]" is 2 bytes
				continue
			}
			return nil, fmt.Errorf("failed to fetch chunk %d: %w", chunk.Sequence, err)
		}
		defer reader.Close()

		data, err := io.ReadAll(reader)
		if err != nil {
			return nil, err
		}
		chunks[i].Data = json.RawMessage(data)
	}

	return chunks, nil
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
	// TODO: Delete from S3 as well
	return s.repo.DeleteSessionReplay(ctx, websiteID, sessionID)
}

func (s *replayService) GetPageSnapshot(ctx context.Context, websiteID string, url string) (json.RawMessage, error) {
	// Canonicalize WebsiteID
	website, err := s.websites.GetWebsiteByAnyID(ctx, websiteID)
	if err == nil {
		websiteID = website.SiteID
	}

	// 1. Find a session that visited this URL
	sessionID, err := s.repo.FindSessionIDForPage(ctx, websiteID, url)
	if err != nil {
		return nil, err
	}

	// 2. Fetch first chunk (sequence 0) from S3
	// Usually the first chunk contains the full snapshot
	key := fmt.Sprintf("replays/%s/%s/0.json", websiteID, sessionID)
	reader, err := s.store.Download(ctx, key)
	if err != nil {
		return nil, err
	}
	defer reader.Close()

	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, err
	}

	return json.RawMessage(data), nil
}
