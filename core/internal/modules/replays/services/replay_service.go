package services

import (
	"analytics-app/internal/modules/replays/models"
	"analytics-app/internal/modules/replays/repository"
	websiteServicePkg "analytics-app/internal/modules/websites/services"
	"analytics-app/internal/shared/storage"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"sync"

	"github.com/mssola/user_agent"
)

type ReplayService interface {
	RecordReplay(ctx context.Context, req models.RecordReplayRequest, origin, userAgent string) error
	GetReplay(ctx context.Context, websiteID, sessionID string) ([]models.SessionReplayChunk, error)
	ListSessions(ctx context.Context, websiteID string) ([]models.ReplaySessionMetadata, error)
	DeleteReplay(ctx context.Context, websiteID, sessionID string) error
	GetPageSnapshot(ctx context.Context, websiteID, url string) (json.RawMessage, error)
}

type replayService struct {
	repo     repository.ReplayRepository
	websites *websiteServicePkg.WebsiteService
	store    *storage.S3Store
}

func NewReplayService(repo repository.ReplayRepository, websites *websiteServicePkg.WebsiteService, store *storage.S3Store) ReplayService {
	return &replayService{
		repo:     repo,
		websites: websites,
		store:    store,
	}
}

// parseUA extracts browser, device type, and OS from a User-Agent string.
func parseUA(uaStr string) (browser, device, os string) {
	ua := user_agent.New(uaStr)

	name, _ := ua.Browser()
	browser = name
	if browser == "" {
		browser = "Unknown"
	}

	os = ua.OS()
	if os == "" {
		os = "Unknown"
	}

	switch {
	case ua.Mobile():
		device = "Mobile"
	case strings.Contains(uaStr, "iPad") || strings.Contains(strings.ToLower(uaStr), "tablet"):
		device = "Tablet"
	default:
		device = "Desktop"
	}

	return
}

func (s *replayService) RecordReplay(ctx context.Context, req models.RecordReplayRequest, origin, userAgent string) error {
	// 1. Validate website
	website, err := s.websites.GetWebsiteByAnyID(ctx, req.WebsiteID)
	if err != nil {
		return fmt.Errorf("invalid website_id: %s", req.WebsiteID)
	}

	if !website.IsActive {
		return fmt.Errorf("website is inactive: %s", req.WebsiteID)
	}

	// 2. Origin domain validation
	if !s.websites.ValidateOriginDomain(origin, website.URL) {
		return fmt.Errorf("domain mismatch: origin=%s, expected=%s", origin, website.URL)
	}

	// Canonicalize website ID
	req.WebsiteID = website.SiteID

	// 3. Upload events to S3
	data, err := json.Marshal(req.Events)
	if err != nil {
		return err
	}

	key := fmt.Sprintf("replays/%s/%s/%d.json", req.WebsiteID, req.SessionID, req.Sequence)
	if err := s.store.Upload(ctx, key, bytes.NewReader(data)); err != nil {
		return fmt.Errorf("failed to upload to s3: %w", err)
	}

	// 4. Save reference row in DB
	// For the first chunk, parse the User-Agent and store session metadata.
	var meta *models.SessionMeta
	if req.Sequence == 0 {
		browser, device, osName := parseUA(userAgent)
		meta = &models.SessionMeta{
			Browser:   browser,
			Device:    device,
			OS:        osName,
			Country:   "Unknown", // IP geo-lookup not implemented yet
			EntryPage: req.Page,
		}
	}

	return s.repo.SaveChunk(ctx, req.WebsiteID, req.SessionID, json.RawMessage("[]"), req.Sequence, meta)
}

func (s *replayService) GetReplay(ctx context.Context, websiteID string, sessionID string) ([]models.SessionReplayChunk, error) {
	website, err := s.websites.GetWebsiteByAnyID(ctx, websiteID)
	if err == nil {
		websiteID = website.SiteID
	}

	chunks, err := s.repo.GetChunks(ctx, websiteID, sessionID)
	if err != nil {
		return nil, err
	}

	// Fetch all S3 chunks in parallel
	type result struct {
		index int
		data  json.RawMessage
		err   error
	}

	results := make([]result, len(chunks))
	var wg sync.WaitGroup

	for i, chunk := range chunks {
		wg.Add(1)
		go func(idx, seq int, dbData json.RawMessage) {
			defer wg.Done()
			key := fmt.Sprintf("replays/%s/%s/%d.json", websiteID, sessionID, seq)
			reader, dlErr := s.store.Download(ctx, key)
			if dlErr != nil {
				// Fallback: use data stored in DB if the S3 object is missing (migration period)
				if len(dbData) > 2 {
					results[idx] = result{index: idx, data: dbData}
					return
				}
				results[idx] = result{index: idx, err: fmt.Errorf("failed to fetch chunk %d: %w", seq, dlErr)}
				return
			}
			raw, readErr := io.ReadAll(reader)
			reader.Close()
			if readErr != nil {
				results[idx] = result{index: idx, err: readErr}
				return
			}
			results[idx] = result{index: idx, data: json.RawMessage(raw)}
		}(i, chunk.Sequence, chunk.Data)
	}

	wg.Wait()

	for _, r := range results {
		if r.err != nil {
			return nil, r.err
		}
		chunks[r.index].Data = r.data
	}

	return chunks, nil
}

func (s *replayService) ListSessions(ctx context.Context, websiteID string) ([]models.ReplaySessionMetadata, error) {
	website, err := s.websites.GetWebsiteByAnyID(ctx, websiteID)
	if err == nil {
		websiteID = website.SiteID
	}
	return s.repo.ListSessionsWithMetadata(ctx, websiteID)
}

func (s *replayService) DeleteReplay(ctx context.Context, websiteID string, sessionID string) error {
	website, err := s.websites.GetWebsiteByAnyID(ctx, websiteID)
	if err == nil {
		websiteID = website.SiteID
	}

	// Repo returns S3 keys to clean up
	keys, err := s.repo.DeleteSessionReplay(ctx, websiteID, sessionID)
	if err != nil {
		return err
	}

	// Delete S3 objects; non-fatal if individual deletes fail
	for _, key := range keys {
		_ = s.store.Delete(ctx, key)
	}

	return nil
}

func (s *replayService) GetPageSnapshot(ctx context.Context, websiteID string, url string) (json.RawMessage, error) {
	website, err := s.websites.GetWebsiteByAnyID(ctx, websiteID)
	if err == nil {
		websiteID = website.SiteID
	}

	sessionID, err := s.repo.FindSessionIDForPage(ctx, websiteID, url)
	if err != nil {
		return nil, err
	}

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
