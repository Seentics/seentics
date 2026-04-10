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
}

func NewReplayService(repo *repository.ReplayRepository, websiteRepo *websiteRepo.WebsiteRepository, logger zerolog.Logger, cfg *config.Config) *ReplayService {
	idle := 15 * time.Minute
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
		go s.worker()
	}
	go s.pgBatcher()
	return s
}

// Shutdown flushes in-memory replay buffers then stops the spool finalizer.
func (s *ReplayService) Shutdown(ctx context.Context) {
	s.spool.FlushAll(ctx)
	s.spool.Stop()
}

// worker drains the S3 queue — uploads one chunk then forwards a Postgres row.
func (s *ReplayService) worker() {
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
func (s *ReplayService) pgBatcher() {
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

	if warm, ok := s.spool.WarmChunks(siteID, sessionID); ok {
		access.WarmChunks = warm
		return meta, access, nil
	}

	exists, err := s.repo.ReplayBundleExists(ctx, siteID, sessionID)
	if err != nil {
		return meta, nil, fmt.Errorf("replay bundle: %w", err)
	}
	if !exists {
		return meta, nil, ErrReplayNotReady
	}

	exp := s.presignTTL
	deadline := time.Now().Add(exp)
	url, err := s.repo.PresignReplayBundle(ctx, siteID, sessionID, exp)
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
