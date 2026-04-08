package services

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/Seentics/seentics/internal/modules/analytics/models"
	"github.com/Seentics/seentics/internal/modules/analytics/repository"

	websiteServicePkg "github.com/Seentics/seentics/internal/modules/websites/services"
	"github.com/Seentics/seentics/internal/shared/utils"

	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
)

const (
	BatchSize     = 2000
	FlushInterval = 5 * time.Second
	BufferSize    = 20_000 // in-memory event channel capacity
)

type EventService struct {
	repo     repository.EventRepository
	logger   zerolog.Logger
	websites *websiteServicePkg.WebsiteService
	rdb      *redis.Client

	buf        chan models.Event
	ctx        context.Context
	cancel     context.CancelFunc
	wg         sync.WaitGroup
	isShutdown bool
	shutdownMu sync.RWMutex
}

func NewEventService(repo repository.EventRepository, websites *websiteServicePkg.WebsiteService, logger zerolog.Logger, rdb *redis.Client) *EventService {
	ctx, cancel := context.WithCancel(context.Background())

	s := &EventService{
		repo:     repo,
		websites: websites,
		logger:   logger,
		rdb:      rdb,
		buf:      make(chan models.Event, BufferSize),
		ctx:      ctx,
		cancel:   cancel,
	}
	s.startFlusher()
	return s
}

func (s *EventService) TrackEvent(ctx context.Context, event *models.Event) (*models.EventResponse, error) {
	s.shutdownMu.RLock()
	if s.isShutdown {
		s.shutdownMu.RUnlock()
		return nil, fmt.Errorf("service is shutdown")
	}
	s.shutdownMu.RUnlock()

	website, err := s.websites.GetWebsiteByAnyID(ctx, event.WebsiteID)
	if err != nil {
		return nil, fmt.Errorf("invalid website_id")
	}
	event.WebsiteID = website.SiteID

	if !website.IsActive {
		return nil, fmt.Errorf("website is inactive")
	}

	if event.EventType == "" {
		event.EventType = "pageview"
	}
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}

	s.enrichEventData(ctx, event)

	if !s.enqueue(*event) {
		return nil, fmt.Errorf("server busy, try again later")
	}

	return &models.EventResponse{
		Status:    "accepted",
		EventID:   event.ID.String(),
		VisitorID: event.VisitorID,
		SessionID: event.SessionID,
	}, nil
}

func (s *EventService) TrackBatchEvents(ctx context.Context, req *models.BatchEventRequest) (*models.BatchEventResponse, error) {
	s.shutdownMu.RLock()
	if s.isShutdown {
		s.shutdownMu.RUnlock()
		return nil, fmt.Errorf("service is shutdown")
	}
	s.shutdownMu.RUnlock()

	if len(req.Events) == 0 {
		return &models.BatchEventResponse{
			Status:      "success",
			EventsCount: 0,
			ProcessedAt: time.Now().Unix(),
		}, nil
	}

	website, err := s.websites.GetWebsiteByAnyID(ctx, req.SiteID)
	if err != nil {
		return nil, fmt.Errorf("invalid website_id: %s", req.SiteID)
	}
	if !website.IsActive {
		return nil, fmt.Errorf("website is inactive")
	}
	if !s.websites.ValidateOriginDomain(req.Domain, website.URL) {
		s.logger.Warn().
			Str("req_domain", req.Domain).
			Str("site_domain", website.URL).
			Msg("Domain mismatch in batch event")
		return nil, fmt.Errorf("domain mismatch")
	}
	req.SiteID = website.SiteID

	// Pre-compute shared UA + GeoIP once for the whole batch — all events share
	// the same client IP and user-agent from the /collect HTTP request headers.
	var sharedUA *utils.UserAgentInfo
	var sharedGeo *utils.LocationInfo
	if req.ClientUA != "" {
		info := utils.ParseUserAgent(req.ClientUA)
		sharedUA = &info
	}
	if req.ClientIP != "" {
		geo := utils.GetLocationFromIP(req.ClientIP)
		sharedGeo = &geo
	}

	now := time.Now()
	accepted := 0
	var liveVisitorIDs []string

	for i := range req.Events {
		ev := &req.Events[i]
		ev.WebsiteID = req.SiteID
		if ev.EventType == "" {
			ev.EventType = "pageview"
		}
		if ev.Timestamp.IsZero() {
			ev.Timestamp = now
		}
		if req.ClientIP != "" && (ev.IPAddress == nil || *ev.IPAddress == "") {
			ip := req.ClientIP
			ev.IPAddress = &ip
		}
		if req.ClientUA != "" && (ev.UserAgent == nil || *ev.UserAgent == "") {
			ua := req.ClientUA
			ev.UserAgent = &ua
		}

		s.enrichEventShared(ctx, ev, sharedUA, sharedGeo)

		if s.enqueue(*ev) {
			accepted++
		}

		if ev.EventType == "pageview" && ev.VisitorID != "" {
			liveVisitorIDs = append(liveVisitorIDs, ev.VisitorID)
		}
	}

	// Update live visitor HyperLogLog in Redis (5-min TTL for the realtime widget).
	if len(liveVisitorIDs) > 0 {
		hlKey := "sn:active:" + req.SiteID
		args := make([]interface{}, len(liveVisitorIDs))
		for i, v := range liveVisitorIDs {
			args[i] = v
		}
		pipe := s.rdb.Pipeline()
		pipe.PFAdd(ctx, hlKey, args...)
		pipe.Expire(ctx, hlKey, 5*time.Minute)
		if _, err := pipe.Exec(ctx); err != nil {
			s.logger.Warn().Err(err).Msg("Failed to update live visitor HyperLogLog")
		}
	}

	return &models.BatchEventResponse{
		Status:      "accepted",
		EventsCount: accepted,
		ProcessedAt: now.Unix(),
	}, nil
}

// enqueue adds an event to the in-memory buffer. Returns false (and logs a
// warning) only when the buffer is completely full — i.e. ClickHouse is falling
// behind faster than events can be flushed.
func (s *EventService) enqueue(ev models.Event) bool {
	select {
	case s.buf <- ev:
		return true
	default:
		s.logger.Warn().
			Str("website_id", ev.WebsiteID).
			Msg("Event buffer full — dropping event")
		return false
	}
}

// startFlusher runs a background goroutine that drains the buffer into ClickHouse.
// It flushes whenever BatchSize events accumulate OR FlushInterval elapses.
func (s *EventService) startFlusher() {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()

		ticker := time.NewTicker(FlushInterval)
		defer ticker.Stop()

		batch := make([]models.Event, 0, BatchSize)

		flush := func() {
			if len(batch) == 0 {
				return
			}
			s.processBatch(batch)
			batch = batch[:0]
		}

		for {
			select {
			case ev := <-s.buf:
				batch = append(batch, ev)
				if len(batch) >= BatchSize {
					flush()
				}

			case <-ticker.C:
				flush()

			case <-s.ctx.Done():
				// Drain remaining events before exiting.
			drain:
				for {
					select {
					case ev := <-s.buf:
						batch = append(batch, ev)
					default:
						break drain
					}
				}
				flush()
				return
			}
		}
	}()
}

// processBatch writes a batch of events to ClickHouse.
func (s *EventService) processBatch(batch []models.Event) {
	if len(batch) == 0 {
		return
	}

	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Resolve any UUID-format website IDs to canonical site IDs.
	// One cache lookup per unique UUID, not per event.
	siteIDMap := make(map[string]string)
	for i := range batch {
		ev := &batch[i]
		if len(ev.WebsiteID) > 24 {
			if resolved, ok := siteIDMap[ev.WebsiteID]; ok {
				ev.WebsiteID = resolved
			} else if website, err := s.websites.GetWebsiteByAnyID(ctx, ev.WebsiteID); err == nil {
				siteIDMap[ev.WebsiteID] = website.SiteID
				ev.WebsiteID = website.SiteID
			}
		}
	}

	result, err := s.repo.CreateBatch(ctx, batch)
	if err != nil {
		s.logger.Error().
			Err(err).
			Int("count", len(batch)).
			Msg("Failed to flush event batch to ClickHouse")
		return
	}

	s.logger.Debug().
		Int("processed", result.Processed).
		Int("failed", result.Failed).
		Dur("duration", time.Since(start)).
		Msg("Event batch flushed")

	if result.Failed > 0 {
		s.logger.Warn().
			Int("failed", result.Failed).
			Interface("errors", result.Errors).
			Msg("Some events in batch failed")
	}
}

// Shutdown drains the buffer and stops the flusher goroutine.
func (s *EventService) Shutdown(timeout time.Duration) error {
	s.logger.Info().Msg("Shutting down event service")

	s.shutdownMu.Lock()
	s.isShutdown = true
	s.shutdownMu.Unlock()

	s.cancel()

	done := make(chan struct{})
	go func() { s.wg.Wait(); close(done) }()

	select {
	case <-done:
		s.logger.Info().Msg("Event service shutdown completed")
		return nil
	case <-time.After(timeout):
		s.logger.Warn().Msg("Event service shutdown timed out")
		return fmt.Errorf("shutdown timeout exceeded")
	}
}

func (s *EventService) GetEvents(ctx context.Context, websiteID string, limit int, offset int) ([]models.Event, error) {
	if websiteID == "" {
		return nil, fmt.Errorf("website_id is required")
	}
	if limit <= 0 || limit > 10000 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}
	return s.repo.GetByWebsiteID(ctx, websiteID, limit, offset)
}

// GetStats returns current buffer utilisation stats.
func (s *EventService) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"buffer_size":    BufferSize,
		"buffer_used":    len(s.buf),
		"batch_size":     BatchSize,
		"flush_interval": FlushInterval.String(),
	}
}

func (s *EventService) enrichEventData(ctx context.Context, event *models.Event) {
	s.enrichEventShared(ctx, event, nil, nil)
}

// enrichEventShared applies UA + GeoIP enrichment. When sharedUA/sharedGeo are
// provided (pre-computed once per batch) the expensive parsing calls are skipped.
func (s *EventService) enrichEventShared(_ context.Context, event *models.Event, sharedUA *utils.UserAgentInfo, sharedGeo *utils.LocationInfo) {
	if event.Page == "" && event.PagePath != "" {
		event.Page = event.PagePath
	}

	if event.UserAgent != nil && *event.UserAgent != "" {
		if (event.Browser == nil || *event.Browser == "") ||
			(event.Device == nil || *event.Device == "") ||
			(event.OS == nil || *event.OS == "") {

			var uaInfo utils.UserAgentInfo
			if sharedUA != nil {
				uaInfo = *sharedUA
			} else {
				uaInfo = utils.ParseUserAgent(*event.UserAgent)
			}
			if event.Browser == nil || *event.Browser == "" {
				event.Browser = &uaInfo.Browser
			}
			if event.Device == nil || *event.Device == "" {
				event.Device = &uaInfo.Device
			}
			if event.OS == nil || *event.OS == "" {
				event.OS = &uaInfo.OS
			}
		}
	}

	if (event.Country == nil || *event.Country == "") &&
		(event.IPAddress != nil && *event.IPAddress != "") {

		var location utils.LocationInfo
		if sharedGeo != nil {
			location = *sharedGeo
		} else {
			location = utils.GetLocationFromIP(*event.IPAddress)
		}
		if location.Country != "" && (event.Country == nil || *event.Country == "") {
			event.Country = &location.Country
		}
		if event.CountryCode == nil || *event.CountryCode == "" {
			event.CountryCode = &location.CountryCode
		}
		if event.City == nil || *event.City == "" {
			event.City = &location.City
		}
		if event.Continent == nil || *event.Continent == "" {
			event.Continent = &location.Continent
		}
		if event.Latitude == nil || *event.Latitude == 0 {
			lat := location.Latitude
			event.Latitude = &lat
		}
		if event.Longitude == nil || *event.Longitude == 0 {
			long := location.Longitude
			event.Longitude = &long
		}
	}
}
