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
	"time"

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
	GetReplayManifest(ctx context.Context, websiteID, sessionID, userID string) ([]int, error)
	GetReplayChunk(ctx context.Context, websiteID, sessionID, userID string, seq int) (json.RawMessage, error)
	// ListSessions returns sessions ordered by start_time DESC, before the optional cursor time.
	// Returns the page of sessions, the total session count for the website, and any error.
	ListSessions(ctx context.Context, websiteID, userID string, limit int, before *time.Time) ([]models.ReplaySessionMetadata, int64, error)
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

	// 3. Global quota enforcement: count sessions across ALL websites of this user,
	// not just the current one — prevents limit bypass via multiple websites.
	if limit, ok := ctx.Value("max_replays").(int); ok && limit > 0 {
		// Only check quota for NEW sessions; existing sessions always get more chunks.
		exists, err := s.repo.SessionExists(ctx, req.WebsiteID, req.SessionID)
		if err != nil {
			return fmt.Errorf("failed to check session existence: %w", err)
		}

		if !exists {
			count, err := s.repo.CountSessionsForUser(ctx, website.UserID)
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

	// 5. Save reference row in DB.
	// Browser/Device/OS/Country are stored on every chunk for resilience (so metadata
	// is available even if sequence=0 is missing). EntryPage is ONLY stored on sequence=0
	// to correctly capture the landing page, not a later navigated page.
	browser, device, osName := parseUA(userAgent)
	meta := &models.SessionMeta{
		Browser: browser,
		Device:  device,
		OS:      osName,
		Country: country,
	}
	if req.Sequence == 0 {
		meta.EntryPage = req.Page
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

			key := fmt.Sprintf("replays/%s/%s/%d.json.gz", websiteID, sessionID, seq)
			reader, dlErr := s.store.Download(ctx, key)

			if dlErr != nil {
				key = fmt.Sprintf("replays/%s/%s/%d.json", websiteID, sessionID, seq)
				reader, dlErr = s.store.Download(ctx, key)
			}

			if dlErr != nil {
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

// GetReplayManifest returns the ordered list of chunk sequence numbers for a session
// by reading Postgres only — no S3 download.
func (s *replayService) GetReplayManifest(ctx context.Context, websiteID, sessionID, userID string) ([]int, error) {
	siteID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetChunkSequences(ctx, siteID, sessionID)
}

// GetReplayChunk downloads and decompresses exactly one chunk from S3.
func (s *replayService) GetReplayChunk(ctx context.Context, websiteID, sessionID, userID string, seq int) (json.RawMessage, error) {
	siteID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}

	key := fmt.Sprintf("replays/%s/%s/%d.json.gz", siteID, sessionID, seq)
	reader, dlErr := s.store.Download(ctx, key)
	if dlErr != nil {
		key = fmt.Sprintf("replays/%s/%s/%d.json", siteID, sessionID, seq)
		reader, dlErr = s.store.Download(ctx, key)
	}
	if dlErr != nil {
		return nil, fmt.Errorf("chunk %d not found", seq)
	}
	defer reader.Close()

	var finalReader io.Reader = reader
	if strings.HasSuffix(key, ".gz") {
		gzr, err := gzip.NewReader(reader)
		if err != nil {
			return nil, fmt.Errorf("failed to decompress chunk %d: %w", seq, err)
		}
		defer gzr.Close()
		finalReader = gzr
	}

	raw, err := io.ReadAll(finalReader)
	if err != nil {
		return nil, fmt.Errorf("failed to read chunk %d: %w", seq, err)
	}
	return json.RawMessage(raw), nil
}

func (s *replayService) ListSessions(ctx context.Context, websiteID, userID string, limit int, before *time.Time) ([]models.ReplaySessionMetadata, int64, error) {
	siteID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, 0, err
	}
	return s.repo.ListSessionsWithMetadata(ctx, siteID, limit, before)
}

func (s *replayService) DeleteReplay(ctx context.Context, websiteID string, sessionID string, userID string) error {
	siteID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return err
	}

	keys, err := s.repo.DeleteSessionReplay(ctx, siteID, sessionID)
	if err != nil {
		return err
	}

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

	key := fmt.Sprintf("replays/%s/%s/0.json.gz", websiteID, sessionID)
	reader, err := s.store.Download(ctx, key)
	if err != nil {
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
