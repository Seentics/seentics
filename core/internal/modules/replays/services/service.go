package services

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/Seentics/seentics/internal/modules/replays/models"
	"github.com/Seentics/seentics/internal/modules/replays/repository"
	"github.com/Seentics/seentics/internal/modules/replays/spool"
	websiteRepo "github.com/Seentics/seentics/internal/modules/websites/repository"
	"github.com/Seentics/seentics/internal/shared/config"
	"github.com/Seentics/seentics/internal/shared/utils"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

// ErrReplayNotReady is returned when the session has no in-memory buffer and no bundle object yet.
var ErrReplayNotReady = errors.New("replay recording is not available yet")

const maxReplayRecordingAge = 30 * time.Minute

type TrackerEvent struct {
	Type      string                 `json:"type"`
	Data      map[string]interface{} `json:"data"`
	TS        int64                  `json:"ts"`
	URL       string                 `json:"url"`
	SID       string                 `json:"sid"`
	VID       string                 `json:"vid"`
	WebsiteID string                 `json:"-"`
	ClientIP  string                 `json:"-"`
	ClientUA  string                 `json:"-"`
}

// sessionJob is one fully-prepared session chunk ready for the S3 stage.
type sessionJob struct {
	websiteID       string
	sessionID       string
	tsMs            int64
	latestEventMs   int64
	events          []map[string]interface{}
	meta            *models.SessionMeta
	pageIncrements  int
	durationSeconds int
	rageClicks      bool
	hasErrors       bool
}

const (
	sessionWorkers   = 16    // concurrent S3 writers
	sessionQueueCap  = 8192  // S3 queue depth before drops
	pgQueueCap       = 16384 // Postgres batcher queue depth
	pgBatchSize      = 256   // flush Postgres when this many rows accumulate
	pgBatchTimeout   = 500 * time.Millisecond
	idCacheTTL       = 5 * time.Minute
)

type idCacheEntry struct {
	siteID    string
	uuidStr   string
	expiresAt time.Time
}

type ReplayService struct {
	repo        *repository.ReplayRepository
	websiteRepo *websiteRepo.WebsiteRepository
	logger      zerolog.Logger
	spool       *spool.Manager
	presignTTL  time.Duration
	queue       chan sessionJob
	pgQueue     chan repository.SessionUpsertRow
	idCache     map[string]idCacheEntry
	idCacheMu   sync.Mutex
	workerWg    sync.WaitGroup // tracks S3 worker goroutines
	batcherWg   sync.WaitGroup // tracks pgBatcher goroutine
}

func NewReplayService(repo *repository.ReplayRepository, websiteRepo *websiteRepo.WebsiteRepository, logger zerolog.Logger, cfg *config.Config) *ReplayService {
	idle := 60 * time.Second
	maxAge := maxReplayRecordingAge
	presignTTL := time.Hour
	if cfg != nil {
		if cfg.ReplaySpoolIdleFlush > 0 {
			idle = cfg.ReplaySpoolIdleFlush
		}
		if cfg.ReplaySpoolMaxAge > 0 {
			maxAge = cfg.ReplaySpoolMaxAge
		}
		if cfg.ReplayPresignTTL > 0 {
			presignTTL = cfg.ReplayPresignTTL
		}
	}
	if maxAge > maxReplayRecordingAge {
		maxAge = maxReplayRecordingAge
	}

	s := &ReplayService{
		repo:        repo,
		websiteRepo: websiteRepo,
		logger:      logger,
		presignTTL:  presignTTL,
		queue:       make(chan sessionJob, sessionQueueCap),
		pgQueue:     make(chan repository.SessionUpsertRow, pgQueueCap),
		spool:       spool.New(repo, logger, idle, maxAge),
		idCache:     make(map[string]idCacheEntry),
	}
	go s.spool.Run(context.Background())
	logger.Info().Dur("idle_flush", idle).Dur("max_age", maxAge).Dur("presign_ttl", presignTTL).Msg("replay spool (bundle-only + presigned reads)")

	for i := 0; i < sessionWorkers; i++ {
		s.workerWg.Add(1)
		go s.worker()
	}
	s.batcherWg.Add(1)
	go s.pgBatcher()
	return s
}

// Shutdown drains all queues and goroutines in dependency order:
//  1. Flush the in-memory spool to S3 (may take up to 90 s per session).
//  2. Close s.queue — the 16 S3 workers drain remaining jobs and exit.
//  3. Wait for all workers — ensures no more rows land in pgQueue.
//  4. Close s.pgQueue — pgBatcher flushes the last batch and exits.
//  5. Wait for pgBatcher — guarantees every metadata row is persisted.
func (s *ReplayService) Shutdown(ctx context.Context) {
	s.spool.FlushAll(ctx)
	s.spool.Stop()

	close(s.queue)
	s.workerWg.Wait()

	close(s.pgQueue)
	s.batcherWg.Wait()
}

func replayMonthStartUTC() time.Time {
	now := time.Now().UTC()
	return time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
}

// WithinMonthlyReplayQuota reports whether ingesting batchSessionIDs would stay within
// maxReplays distinct sessions for the UTC calendar month. maxReplays < 0 means unlimited.
func (s *ReplayService) WithinMonthlyReplayQuota(ctx context.Context, ownerID uuid.UUID, batchSessionIDs []string, maxReplays int) (bool, error) {
	if maxReplays < 0 || len(batchSessionIDs) == 0 {
		return true, nil
	}
	wsites, err := s.websiteRepo.ListByUserID(ctx, ownerID)
	if err != nil {
		return false, err
	}
	siteIDs := make([]string, 0, len(wsites))
	uuids := make([]string, 0, len(wsites))
	for _, w := range wsites {
		siteIDs = append(siteIDs, w.SiteID)
		uuids = append(uuids, w.ID.String())
	}
	if len(siteIDs) == 0 {
		return true, nil
	}
	since := replayMonthStartUTC()
	current, err := s.repo.CountDistinctReplaySessionsSince(ctx, siteIDs, uuids, since)
	if err != nil {
		return false, err
	}
	newInBatch, err := s.repo.CountNewReplaySessionsInBatch(ctx, siteIDs, uuids, since, batchSessionIDs)
	if err != nil {
		return false, err
	}
	return current+newInBatch <= maxReplays, nil
}

// worker drains the S3 queue — uploads one chunk then forwards a Postgres row.
func (s *ReplayService) worker() {
	defer s.workerWg.Done()
	for job := range s.queue {
		err := s.spool.Push(job.websiteID, job.sessionID, job.events)
		if err != nil {
			s.logger.Warn().Err(err).Str("session_id", job.sessionID).Msg("replay: chunk storage failed")
			continue // don't write Postgres for a chunk we couldn't store
		}

		var b, d, o, c, u string
		if job.meta != nil {
			b, d, o, c, u = job.meta.Browser, job.meta.Device, job.meta.OS, job.meta.Country, job.meta.EntryPage
		}
		row := repository.SessionUpsertRow{
			WebsiteID:       job.websiteID,
			SessionID:       job.sessionID,
			TsMs:            job.tsMs,
			LatestEventMs:   job.latestEventMs,
			Browser:         b,
			Device:          d,
			OS:              o,
			Country:         c,
			EntryPage:       u,
			PageIncrements:  job.pageIncrements,
			DurationSeconds: job.durationSeconds,
			HasRageClicks:   job.rageClicks,
			HasErrors:       job.hasErrors,
		}
		select {
		case s.pgQueue <- row:
		default:
			s.logger.Warn().Str("session_id", job.sessionID).Msg("replay: pg queue full, metadata row dropped")
		}
	}
}

// pgBatcher accumulates Postgres upsert rows and flushes as a single batch
// when either pgBatchSize rows are ready or pgBatchTimeout elapses.
// Exits cleanly when pgQueue is closed (by Shutdown), flushing any remaining rows first.
func (s *ReplayService) pgBatcher() {
	defer s.batcherWg.Done()
	buf := make([]repository.SessionUpsertRow, 0, pgBatchSize)
	ticker := time.NewTicker(pgBatchTimeout)
	defer ticker.Stop()

	flush := func() {
		if len(buf) == 0 {
			return
		}
		batch := buf
		buf = make([]repository.SessionUpsertRow, 0, pgBatchSize)
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if err := s.repo.UpsertSessionMetaBatch(ctx, batch); err != nil {
			s.logger.Warn().Err(err).Int("rows", len(batch)).Msg("replay: pg upsert batch failed")
		}
	}

	for {
		select {
		case row, ok := <-s.pgQueue:
			if !ok {
				flush()
				return
			}
			buf = append(buf, row)
			if len(buf) >= pgBatchSize {
				flush()
			}
		case <-ticker.C:
			flush()
		}
	}
}

// sortSessionBatchEvents orders one flushed batch by tracker `ts` so replay chunks stay time-ordered.
func sortSessionBatchEvents(events []map[string]interface{}) {
	sort.SliceStable(events, func(i, j int) bool {
		ti := utils.EventTimestampMs(events[i])
		tj := utils.EventTimestampMs(events[j])
		if ti != tj {
			return ti < tj
		}
		return i < j
	})
}

// resolveIDs retrieves both the UUID and the SiteID for a given website identification string.
// Results are cached for idCacheTTL to avoid repeated DB lookups on every flush cycle.
func (s *ReplayService) resolveIDs(ctx context.Context, websiteID string) (string, string, error) {
	s.idCacheMu.Lock()
	if e, ok := s.idCache[websiteID]; ok && time.Now().Before(e.expiresAt) {
		s.idCacheMu.Unlock()
		return e.siteID, e.uuidStr, nil
	}
	s.idCacheMu.Unlock()

	var siteID, uuidStr string
	uid, err := uuid.Parse(websiteID)
	if err == nil {
		// It's a UUID — look up the SiteID.
		w, err := s.websiteRepo.GetByUUIDOnly(ctx, uid)
		if err != nil {
			return "", websiteID, fmt.Errorf("website uuid resolution failed: %w", err)
		}
		siteID, uuidStr = w.SiteID, websiteID
	} else {
		// Not a UUID — assume it's a SiteID, look up the UUID.
		w, err := s.websiteRepo.GetBySiteID(ctx, websiteID)
		if err != nil {
			return websiteID, "", fmt.Errorf("website site_id resolution failed: %w", err)
		}
		siteID, uuidStr = websiteID, w.ID.String()
	}

	s.idCacheMu.Lock()
	s.idCache[websiteID] = idCacheEntry{siteID: siteID, uuidStr: uuidStr, expiresAt: time.Now().Add(idCacheTTL)}
	s.idCacheMu.Unlock()
	return siteID, uuidStr, nil
}

// ProcessEvents processes session recording events from any number of sites/visitors.
// Each event carries its own WebsiteID, ClientIP, and ClientUA so the call is global.
func (s *ReplayService) ProcessEvents(ctx context.Context, events []TrackerEvent) error {
	type sessionBatch struct {
		websiteID       string
		events          []map[string]interface{}
		clicks          []rageClick // collected during grouping — avoids O(n²) re-scan
		hasErrors       bool
		hasFullSnapshot bool
		startTs         int64
		endTs           int64
		clientUA        string
		clientIP        string
	}

	grouped := make(map[string]*sessionBatch)
	for _, ev := range events {
		if ev.SID == "" {
			continue
		}
		b, exists := grouped[ev.SID]
		if !exists {
			b = &sessionBatch{
				websiteID: ev.WebsiteID,
				startTs:   ev.TS, endTs: ev.TS,
				clientUA: ev.ClientUA, clientIP: ev.ClientIP,
			}
			grouped[ev.SID] = b
		}
		b.events = append(b.events, map[string]interface{}{
			"type": ev.Type, "ts": ev.TS, "url": ev.URL,
			"sid": ev.SID, "vid": ev.VID, "data": ev.Data,
		})
		if ev.TS < b.startTs {
			b.startTs = ev.TS
		}
		if ev.TS > b.endTs {
			b.endTs = ev.TS
		}

		// Detect rage-click candidates and errors here — one pass over events total
		// instead of re-scanning all events for each session (was O(sessions × events)).
		if ev.Type == "session_error" {
			b.hasErrors = true
		}
		if ev.Type == "rrweb" {
			rrwEvType, _ := ev.Data["type"].(float64)
			if int(rrwEvType) == 2 {
				b.hasFullSnapshot = true
			}
			if int(rrwEvType) == 3 {
				if inner, _ := ev.Data["data"].(map[string]interface{}); inner != nil {
					src, _ := inner["source"].(float64)
					ct, _ := inner["type"].(float64)
					if int(src) == 2 && int(ct) == 2 {
						x, _ := inner["x"].(float64)
						y, _ := inner["y"].(float64)
						ts, _ := ev.Data["timestamp"].(float64)
						b.clicks = append(b.clicks, rageClick{ts: int64(ts), x: x, y: y})
					}
				}
			}
		}
	}

	// Prepare all work before launching goroutines (cheap CPU — no allocations shared).
	type sessionWork struct {
		sessionID       string
		batch           *sessionBatch
		meta            *models.SessionMeta
		pageIncrements  int
		durationSeconds int
		tsToUse         int64
		rageClicks      bool
	}

	work := make([]sessionWork, 0, len(grouped))
	for sessionID, batch := range grouped {
		uaInfo := utils.ParseUserAgent(batch.clientUA)
		locInfo := utils.GetLocationFromIP(batch.clientIP)

		// Sort events and clicks by timestamp before any field extraction
		// so entryURL and rage click detection both operate on ordered data.
		sortSessionBatchEvents(batch.events)
		if len(batch.clicks) > 1 {
			sort.Slice(batch.clicks, func(i, j int) bool {
				return batch.clicks[i].ts < batch.clicks[j].ts
			})
		}

		var meta *models.SessionMeta
		pageIncrements := 0
		if batch.hasFullSnapshot {
			pageIncrements = 1
			entryURL := ""
			if len(batch.events) > 0 {
				if u, ok := batch.events[0]["url"].(string); ok {
					entryURL = u
				}
			}
			meta = &models.SessionMeta{
				Browser: uaInfo.Browser, Device: uaInfo.Device, OS: uaInfo.OS,
				Country: locInfo.Country, EntryPage: entryURL,
			}
		}

		tsToUse := batch.endTs
		if batch.hasFullSnapshot {
			tsToUse = batch.startTs
		}

		work = append(work, sessionWork{
			sessionID:       sessionID,
			batch:           batch,
			meta:            meta,
			pageIncrements:  pageIncrements,
			durationSeconds: int((batch.endTs - batch.startTs) / 1000),
			tsToUse:         tsToUse,
			rageClicks:      hasRageClickPattern(batch.clicks),
		})
	}

	// Enqueue each session job — non-blocking, workers drain continuously.
	// If the queue is full (8192 cap), drop with a warning rather than block the flush.
	for _, w := range work {
		storageWebsiteID := w.batch.websiteID
		if sk, _, err := s.resolveIDs(ctx, w.batch.websiteID); err == nil {
			storageWebsiteID = sk
		}
		job := sessionJob{
			websiteID:       storageWebsiteID,
			sessionID:       w.sessionID,
			tsMs:            w.tsToUse,
			latestEventMs:   w.batch.endTs,
			events:          w.batch.events,
			meta:            w.meta,
			pageIncrements:  w.pageIncrements,
			durationSeconds: w.durationSeconds,
			rageClicks:      w.rageClicks,
			hasErrors:       w.batch.hasErrors,
		}
		select {
		case s.queue <- job:
		default:
			s.logger.Warn().
				Str("session_id", w.sessionID).
				Int("queue_cap", sessionQueueCap).
				Msg("replay: session queue full, chunk dropped")
		}
	}
	return nil
}

type rageClick struct{ ts int64; x, y float64 }


func hasRageClickPattern(clicks []rageClick) bool {
	for i := 0; i < len(clicks); i++ {
		count := 1
		for j := i + 1; j < len(clicks); j++ {
			if clicks[j].ts-clicks[i].ts > 1000 { break }
			dx := clicks[j].x - clicks[i].x
			dy := clicks[j].y - clicks[i].y
			if dx*dx+dy*dy <= 2500 { // 50px radius
				count++
			}
		}
		if count >= 3 { return true }
	}
	return false
}

func (s *ReplayService) ListSessions(ctx context.Context, websiteID string, limit, offset int) ([]models.Session, error) {
	siteID, uuidStr, err := s.resolveIDs(ctx, websiteID)
	if err != nil {
		s.logger.Warn().Err(err).Str("input_id", websiteID).Msg("list sessions: id resolution failed")
		return s.repo.ListSessions(ctx, websiteID, websiteID, limit, offset)
	}

	return s.repo.ListSessions(ctx, siteID, uuidStr, limit, offset)
}


func replayWarmChunksUseful(w []models.ReplayChunk) bool {
	for _, c := range w {
		if len(c.Data) > 0 {
			return true
		}
	}
	return false
}

func (s *ReplayService) GetSession(ctx context.Context, websiteID, sessionID string) (*models.Session, *models.SessionReplayAccess, error) {
	siteID, uuidStr, err := s.resolveIDs(ctx, websiteID)
	if err != nil {
		s.logger.Warn().Err(err).Str("input_id", websiteID).Msg("get session: id resolution failed")
		siteID, uuidStr = websiteID, websiteID
	}

	meta, err := s.repo.GetSessionMeta(ctx, siteID, uuidStr, sessionID)
	if err != nil {
		s.logger.Warn().Err(err).Msg("get session: meta fetch failed")
	}

	access := &models.SessionReplayAccess{}

	if warm, ok := s.spool.WarmChunks(siteID, sessionID); ok && replayWarmChunksUseful(warm) {
		access.WarmChunks = warm
		return meta, access, nil
	}
	if uuidStr != "" && uuidStr != siteID {
		if warm, ok := s.spool.WarmChunks(uuidStr, sessionID); ok && replayWarmChunksUseful(warm) {
			access.WarmChunks = warm
			return meta, access, nil
		}
	}

	bundleKey, err := s.repo.LocateReplayBundle(ctx, siteID, uuidStr, sessionID)
	if err != nil {
		return meta, nil, fmt.Errorf("replay bundle: %w", err)
	}
	if bundleKey == "" {
		// Avoid 404 when the session is listed in Postgres but the gzip bundle is not in object
		// storage yet (spool not flushed, upload in flight, or core restarted before upload).
		if meta == nil {
			return nil, nil, ErrReplayNotReady
		}
		return meta, &models.SessionReplayAccess{RecordingPending: true}, nil
	}

	exp := s.presignTTL
	deadline := time.Now().Add(exp)
	url, err := s.repo.PresignReplayObject(ctx, bundleKey, exp)
	if err != nil {
		return meta, nil, fmt.Errorf("replay presign: %w", err)
	}
	access.ReplayURL = url
	access.ReplayURLExpiresAt = &deadline
	return meta, access, nil
}

func (s *ReplayService) DeleteSessions(ctx context.Context, websiteID string, sessionIDs []string) error {
	siteID, uuidStr, err := s.resolveIDs(ctx, websiteID)
	if err != nil {
		s.logger.Warn().Err(err).Str("input_id", websiteID).Msg("delete sessions: id resolution failed")
		siteID, uuidStr = websiteID, websiteID
	}
	
	for _, id := range sessionIDs {
		s.spool.Remove(siteID, id)
		if uuidStr != siteID {
			s.spool.Remove(uuidStr, id)
		}
		// S3 objects are keyed by siteID — one deletion covers both ID forms.
		// Postgres rows may have been written under either ID, so use an OR delete.
		if err := s.repo.DeleteSessionByEitherID(ctx, siteID, uuidStr, id); err != nil {
			s.logger.Error().Err(err).Str("site_id", siteID).Str("session_id", id).Msg("replay: delete failed")
		}
	}
	return nil
}
