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

type EventService struct {
	repo     repository.EventRepository
	logger   zerolog.Logger
	websites *websiteServicePkg.WebsiteService
	rdb      *redis.Client

	shutdownMu sync.RWMutex
	isShutdown bool
}

func NewEventService(repo repository.EventRepository, websites *websiteServicePkg.WebsiteService, logger zerolog.Logger, rdb *redis.Client) *EventService {
	return &EventService{
		repo:     repo,
		websites: websites,
		logger:   logger,
		rdb:      rdb,
	}
}

func (s *EventService) TrackEvent(ctx context.Context, event *models.Event) (*models.EventResponse, error) {
	s.shutdownMu.RLock()
	if s.isShutdown {
		s.shutdownMu.RUnlock()
		return nil, fmt.Errorf("service is shutdown")
	}
	s.shutdownMu.RUnlock()

	website, err := s.websites.GetWebsiteByID(ctx, event.WebsiteID)
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

	if _, err := s.flushBatchToClickHouse(ctx, []models.Event{*event}); err != nil {
		return nil, err
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

	website, err := s.websites.GetWebsiteByID(ctx, req.WebsiteID)
	if err != nil {
		return nil, fmt.Errorf("invalid website_id: %s", req.WebsiteID)
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
	canonicalSiteID := website.SiteID

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
	var liveVisitorIDs []string

	for i := range req.Events {
		ev := &req.Events[i]
		ev.WebsiteID = canonicalSiteID
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

		if ev.EventType == "pageview" && ev.VisitorID != "" {
			liveVisitorIDs = append(liveVisitorIDs, ev.VisitorID)
		}
	}

	result, err := s.flushBatchToClickHouse(ctx, req.Events)
	if err != nil {
		return nil, err
	}

	if len(liveVisitorIDs) > 0 {
		hlKey := "sn:active:" + canonicalSiteID
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

	count := len(req.Events)
	if result != nil {
		count = result.Processed
	}
	return &models.BatchEventResponse{
		Status:      "accepted",
		EventsCount: count,
		ProcessedAt: now.Unix(),
	}, nil
}

// EnrichCollectAnalytics runs UA / GeoIP enrichment on tracker-derived rows before they are buffered.
// Called synchronously from POST /api/v1/tracker/collect.
func (s *EventService) EnrichCollectAnalytics(ctx context.Context, events []models.Event) error {
	s.shutdownMu.RLock()
	defer s.shutdownMu.RUnlock()
	if s.isShutdown {
		return fmt.Errorf("service is shutdown")
	}
	for i := range events {
		s.enrichEventShared(ctx, &events[i], nil, nil)
	}
	return nil
}

// FlushCollectAnalytics writes pre-enriched analytics rows from the 2s collect buffer to ClickHouse
// and updates live-visitor Redis keys (one PFADD batch per site).
func (s *EventService) FlushCollectAnalytics(ctx context.Context, events []models.Event) (*models.BatchEventResponse, error) {
	s.shutdownMu.RLock()
	if s.isShutdown {
		s.shutdownMu.RUnlock()
		return nil, fmt.Errorf("service is shutdown")
	}
	s.shutdownMu.RUnlock()

	if len(events) == 0 {
		return &models.BatchEventResponse{
			Status:      "success",
			EventsCount: 0,
			ProcessedAt: time.Now().Unix(),
		}, nil
	}

	liveBySite := make(map[string][]string)
	for i := range events {
		ev := &events[i]
		if ev.EventType == "pageview" && ev.VisitorID != "" && ev.WebsiteID != "" {
			liveBySite[ev.WebsiteID] = append(liveBySite[ev.WebsiteID], ev.VisitorID)
		}
	}

	chResult, err := s.flushBatchToClickHouse(ctx, events)
	if err != nil {
		return nil, err
	}

	for siteID, visitorIDs := range liveBySite {
		if len(visitorIDs) == 0 {
			continue
		}
		hlKey := "sn:active:" + siteID
		args := make([]interface{}, len(visitorIDs))
		for i, v := range visitorIDs {
			args[i] = v
		}
		pipe := s.rdb.Pipeline()
		pipe.PFAdd(ctx, hlKey, args...)
		pipe.Expire(ctx, hlKey, 5*time.Minute)
		if _, err := pipe.Exec(ctx); err != nil {
			s.logger.Warn().Err(err).Str("site_id", siteID).Msg("Failed to update live visitor HyperLogLog")
		}
	}

	count := len(events)
	if chResult != nil {
		count = chResult.Processed
	}
	return &models.BatchEventResponse{
		Status:      "accepted",
		EventsCount: count,
		ProcessedAt: time.Now().Unix(),
	}, nil
}

// flushBatchToClickHouse resolves UUID website_id values and writes one batch to ClickHouse.
func (s *EventService) flushBatchToClickHouse(ctx context.Context, batch []models.Event) (*repository.BatchResult, error) {
	if len(batch) == 0 {
		return &repository.BatchResult{}, nil
	}

	start := time.Now()
	writeCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	siteIDMap := make(map[string]string)
	for i := range batch {
		ev := &batch[i]
		if len(ev.WebsiteID) > 24 {
			if resolved, ok := siteIDMap[ev.WebsiteID]; ok {
				ev.WebsiteID = resolved
			} else if website, err := s.websites.GetWebsiteByID(writeCtx, ev.WebsiteID); err == nil {
				siteIDMap[ev.WebsiteID] = website.SiteID
				ev.WebsiteID = website.SiteID
			}
		}
	}

	result, err := s.repo.CreateBatch(writeCtx, batch)
	if err != nil {
		s.logger.Error().
			Err(err).
			Int("count", len(batch)).
			Msg("Failed to flush event batch to ClickHouse")
		return nil, err
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

	return result, nil
}

func (s *EventService) Shutdown(timeout time.Duration) error {
	s.shutdownMu.Lock()
	s.isShutdown = true
	s.shutdownMu.Unlock()
	s.logger.Info().Msg("Event service shut down (sync writes only)")
	_ = timeout
	return nil
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

func (s *EventService) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"ingestion": "sync_clickhouse_per_call",
	}
}

func (s *EventService) enrichEventData(ctx context.Context, event *models.Event) {
	s.enrichEventShared(ctx, event, nil, nil)
}

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
