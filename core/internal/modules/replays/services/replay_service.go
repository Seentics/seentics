package services

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/Seentics/seentics/internal/modules/replays/models"
	"github.com/Seentics/seentics/internal/modules/replays/repository"
	websiteServicePkg "github.com/Seentics/seentics/internal/modules/websites/services"
	"github.com/Seentics/seentics/internal/shared/cache"
	"github.com/Seentics/seentics/internal/shared/storage"
	"github.com/Seentics/seentics/internal/shared/utils"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

type ReplayService interface {
	RecordReplay(ctx context.Context, req models.RecordReplayRequest, origin, userAgent, country string) error
	GetReplay(ctx context.Context, websiteID, sessionID, userID string) ([]models.SessionReplayChunk, error)
	GetReplayManifest(ctx context.Context, websiteID, sessionID, userID string) ([]int, error)
	GetReplayChunk(ctx context.Context, websiteID, sessionID, userID string, seq int) (json.RawMessage, error)
	// GetFullReplay downloads all chunks concurrently, merges and sorts events by
	// timestamp, and returns a single flat JSON array ready for rrweb player.
	GetFullReplay(ctx context.Context, websiteID, sessionID, userID string) (json.RawMessage, error)
	// GetPresignedManifest checks for a cached full.json.gz in S3 and returns a
	// presigned URL so the browser can download directly (no API proxy). Falls back
	// to stitching all chunks when the cache does not exist yet, then saves and
	// returns a presigned URL. Individual chunk presigned URLs are included as
	// well so the caller can implement streaming if desired.
	GetPresignedManifest(ctx context.Context, websiteID, sessionID, userID string) (*models.PresignedManifest, error)
	// ListSessions returns sessions ordered by start_time DESC, before the optional cursor time.
	// Returns the page of sessions, the total session count for the website, and any error.
	ListSessions(ctx context.Context, websiteID, userID string, limit int, before *time.Time) ([]models.ReplaySessionMetadata, int64, error)
	DeleteReplay(ctx context.Context, websiteID, sessionID, userID string) error
	BulkDeleteReplays(ctx context.Context, websiteID string, sessionIDs []string, userID string) error
	GetPageSnapshot(ctx context.Context, websiteID, url string) (json.RawMessage, error)
	// StartRageClickWorker launches a background goroutine that periodically scans
	// recently-finished sessions for rage clicks and updates the DB.
	StartRageClickWorker(ctx context.Context)
	// StartCacheWarmer proactively warms the session list cache for all active
	// websites so that the very first visit to the sessions page is instant.
	StartCacheWarmer(ctx context.Context)
}

type replayService struct {
	repo     repository.ReplayRepository
	websites *websiteServicePkg.WebsiteService
	store    *storage.S3Store
	logger   zerolog.Logger
	cache    *cache.Cache
	// newSessionMu is the fallback in-process lock when Redis is unavailable.
	newSessionMu sync.Map // key: userID string → *sync.Mutex
}

func (s *replayService) getUserMutex(userID uuid.UUID) *sync.Mutex {
	mu, _ := s.newSessionMu.LoadOrStore(userID.String(), &sync.Mutex{})
	return mu.(*sync.Mutex)
}

// sessionKnown checks if a session exists in Redis SET (O(1)),
// falling back to DB query if Redis is unavailable.
func (s *replayService) sessionKnown(ctx context.Context, websiteID, sessionID string) (bool, error) {
	if s.cache != nil {
		setKey := fmt.Sprintf("replay:sessions:%s", websiteID)
		if s.cache.SIsMember(setKey, sessionID) {
			return true, nil
		}
	}
	return s.repo.SessionExists(ctx, websiteID, sessionID)
}

// markSessionKnown adds a session to the Redis SET so future chunk uploads skip the DB query.
func (s *replayService) markSessionKnown(websiteID, sessionID string) {
	if s.cache != nil {
		setKey := fmt.Sprintf("replay:sessions:%s", websiteID)
		s.cache.SAdd(setKey, 24*time.Hour, sessionID)
	}
}

func NewReplayService(repo repository.ReplayRepository, websites *websiteServicePkg.WebsiteService, store *storage.S3Store, logger zerolog.Logger, appCache ...*cache.Cache) ReplayService {
	svc := &replayService{
		repo:     repo,
		websites: websites,
		store:    store,
		logger:   logger,
	}
	if len(appCache) > 0 {
		svc.cache = appCache[0]
	}
	return svc
}

// countSessionsCached returns the global session count for a user, backed by Redis
// with a 5-minute TTL so the expensive COUNT(DISTINCT) + JOIN only runs once per window.
func (s *replayService) countSessionsCached(ctx context.Context, userID uuid.UUID) (int64, error) {
	cacheKey := fmt.Sprintf("replay:count:user:%s", userID.String())
	if s.cache != nil {
		var cached int64
		if s.cache.Get(cacheKey, &cached) {
			return cached, nil
		}
	}
	count, err := s.repo.CountSessionsForUser(ctx, userID)
	if err != nil {
		return 0, err
	}
	if s.cache != nil {
		_ = s.cache.Set(cacheKey, count, 5*time.Minute)
	}
	return count, nil
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

	// 3. Global quota enforcement
	if limit, ok := ctx.Value("max_replays").(int); ok && limit > 0 {
		exists, err := s.sessionKnown(ctx, req.WebsiteID, req.SessionID)
		if err != nil {
			return fmt.Errorf("failed to check session existence: %w", err)
		}

		if !exists {
			// Distributed lock (Redis) with in-process fallback
			lockKey := fmt.Sprintf("lock:replay:%s", website.UserID.String())
			usedDistLock := false
			if s.cache != nil {
				if s.cache.AcquireLock(lockKey, 10*time.Second) {
					usedDistLock = true
					defer s.cache.ReleaseLock(lockKey)
				}
			}
			if !usedDistLock {
				mu := s.getUserMutex(website.UserID)
				mu.Lock()
				defer mu.Unlock()
			}

			// Double-check after acquiring lock
			exists, err = s.sessionKnown(ctx, req.WebsiteID, req.SessionID)
			if err != nil {
				return fmt.Errorf("failed to check session existence: %w", err)
			}
			if !exists {
				count, err := s.countSessionsCached(ctx, website.UserID)
				if err == nil && count >= int64(limit) {
					return fmt.Errorf("recording limit reached (%d/%d). cannot start new sessions", count, limit)
				}
			}
		}
	}

	// 4. Upload events to S3 with Gzip compression + proper Content headers
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
	// Use UploadCompressed so presigned URLs serve browser-decompressible content
	if err := s.store.UploadCompressed(ctx, key, bytes.NewReader(buf.Bytes())); err != nil {
		return fmt.Errorf("failed to upload to s3: %w", err)
	}

	// 5. Save reference row in DB.
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

	if err := s.repo.SaveChunk(ctx, req.WebsiteID, req.SessionID, json.RawMessage("[]"), req.Sequence, meta); err != nil {
		return err
	}

	// Mark session known in Redis so future chunks skip the DB query
	s.markSessionKnown(req.WebsiteID, req.SessionID)

	// Bump cached user session count so quota stays accurate without DB round-trip
	if req.Sequence == 0 && s.cache != nil {
		countKey := fmt.Sprintf("replay:count:user:%s", website.UserID.String())
		s.cache.Incr(countKey, 1)
	}
	return nil
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

// GetFullReplay downloads all chunks for a session concurrently, merges all
// rrweb events into one sorted array, and returns it as a flat JSON array.
// After stitching, the result is cached in S3 as full.json.gz so subsequent
// calls are a single fast GET instead of N concurrent downloads + merge.
func (s *replayService) GetFullReplay(ctx context.Context, websiteID, sessionID, userID string) (json.RawMessage, error) {
	siteID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}

	merged, err := s.stitchOrCache(ctx, siteID, sessionID)
	if err != nil {
		return nil, err
	}
	return json.RawMessage(merged), nil
}

// GetPresignedManifest ensures the full-replay cache exists in S3 (stitching if
// necessary) then returns a presigned URL the browser can use to download the
// event array directly — no API proxy, no double bandwidth.
func (s *replayService) GetPresignedManifest(ctx context.Context, websiteID, sessionID, userID string) (*models.PresignedManifest, error) {
	siteID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}

	const urlLifetime = time.Hour

	// Always return per-chunk presigned URLs so the frontend can start
	// playback immediately from chunk 0 while fetching the rest in background.
	seqs, err := s.repo.GetChunkSequences(ctx, siteID, sessionID)
	if err != nil {
		return nil, err
	}
	if len(seqs) == 0 {
		return &models.PresignedManifest{ExpiresAt: time.Now().Add(urlLifetime)}, nil
	}

	chunks := make([]models.PresignedChunk, 0, len(seqs))
	for _, seq := range seqs {
		key := fmt.Sprintf("replays/%s/%s/%d.json.gz", siteID, sessionID, seq)
		url, err := s.store.GetPresignedURL(ctx, key, urlLifetime)
		if err != nil {
			continue
		}
		chunks = append(chunks, models.PresignedChunk{Seq: seq, URL: url})
	}

	manifest := &models.PresignedManifest{
		Chunks:      chunks,
		TotalChunks: len(seqs),
		ExpiresAt:   time.Now().Add(urlLifetime),
	}

	// If the stitched full cache exists, include that URL too — the frontend
	// can use it as a fast single-download alternative for short sessions.
	cacheKey := fmt.Sprintf("replays/%s/%s/full.json.gz", siteID, sessionID)
	if s.store.Exists(ctx, cacheKey) {
		if fullURL, err := s.store.GetPresignedURL(ctx, cacheKey, urlLifetime); err == nil {
			manifest.FullURL = fullURL
		}
	} else {
		// Stitch in background so it's ready for next visit.
		go func() {
			bgCtx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
			defer cancel()
			_, _ = s.stitchOrCache(bgCtx, siteID, sessionID)
		}()
	}

	return manifest, nil
}

// stitchOrCache downloads all chunks concurrently, merges + sorts events, saves
// the result as full.json.gz (with browser-decompressible headers), and returns
// the merged JSON bytes. On a cache hit it reads from S3 directly.
func (s *replayService) stitchOrCache(ctx context.Context, siteID, sessionID string) ([]byte, error) {
	cacheKey := fmt.Sprintf("replays/%s/%s/full.json.gz", siteID, sessionID)

	// ── Cache hit ────────────────────────────────────────────────────────────
	if reader, dlErr := s.store.Download(ctx, cacheKey); dlErr == nil {
		defer reader.Close()
		if gzr, gzErr := gzip.NewReader(reader); gzErr == nil {
			defer gzr.Close()
			if raw, readErr := io.ReadAll(gzr); readErr == nil {
				return raw, nil
			}
		}
		// Cache file corrupt — fall through to re-stitch
	}

	seqs, err := s.repo.GetChunkSequences(ctx, siteID, sessionID)
	if err != nil {
		return nil, err
	}
	if len(seqs) == 0 {
		return []byte("[]"), nil
	}

	// Download all chunks concurrently (max 8 parallel S3 requests).
	const concurrency = 8
	sem := make(chan struct{}, concurrency)

	type chunkResult struct {
		idx  int
		data []byte
	}
	results := make([]chunkResult, len(seqs))
	var wg sync.WaitGroup

	for i, seq := range seqs {
		wg.Add(1)
		go func(idx, seq int) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			key := fmt.Sprintf("replays/%s/%s/%d.json.gz", siteID, sessionID, seq)
			reader, dlErr := s.store.Download(ctx, key)
			if dlErr != nil {
				key = fmt.Sprintf("replays/%s/%s/%d.json", siteID, sessionID, seq)
				reader, dlErr = s.store.Download(ctx, key)
			}
			if dlErr != nil {
				return // skip missing chunk
			}
			defer reader.Close()

			var r io.Reader = reader
			if strings.HasSuffix(key, ".gz") {
				gzr, err := gzip.NewReader(reader)
				if err != nil {
					return
				}
				defer gzr.Close()
				r = gzr
			}
			raw, err := io.ReadAll(r)
			if err != nil {
				return
			}
			results[idx] = chunkResult{idx: idx, data: raw}
		}(i, seq)
	}
	wg.Wait()

	// Merge all events from every chunk into one slice.
	var allEvents []json.RawMessage
	for _, r := range results {
		if len(r.data) == 0 {
			continue
		}
		var chunkEvents []json.RawMessage
		if err := json.Unmarshal(r.data, &chunkEvents); err != nil {
			continue
		}
		allEvents = append(allEvents, chunkEvents...)
	}

	// Sort by timestamp.
	type tsOnly struct {
		Timestamp int64 `json:"timestamp"`
	}
	timestamps := make([]int64, len(allEvents))
	for i, ev := range allEvents {
		var ts tsOnly
		_ = json.Unmarshal(ev, &ts)
		timestamps[i] = ts.Timestamp
	}
	sort.Slice(allEvents, func(i, j int) bool {
		return timestamps[i] < timestamps[j]
	})

	merged, err := json.Marshal(allEvents)
	if err != nil {
		return nil, err
	}

	// Save cache with proper Content-Type/Content-Encoding so browsers can
	// decompress it transparently when fetching via presigned URL.
	go func() {
		var buf bytes.Buffer
		gz := gzip.NewWriter(&buf)
		if _, werr := gz.Write(merged); werr == nil {
			gz.Close()
			_ = s.store.UploadCompressed(context.Background(), cacheKey, bytes.NewReader(buf.Bytes()))
		}
	}()

	return merged, nil
}

func (s *replayService) ListSessions(ctx context.Context, websiteID, userID string, limit int, before *time.Time) ([]models.ReplaySessionMetadata, int64, error) {
	siteID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, 0, err
	}

	// Cache the first page (no cursor) which is the most common request.
	if before == nil && s.cache != nil {
		type cachedResult struct {
			Sessions []models.ReplaySessionMetadata `json:"s"`
			Total    int64                          `json:"t"`
		}
		cacheKey := fmt.Sprintf("replay:list:%s:%d", siteID, limit)
		var cached cachedResult
		if s.cache.Get(cacheKey, &cached) {
			return cached.Sessions, cached.Total, nil
		}

		sessions, total, err := s.repo.ListSessionsWithMetadata(ctx, siteID, limit, before)
		if err != nil {
			return nil, 0, err
		}
		_ = s.cache.Set(cacheKey, cachedResult{Sessions: sessions, Total: total}, 2*time.Minute)
		return sessions, total, nil
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
	s.invalidateReplayCache(siteID, userID, sessionID)
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
	s.invalidateReplayCache(siteID, userID, sessionIDs...)
	return nil
}

// invalidateReplayCache clears cached session lists, user count, and session SET entries
// so that deletions are immediately reflected in the UI.
func (s *replayService) invalidateReplayCache(siteID string, userID string, sessionIDs ...string) {
	if s.cache == nil {
		return
	}
	// Clear cached session list pages for this site
	s.cache.DeleteByPattern(fmt.Sprintf("replay:list:%s:*", siteID))
	// Clear cached session count for the user so quota recalculates
	s.cache.Delete(fmt.Sprintf("replay:count:user:%s", userID))
	// Remove deleted sessions from the Redis SET used for fast existence checks
	if len(sessionIDs) > 0 {
		setKey := fmt.Sprintf("replay:sessions:%s", siteID)
		s.cache.SRem(setKey, sessionIDs...)
	}
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

// ── Cache warmer ──────────────────────────────────────────────────────────────

// StartCacheWarmer proactively warms the session list cache for all active
// websites every 90 seconds so the first visit to the sessions page is instant.
func (s *replayService) StartCacheWarmer(ctx context.Context) {
	if s.cache == nil || s.websites == nil {
		s.logger.Info().Msg("Replay cache warmer: skipped (cache or websites service not available)")
		return
	}

	go func() {
		select {
		case <-time.After(8 * time.Second):
		case <-ctx.Done():
			return
		}

		s.logger.Info().Msg("Replay cache warmer: started")
		s.warmReplaySessions(ctx)

		ticker := time.NewTicker(90 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				s.warmReplaySessions(ctx)
			case <-ctx.Done():
				s.logger.Info().Msg("Replay cache warmer: stopped")
				return
			}
		}
	}()
}

func (s *replayService) warmReplaySessions(ctx context.Context) {
	siteIDs, err := s.websites.ListAllActiveSiteIDs(ctx)
	if err != nil {
		s.logger.Warn().Err(err).Msg("Replay cache warmer: failed to list active sites")
		return
	}

	sem := make(chan struct{}, 10)
	var wg sync.WaitGroup

	for _, id := range siteIDs {
		select {
		case <-ctx.Done():
			break
		default:
		}

		wg.Add(1)
		sem <- struct{}{}
		go func(siteID string) {
			defer wg.Done()
			defer func() { <-sem }()

			const defaultLimit = 50
			cacheKey := fmt.Sprintf("replay:list:%s:%d", siteID, defaultLimit)
			if s.cache.Exists(cacheKey) {
				return
			}

			warmCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
			defer cancel()

			sessions, total, err := s.repo.ListSessionsWithMetadata(warmCtx, siteID, defaultLimit, nil)
			if err != nil {
				return
			}

			type cachedResult struct {
				Sessions []models.ReplaySessionMetadata `json:"s"`
				Total    int64                          `json:"t"`
			}
			_ = s.cache.Set(cacheKey, cachedResult{Sessions: sessions, Total: total}, 2*time.Minute)
		}(id)
	}

	wg.Wait()
	s.logger.Debug().Int("sites", len(siteIDs)).Msg("Replay cache warmer: cycle complete")
}

// ── Rage-click detection ──────────────────────────────────────────────────────

// StartRageClickWorker launches a background goroutine that scans sessions
// recorded more than 60s ago for rage clicks. It processes up to 20 sessions
// per minute and requires no external message queue.
func (s *replayService) StartRageClickWorker(ctx context.Context) {
	go func() {
		// Initial delay so the service can finish starting up before the first scan.
		select {
		case <-ctx.Done():
			return
		case <-time.After(30 * time.Second):
		}

		ticker := time.NewTicker(60 * time.Second)
		defer ticker.Stop()

		// Run immediately after the initial delay, then on every tick.
		s.processRageClicks(ctx)

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.processRageClicks(ctx)
			}
		}
	}()
	s.logger.Info().Msg("Rage-click detection worker started")
}

func (s *replayService) processRageClicks(ctx context.Context) {
	// Only process sessions that finished at least 60 s ago (gives the tracker
	// time to flush the last chunk before we read all chunks).
	olderThan := time.Now().Add(-60 * time.Second)
	sessions, err := s.repo.GetUnprocessedSessions(ctx, olderThan, 20)
	if err != nil {
		s.logger.Error().Err(err).Msg("rage-click worker: failed to fetch unprocessed sessions")
		return
	}

	for _, sess := range sessions {
		select {
		case <-ctx.Done():
			return
		default:
		}

		hasRage := s.detectSessionRageClicks(ctx, sess.WebsiteID, sess.SessionID)
		if err := s.repo.MarkRageClicksProcessed(ctx, sess.WebsiteID, sess.SessionID, hasRage); err != nil {
			s.logger.Error().Err(err).
				Str("session_id", sess.SessionID).
				Msg("rage-click worker: failed to mark session processed")
		} else if hasRage {
			s.logger.Debug().
				Str("session_id", sess.SessionID).
				Msg("rage clicks detected")
		}
	}
}

// detectSessionRageClicks downloads all chunks for a session concurrently
// and checks for rage clicks (3+ clicks within 1 000 ms in a 100 px radius).
func (s *replayService) detectSessionRageClicks(ctx context.Context, websiteID, sessionID string) bool {
	seqs, err := s.repo.GetChunkSequences(ctx, websiteID, sessionID)
	if err != nil || len(seqs) == 0 {
		return false
	}

	type chunkResult struct {
		idx  int
		data []json.RawMessage
	}
	results := make([]chunkResult, len(seqs))
	var wg sync.WaitGroup
	sem := make(chan struct{}, 8)

	for i, seq := range seqs {
		wg.Add(1)
		go func(idx, seq int) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			key := fmt.Sprintf("replays/%s/%s/%d.json.gz", websiteID, sessionID, seq)
			reader, dlErr := s.store.Download(ctx, key)
			if dlErr != nil {
				return
			}
			gzr, gzErr := gzip.NewReader(reader)
			if gzErr != nil {
				reader.Close()
				return
			}
			raw, readErr := io.ReadAll(gzr)
			gzr.Close()
			reader.Close()
			if readErr != nil {
				return
			}
			var evs []json.RawMessage
			if json.Unmarshal(raw, &evs) == nil {
				results[idx] = chunkResult{idx: idx, data: evs}
			}
		}(i, seq)
	}
	wg.Wait()

	var allEvents []json.RawMessage
	for _, r := range results {
		allEvents = append(allEvents, r.data...)
	}

	return detectRageClicks(allEvents)
}

// detectRageClicks returns true if the event stream contains 3 or more mouse
// clicks within 1 000 ms inside a 100 px radius — the classic rage-click signal.
func detectRageClicks(events []json.RawMessage) bool {
	type clickEvent struct {
		ts int64
		x  int
		y  int
	}

	// rrweb IncrementalSnapshot (type=3) MouseInteraction (source=2) Click (type=2)
	type rrwebData struct {
		Source int `json:"source"`
		Type   int `json:"type"`
		X      int `json:"x"`
		Y      int `json:"y"`
	}
	type rrwebEvent struct {
		Type      int       `json:"type"`
		Timestamp int64     `json:"timestamp"`
		Data      rrwebData `json:"data"`
	}

	var clicks []clickEvent
	for _, raw := range events {
		var ev rrwebEvent
		if json.Unmarshal(raw, &ev) != nil {
			continue
		}
		if ev.Type == 3 && ev.Data.Source == 2 && ev.Data.Type == 2 {
			clicks = append(clicks, clickEvent{ev.Timestamp, ev.Data.X, ev.Data.Y})
		}
	}

	if len(clicks) < 3 {
		return false
	}

	sort.Slice(clicks, func(i, j int) bool { return clicks[i].ts < clicks[j].ts })

	const windowMs = 1000
	const minClicks = 3
	const radiusSq = 100 * 100

	for i := 0; i < len(clicks)-minClicks+1; i++ {
		count := 1
		for j := i + 1; j < len(clicks); j++ {
			if clicks[j].ts-clicks[i].ts > windowMs {
				break
			}
			dx := clicks[j].x - clicks[i].x
			dy := clicks[j].y - clicks[i].y
			if dx*dx+dy*dy <= radiusSq {
				count++
				if count >= minClicks {
					return true
				}
			}
		}
	}
	return false
}
