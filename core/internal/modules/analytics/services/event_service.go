package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/Seentics/seentics/internal/modules/analytics/models"
	"github.com/Seentics/seentics/internal/modules/analytics/repository"

	autoServicePkg "github.com/Seentics/seentics/internal/modules/automations/services"
	websiteServicePkg "github.com/Seentics/seentics/internal/modules/websites/services"
	"github.com/Seentics/seentics/internal/shared/utils"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
)

const (
	BatchSize     = 2000
	FlushInterval = 5 * time.Second

	eventStream = "sn:stream:events"
	eventGroup  = "seentics"
	eventWorker = "core-worker"
)

type EventService struct {
	repo     repository.EventRepository
	db       *pgxpool.Pool
	logger   zerolog.Logger
	websites *websiteServicePkg.WebsiteService
	auto     *autoServicePkg.AutomationService
	engine   *autoServicePkg.ExecutionEngine
	rdb      *redis.Client

	// Bounded semaphore: caps concurrent automation goroutines
	autoSem chan struct{}

	ctx        context.Context
	cancel     context.CancelFunc
	wg         sync.WaitGroup
	isShutdown bool
	shutdownMu sync.RWMutex
}

func NewEventService(repo repository.EventRepository, db *pgxpool.Pool, websiteSvc *websiteServicePkg.WebsiteService, autoSvc *autoServicePkg.AutomationService, logger zerolog.Logger, rdb *redis.Client, webhookQueue ...*autoServicePkg.WebhookQueue) *EventService {
	ctx, cancel := context.WithCancel(context.Background())

	var queue []*autoServicePkg.WebhookQueue
	if len(webhookQueue) > 0 {
		queue = webhookQueue
	}

	service := &EventService{
		repo:     repo,
		db:       db,
		websites: websiteSvc,
		auto:     autoSvc,
		engine:   autoServicePkg.NewExecutionEngine(autoSvc, logger, queue...),
		logger:   logger,
		rdb:      rdb,
		autoSem:  make(chan struct{}, 64),
		ctx:      ctx,
		cancel:   cancel,
	}

	// Ensure stream consumer group exists (ignore "already exists" error)
	bgCtx := context.Background()
	if err := rdb.XGroupCreateMkStream(bgCtx, eventStream, eventGroup, "$").Err(); err != nil {
		if !strings.Contains(err.Error(), "BUSYGROUP") {
			logger.Error().Err(err).Msg("Failed to create event stream consumer group")
		}
	}

	service.startStreamConsumer()
	return service
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

	if err := s.publishEvent(ctx, event); err != nil {
		s.logger.Warn().Err(err).Msg("Failed to publish event to stream, dropping")
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

	accepted := 0
	var liveVisitorIDs []string
	for i := range req.Events {
		req.Events[i].WebsiteID = req.SiteID
		if req.Events[i].EventType == "" {
			req.Events[i].EventType = "pageview"
		}
		if req.Events[i].Timestamp.IsZero() {
			req.Events[i].Timestamp = time.Now()
		}
		if req.ClientIP != "" && (req.Events[i].IPAddress == nil || *req.Events[i].IPAddress == "") {
			ip := req.ClientIP
			req.Events[i].IPAddress = &ip
		}
		if req.ClientUA != "" && (req.Events[i].UserAgent == nil || *req.Events[i].UserAgent == "") {
			ua := req.ClientUA
			req.Events[i].UserAgent = &ua
		}
		s.enrichEventData(ctx, &req.Events[i])

		if err := s.publishEvent(ctx, &req.Events[i]); err != nil {
			s.logger.Warn().Err(err).Msg("Failed to publish batch event to stream, dropping")
			continue
		}
		accepted++

		// Collect visitor IDs for realtime HyperLogLog tracking
		if req.Events[i].EventType == "pageview" && req.Events[i].VisitorID != "" {
			liveVisitorIDs = append(liveVisitorIDs, req.Events[i].VisitorID)
		}
	}

	// Batch PFADD for realtime active visitors (5-min sliding window)
	if len(liveVisitorIDs) > 0 {
		hlKey := fmt.Sprintf("active:%s", req.SiteID)
		args := make([]interface{}, len(liveVisitorIDs))
		for i, v := range liveVisitorIDs {
			args[i] = v
		}
		s.rdb.PFAdd(ctx, "sn:"+hlKey, args...)
		s.rdb.Expire(ctx, "sn:"+hlKey, 5*time.Minute)
	}

	return &models.BatchEventResponse{
		Status:      "accepted",
		EventsCount: accepted,
		ProcessedAt: time.Now().Unix(),
	}, nil
}

// publishEvent serialises event to JSON and pushes it onto the Redis Stream.
func (s *EventService) publishEvent(ctx context.Context, event *models.Event) error {
	data, err := json.Marshal(event)
	if err != nil {
		return err
	}
	return s.rdb.XAdd(ctx, &redis.XAddArgs{
		Stream: eventStream,
		MaxLen: 50000,
		Approx: true,
		Values: map[string]interface{}{"d": string(data)},
	}).Err()
}

// startStreamConsumer reads batches from the Redis Stream via a consumer group,
// triggers automations, writes to ClickHouse, then ACKs processed messages.
func (s *EventService) startStreamConsumer() {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()

		for {
			select {
			case <-s.ctx.Done():
				return
			default:
			}

			msgs, err := s.rdb.XReadGroup(s.ctx, &redis.XReadGroupArgs{
				Group:    eventGroup,
				Consumer: eventWorker,
				Streams:  []string{eventStream, ">"},
				Count:    BatchSize,
				Block:    FlushInterval,
			}).Result()

			if err != nil {
				if errors.Is(err, context.Canceled) {
					return
				}
				if errors.Is(err, redis.Nil) {
					continue // timeout with no new messages — normal
				}
				s.logger.Error().Err(err).Msg("Event stream read error")
				time.Sleep(time.Second)
				continue
			}

			if len(msgs) == 0 || len(msgs[0].Messages) == 0 {
				continue
			}

			rawMsgs := msgs[0].Messages
			batch := make([]models.Event, 0, len(rawMsgs))
			ids := make([]string, 0, len(rawMsgs))

			for _, msg := range rawMsgs {
				ids = append(ids, msg.ID)
				data, ok := msg.Values["d"].(string)
				if !ok {
					continue
				}
				var event models.Event
				if err := json.Unmarshal([]byte(data), &event); err != nil {
					continue
				}

				// Fire automations via bounded goroutine pool (non-blocking)
				eventData := map[string]interface{}{
					"event_type": event.EventType,
					"page":       event.Page,
					"visitor_id": event.VisitorID,
					"session_id": event.SessionID,
					"properties": event.Properties,
					"timestamp":  event.Timestamp,
				}
				websiteID := event.WebsiteID
				select {
				case s.autoSem <- struct{}{}:
					go func() {
						defer func() { <-s.autoSem }()
						s.engine.ProcessEvent(s.ctx, websiteID, eventData)
					}()
				default:
					s.logger.Warn().Str("website_id", websiteID).Msg("Automation worker pool full, skipping trigger")
				}

				batch = append(batch, event)
			}

			if len(batch) > 0 {
				s.processBatch(batch)
			}

			// ACK all messages (including malformed ones) so they don't pile up
			if len(ids) > 0 {
				s.rdb.XAck(context.Background(), eventStream, eventGroup, ids...)
			}
		}
	}()
}

// processBatch writes a batch to ClickHouse.
func (s *EventService) processBatch(batch []models.Event) {
	if len(batch) == 0 {
		return
	}

	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	for i := range batch {
		event := &batch[i]
		if len(event.WebsiteID) > 24 {
			if website, err := s.websites.GetWebsiteByAnyID(ctx, event.WebsiteID); err == nil {
				event.WebsiteID = website.SiteID
			}
		}
	}

	eventTypes := make(map[string]int)
	websiteIDs := make(map[string]int)
	for _, event := range batch {
		eventTypes[event.EventType]++
		websiteIDs[event.WebsiteID]++
	}

	s.logger.Info().
		Int("events_count", len(batch)).
		Interface("event_types", eventTypes).
		Interface("website_ids", websiteIDs).
		Msg("Processing batch")

	result, err := s.repo.CreateBatch(ctx, batch)
	if err != nil {
		s.logger.Error().
			Err(err).
			Int("events_count", len(batch)).
			Interface("event_types", eventTypes).
			Msg("Failed to process batch")
		return
	}

	s.logger.Info().
		Int("processed", result.Processed).
		Int("failed", result.Failed).
		Dur("duration", time.Since(start)).
		Interface("event_types", eventTypes).
		Msg("Batch processed successfully")

	if result.Failed > 0 {
		s.logger.Warn().
			Int("failed_count", result.Failed).
			Interface("errors", result.Errors).
			Msg("Some events failed in batch")
	}
}

// Shutdown gracefully stops the stream consumer.
func (s *EventService) Shutdown(timeout time.Duration) error {
	s.logger.Info().Msg("Shutting down event service")

	s.shutdownMu.Lock()
	s.isShutdown = true
	s.shutdownMu.Unlock()

	s.cancel()

	done := make(chan struct{})
	go func() {
		s.wg.Wait()
		close(done)
	}()

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

// GetStats returns Redis stream statistics.
func (s *EventService) GetStats() map[string]interface{} {
	ctx := context.Background()
	info, err := s.rdb.XInfoStream(ctx, eventStream).Result()
	if err != nil {
		return map[string]interface{}{
			"stream":         eventStream,
			"batch_size":     BatchSize,
			"flush_interval": FlushInterval.String(),
			"error":          err.Error(),
		}
	}
	return map[string]interface{}{
		"stream":        eventStream,
		"stream_length": info.Length,
		"batch_size":    BatchSize,
		"flush_interval": FlushInterval.String(),
	}
}

func (s *EventService) enrichEventData(ctx context.Context, event *models.Event) {
	if event.Page == "" && event.PagePath != "" {
		event.Page = event.PagePath
	}

	if event.UserAgent != nil && *event.UserAgent != "" {
		if (event.Browser == nil || *event.Browser == "") ||
			(event.Device == nil || *event.Device == "") ||
			(event.OS == nil || *event.OS == "") {

			uaInfo := utils.ParseUserAgent(*event.UserAgent)
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

		location := utils.GetLocationFromIP(*event.IPAddress)
		if event.Country == nil || *event.Country == "" {
			if location.Country != "" {
				event.Country = &location.Country
			}
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
