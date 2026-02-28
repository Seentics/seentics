package services

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"sync"

	"github.com/Seentics/seentics/internal/modules/replays/models"
	"github.com/Seentics/seentics/internal/modules/replays/repository"
	websiteServicePkg "github.com/Seentics/seentics/internal/modules/websites/services"
	"github.com/Seentics/seentics/internal/shared/storage"
	"github.com/Seentics/seentics/internal/shared/utils"

	"github.com/google/uuid"
)

type ReplayService interface {
	RecordReplay(ctx context.Context, req models.RecordReplayRequest, origin, userAgent, country string) error
	GetReplay(ctx context.Context, websiteID, sessionID, userID string) ([]models.SessionReplayChunk, error)
	ListSessions(ctx context.Context, websiteID, userID string, limit, offset int) ([]models.ReplaySessionMetadata, error)
	DeleteReplay(ctx context.Context, websiteID, sessionID, userID string) error
	BulkDeleteReplays(ctx context.Context, websiteID string, sessionIDs []string, userID string) error
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
	uaInfo := utils.ParseUserAgent(uaStr)
	return uaInfo.Browser, uaInfo.Device, uaInfo.OS
}

// validateOwnership resolves the website and checks that userID is the owner.
// Returns the canonical SiteID on success.
func (s *replayService) validateOwnership(ctx context.Context, websiteID, userID string) (string, error) {
	website, err := s.websites.GetWebsiteByAnyID(ctx, websiteID)
	if err != nil {
		return "", fmt.Errorf("website not found")
	}
	parsedUserID, err := uuid.Parse(userID)
	if err != nil {
		return "", fmt.Errorf("unauthorized")
	}
	if website.UserID != parsedUserID {
		return "", fmt.Errorf("unauthorized")
	}
	return website.SiteID, nil
}

func (s *replayService) RecordReplay(ctx context.Context, req models.RecordReplayRequest, origin, userAgent, country string) error {
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

	// 3. Quota Enforcement (Enterprise Mode)
	if limit, ok := ctx.Value("max_replays").(int); ok && limit > 0 {
		// Check if this session_id already exists in the database.
		// If yes, we allow recording to it regardless of the limit.
		// If NO, we check if we are at the limit.
		exists, err := s.repo.SessionExists(ctx, req.WebsiteID, req.SessionID)
		if err != nil {
			return fmt.Errorf("failed to check session existence: %w", err)
		}

		if !exists {
			// Count total unique sessions for this website (or user? usually it's per website in OSS, global in usage view)
			// The user view shows "1 of 100" global. So we should probably count global for the user.
			// But for simplicity of core service, let's count per website if it's OSS, or just follow the context.

			// Actually, the billing service counts global across all websites of the user.
			// But the core service doesn't easily know all other websites of the user here without more calls.

			// Let's just check the current website's count for now as a first-line defense.
			count, err := s.repo.CountSessions(ctx, req.WebsiteID)
			if err == nil && count >= int64(limit) {
				return fmt.Errorf("recording limit reached (%d/%d). cannot start new sessions", count, limit)
			}
		}
	}

	// 4. Upload events to S3 with Gzip compression
	data, err := json.Marshal(req.Events)
	if err != nil {
		return err
	}

	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	if _, err := gz.Write(data); err != nil {
		return fmt.Errorf("failed to compress events: %w", err)
	}
	if err := gz.Close(); err != nil {
		return fmt.Errorf("failed to close gzip writer: %w", err)
	}

	key := fmt.Sprintf("replays/%s/%s/%d.json.gz", req.WebsiteID, req.SessionID, req.Sequence)
	if err := s.store.Upload(ctx, key, bytes.NewReader(buf.Bytes())); err != nil {
		return fmt.Errorf("failed to upload to s3: %w", err)
	}

	// 4. Save reference row in DB
	// We capture metadata on every chunk to ensure it's available even if sequence 0 is missing.
	browser, device, osName := parseUA(userAgent)
	meta := &models.SessionMeta{
		Browser:   browser,
		Device:    device,
		OS:        osName,
		Country:   country,
		EntryPage: req.Page,
	}

	return s.repo.SaveChunk(ctx, req.WebsiteID, req.SessionID, json.RawMessage("[]"), req.Sequence, meta)
}

func (s *replayService) GetReplay(ctx context.Context, websiteID string, sessionID string, userID string) ([]models.SessionReplayChunk, error) {
	siteID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	websiteID = siteID

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

			// Try gzipped key first
			key := fmt.Sprintf("replays/%s/%s/%d.json.gz", websiteID, sessionID, seq)
			reader, dlErr := s.store.Download(ctx, key)

			// Legacy fallback: try non-gzipped key
			if dlErr != nil {
				key = fmt.Sprintf("replays/%s/%s/%d.json", websiteID, sessionID, seq)
				reader, dlErr = s.store.Download(ctx, key)
			}

			if dlErr != nil {
				// Fallback: use data stored in DB if the S3 object is missing (migration period)
				if len(dbData) > 2 {
					results[idx] = result{index: idx, data: dbData}
					return
				}
				results[idx] = result{index: idx, err: fmt.Errorf("failed to fetch chunk %d: %w", seq, dlErr)}
				return
			}
			defer reader.Close()

			var finalReader io.Reader = reader
			if strings.HasSuffix(key, ".gz") {
				gzr, err := gzip.NewReader(reader)
				if err != nil {
					results[idx] = result{index: idx, err: fmt.Errorf("failed to create gzip reader: %w", err)}
					return
				}
				defer gzr.Close()
				finalReader = gzr
			}

			raw, readErr := io.ReadAll(finalReader)
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

func (s *replayService) ListSessions(ctx context.Context, websiteID, userID string, limit, offset int) ([]models.ReplaySessionMetadata, error) {
	siteID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.ListSessionsWithMetadata(ctx, siteID, limit, offset)
}

func (s *replayService) DeleteReplay(ctx context.Context, websiteID string, sessionID string, userID string) error {
	siteID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return err
	}

	// Repo returns S3 keys to clean up
	keys, err := s.repo.DeleteSessionReplay(ctx, siteID, sessionID)
	if err != nil {
		return err
	}

	// Delete S3 objects in parallel; non-fatal if individual deletes fail
	s.deleteS3KeysParallel(ctx, keys)

	return nil
}

func (s *replayService) BulkDeleteReplays(ctx context.Context, websiteID string, sessionIDs []string, userID string) error {
	siteID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return err
	}

	keys, err := s.repo.BulkDeleteReplays(ctx, siteID, sessionIDs)
	if err != nil {
		return err
	}

	s.deleteS3KeysParallel(ctx, keys)
	return nil
}

// deleteS3KeysParallel deletes S3 objects concurrently. Failures are non-fatal.
func (s *replayService) deleteS3KeysParallel(ctx context.Context, keys []string) {
	if len(keys) == 0 {
		return
	}
	var wg sync.WaitGroup
	for _, key := range keys {
		wg.Add(1)
		go func(k string) {
			defer wg.Done()
			_ = s.store.Delete(ctx, k)
		}(key)
	}
	wg.Wait()
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

	// Try gzipped first for snapshot
	key := fmt.Sprintf("replays/%s/%s/0.json.gz", websiteID, sessionID)
	reader, err := s.store.Download(ctx, key)
	if err != nil {
		// Fallback to non-gzipped
		key = fmt.Sprintf("replays/%s/%s/0.json", websiteID, sessionID)
		reader, err = s.store.Download(ctx, key)
	}

	if err != nil {
		return nil, err
	}
	defer reader.Close()

	var finalReader io.Reader = reader
	if strings.HasSuffix(key, ".gz") {
		gzr, err := gzip.NewReader(reader)
		if err != nil {
			return nil, err
		}
		defer gzr.Close()
		finalReader = gzr
	}

	data, err := io.ReadAll(finalReader)
	if err != nil {
		return nil, err
	}

	return json.RawMessage(data), nil
}
