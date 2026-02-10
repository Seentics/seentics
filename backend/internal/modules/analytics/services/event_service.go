package services

import (
	"analytics-app/internal/modules/analytics/models"
	"analytics-app/internal/modules/analytics/repository"
	"analytics-app/internal/shared/kafka"
	"context"
	"fmt"
	"sync"
	"time"

	autoServicePkg "analytics-app/internal/modules/automations/services"
	billingModels "analytics-app/internal/modules/billing/models"
	billingServicePkg "analytics-app/internal/modules/billing/services"
	websiteServicePkg "analytics-app/internal/modules/websites/services"
	"analytics-app/internal/shared/utils"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
)

const (
	// Optimized batch collection for better throughput
	BatchSize     = 1000
	FlushInterval = 5 * time.Second // Increased from 2s to balance latency vs efficiency
)

type usageUpdate struct {
	userID string
	count  int
}

type EventService struct {
	repo     *repository.EventRepository
	db       *pgxpool.Pool
	logger   zerolog.Logger
	kafka    *kafka.KafkaService
	billing  *billingServicePkg.BillingService
	websites *websiteServicePkg.WebsiteService
	auto     *autoServicePkg.AutomationService // Added for orchestration
	engine   *autoServicePkg.ExecutionEngine   // Added for execution

	// Simple event channel for async processing (now fed from Kafka)
	batchChan chan []models.Event
	usageChan chan usageUpdate // Channel for async user usage increments

	// Shutdown control
	ctx            context.Context
	cancel         context.CancelFunc
	wg             sync.WaitGroup
	isShutdown     bool
	shutdownMu     sync.RWMutex
	partitionCache sync.Map // cache for verified partitions
}

func NewEventService(repo *repository.EventRepository, db *pgxpool.Pool, kafkaSvc *kafka.KafkaService, billingSvc *billingServicePkg.BillingService, websiteSvc *websiteServicePkg.WebsiteService, autoSvc *autoServicePkg.AutomationService, logger zerolog.Logger) *EventService {
	ctx, cancel := context.WithCancel(context.Background())

	service := &EventService{
		repo:      repo,
		db:        db,
		kafka:     kafkaSvc,
		billing:   billingSvc,
		websites:  websiteSvc,
		auto:      autoSvc,
		engine:    autoServicePkg.NewExecutionEngine(autoSvc, logger),
		logger:    logger,
		batchChan: make(chan []models.Event, 500),
		usageChan: make(chan usageUpdate, 10000), // Large buffer for usage increments
		ctx:       ctx,
		cancel:    cancel,
	}

	// Start Kafka consumer and internal batch processor
	service.startKafkaConsumer()
	service.startBatchProcessor()
	service.startUsageProcessor()

	return service
}

func (s *EventService) startUsageProcessor() {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		s.logger.Info().Msg("Starting Usage Increment Processor")
		for {
			select {
			case update := <-s.usageChan:
				err := s.billing.IncrementUsageRedis(context.Background(), update.userID, billingModels.ResourceMonthlyEvents, update.count)
				if err != nil {
					s.logger.Error().Err(err).Str("user_id", update.userID).Msg("Failed to increment usage")
				}
			case <-s.ctx.Done():
				// Drain remaining updates with a timeout
				s.logger.Info().Msg("Usage processor stopping, draining channel...")
				return
			}
		}
	}()
}

// ensurePartitionExists checks if a partition exists for the given date and creates it if needed
func (s *EventService) ensurePartitionExists(ctx context.Context, targetDate time.Time) error {
	// Calculate partition boundaries (monthly partitions)
	startOfMonth := time.Date(targetDate.Year(), targetDate.Month(), 1, 0, 0, 0, 0, time.UTC)
	endOfMonth := startOfMonth.AddDate(0, 1, 0)

	partitionName := fmt.Sprintf("events_y%dm%02d", startOfMonth.Year(), startOfMonth.Month())

	// Check in-memory cache first to avoid DB roundtrip
	if _, cached := s.partitionCache.Load(partitionName); cached {
		return nil
	}

	startDate := startOfMonth.Format("2006-01-02")
	endDate := endOfMonth.Format("2006-01-02")

	// Check if partition already exists in DB
	var exists bool
	checkQuery := `
		SELECT EXISTS (
			SELECT 1 FROM pg_tables 
			WHERE tablename = $1 AND schemaname = 'public'
		)
	`
	err := s.db.QueryRow(ctx, checkQuery, partitionName).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check if partition exists: %w", err)
	}

	if !exists {
		// Create the partition
		createQuery := fmt.Sprintf(
			"CREATE TABLE IF NOT EXISTS %s PARTITION OF events FOR VALUES FROM ('%s') TO ('%s')",
			partitionName, startDate, endDate,
		)
		_, err := s.db.Exec(ctx, createQuery)
		if err != nil {
			return fmt.Errorf("failed to create partition %s: %w", partitionName, err)
		}
		s.logger.Info().
			Str("partition_name", partitionName).
			Str("start_date", startDate).
			Str("end_date", endDate).
			Msg("Created new partition")
	}

	// Store in cache for future events this month
	s.partitionCache.Store(partitionName, true)

	return nil
}

func (s *EventService) TrackEvent(ctx context.Context, event *models.Event) (*models.EventResponse, error) {
	// Quick shutdown check
	s.shutdownMu.RLock()
	if s.isShutdown {
		s.shutdownMu.RUnlock()
		return nil, fmt.Errorf("service is shutdown")
	}
	s.shutdownMu.RUnlock()

	// 1. Validate Website and Domain
	website, err := s.websites.GetWebsiteBySiteID(ctx, event.WebsiteID)
	if err != nil {
		return nil, fmt.Errorf("invalid website_id")
	}

	// Canonicalize WebsiteID to ensure consistency in storage and querying
	event.WebsiteID = website.SiteID

	if !website.IsActive {
		return nil, fmt.Errorf("website is inactive")
	}

	// Domain Validation
	origin := ""
	if event.Referrer != nil {
		origin = *event.Referrer
	}
	if !s.websites.ValidateOriginDomain(origin, website.URL) {
		s.logger.Warn().
			Str("referrer", origin).
			Str("site_domain", website.URL).
			Msg("Domain mismatch")
		return nil, fmt.Errorf("domain mismatch")
	}

	// 2. Check billing limits
	can, err := s.billing.CanTrackEvent(ctx, website.UserID.String())
	if err != nil || !can {
		return nil, fmt.Errorf("monthly event limit reached")
	}

	// Validate and set defaults
	if event.EventType == "" {
		event.EventType = "pageview"
	}
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}

	// Enrich event data
	s.enrichEventData(ctx, event)

	// Produce to Kafka
	if err := s.kafka.ProduceEvent(ctx, *event); err != nil {
		s.logger.Error().Err(err).Msg("Failed to produce event to Kafka")
		return nil, fmt.Errorf("failed to process event")
	}

	// Increment event count via buffered channel to avoid goroutine leaks
	s.logger.Debug().Str("user_id", website.UserID.String()).Msg("Queueing usage increment")
	select {
	case s.usageChan <- usageUpdate{userID: website.UserID.String(), count: 1}:
	default:
		s.logger.Warn().Str("user_id", website.UserID.String()).Msg("Usage channel full, dropping increment")
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

	// Resolve SiteID to canonical SiteID if possible
	website, err := s.websites.GetWebsiteBySiteID(ctx, req.SiteID)
	if err != nil {
		return nil, fmt.Errorf("invalid website_id: %s", req.SiteID)
	}

	if !website.IsActive {
		return nil, fmt.Errorf("website is inactive")
	}

	// Validate Domain for the batch based on the first event or provided domain
	// We check against the first event's referrer or a common domain in the request if available
	testOrigin := ""
	if len(req.Events) > 0 && req.Events[0].Referrer != nil {
		testOrigin = *req.Events[0].Referrer
	}
	if !s.websites.ValidateOriginDomain(testOrigin, website.URL) {
		return nil, fmt.Errorf("domain mismatch")
	}

	req.SiteID = website.SiteID
	userID := website.UserID.String()

	// Process and enrich all events
	accepted := 0
	for i := range req.Events {
		// ALWAYS force WebsiteID to the canonicalized req.SiteID
		req.Events[i].WebsiteID = req.SiteID

		if req.Events[i].EventType == "" {
			req.Events[i].EventType = "pageview"
		}
		if req.Events[i].Timestamp.IsZero() {
			req.Events[i].Timestamp = time.Now()
		}

		s.enrichEventData(ctx, &req.Events[i])

		// Produce to Kafka
		if err := s.kafka.ProduceEvent(ctx, req.Events[i]); err != nil {
			s.logger.Error().Err(err).Msg("Failed to produce batch event to Kafka")
			continue
		}
		accepted++
	}

	// Increment usage if we identified the user
	if userID != "" && accepted > 0 {
		select {
		case s.usageChan <- usageUpdate{userID: userID, count: accepted}:
		default:
			s.logger.Warn().Str("user_id", userID).Msg("Usage channel full, dropping batch increment")
		}
	}

	return &models.BatchEventResponse{
		Status:      "accepted",
		EventsCount: accepted,
		ProcessedAt: time.Now().Unix(),
	}, nil
}

// startKafkaConsumer consumes from Kafka and feeds into the batch processor
func (s *EventService) startKafkaConsumer() {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()

		eventChan := make(chan models.Event, BatchSize*2)
		kafkaCtx, kafkaCancel := context.WithCancel(s.ctx)
		defer kafkaCancel()

		// Run Kafka consumer in a separate goroutine
		go s.kafka.ConsumeEvents(kafkaCtx, func(event models.Event) error {
			// Trigger automations (async)
			eventData := map[string]interface{}{
				"event_type": event.EventType,
				"page":       event.Page,
				"visitor_id": event.VisitorID,
				"session_id": event.SessionID,
				"properties": event.Properties,
				"timestamp":  event.Timestamp,
			}
			go s.engine.ProcessEvent(s.ctx, event.WebsiteID, eventData)

			select {
			case eventChan <- event:
				return nil
			case <-kafkaCtx.Done():
				return kafkaCtx.Err()
			}
		})

		ticker := time.NewTicker(FlushInterval)
		defer ticker.Stop()

		batch := make([]models.Event, 0, BatchSize)

		for {
			select {
			case <-s.ctx.Done():
				if len(batch) > 0 {
					s.sendBatch(batch)
				}
				return
			case event := <-eventChan:
				batch = append(batch, event)
				if len(batch) >= BatchSize {
					s.sendBatch(batch)
					batch = make([]models.Event, 0, BatchSize)
					ticker.Reset(FlushInterval)
				}
			case <-ticker.C:
				if len(batch) > 0 {
					s.sendBatch(batch)
					batch = make([]models.Event, 0, BatchSize)
				}
			}
		}
	}()
}

// sendBatch sends a batch to the processor
func (s *EventService) sendBatch(batch []models.Event) {
	batchCopy := make([]models.Event, len(batch))
	copy(batchCopy, batch)

	select {
	case s.batchChan <- batchCopy:
		s.logger.Debug().Int("batch_size", len(batchCopy)).Msg("Batch sent for processing")
	case <-s.ctx.Done():
		s.logger.Warn().Msg("Batch dropped during shutdown")
	default:
		s.logger.Warn().Msg("Batch channel full, dropping batch")
	}
}

// startBatchProcessor processes batches and writes to DB
func (s *EventService) startBatchProcessor() {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()

		for {
			select {
			case <-s.ctx.Done():
				// Process remaining batches
				for {
					select {
					case batch := <-s.batchChan:
						s.processBatch(batch)
					default:
						return
					}
				}

			case batch := <-s.batchChan:
				s.processBatch(batch)
			}
		}
	}()
}

// processBatch writes a batch to the database
func (s *EventService) processBatch(batch []models.Event) {
	if len(batch) == 0 {
		return
	}

	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Ensure partitions exist for all events in the batch
	uniqueDates := make(map[string]time.Time)
	for i := range batch {
		event := &batch[i]

		// Failsafe normalization: ensure website_id is canonical
		// We do this here too because Kafka messages might have been produced using the old UUID
		// if the producer service hadn't been updated yet or if there's a leak.
		if len(event.WebsiteID) > 24 { // Likely a UUID
			if website, err := s.websites.GetWebsiteBySiteID(ctx, event.WebsiteID); err == nil {
				event.WebsiteID = website.SiteID
			}
		}

		if !event.Timestamp.IsZero() {
			dateKey := event.Timestamp.Format("2006-01")
			uniqueDates[dateKey] = event.Timestamp
		}
	}

	// Create partitions for unique months
	for _, eventTime := range uniqueDates {
		if err := s.ensurePartitionExists(ctx, eventTime); err != nil {
			s.logger.Warn().
				Err(err).
				Time("event_time", eventTime).
				Msg("Failed to ensure partition exists, continuing anyway")
		}
	}

	// Log event types and website IDs in the batch
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

	duration := time.Since(start)
	s.logger.Info().
		Int("processed", result.Processed).
		Int("failed", result.Failed).
		Int("total", result.Total).
		Dur("duration", duration).
		Interface("event_types", eventTypes).
		Msg("Batch processed successfully")

	if result.Failed > 0 {
		s.logger.Warn().
			Int("failed_count", result.Failed).
			Interface("errors", result.Errors).
			Msg("Some events failed in batch")
	}
}

// Shutdown gracefully shuts down the service
func (s *EventService) Shutdown(timeout time.Duration) error {
	s.logger.Info().Msg("Shutting down event service")

	// Mark as shutdown to prevent new events
	s.shutdownMu.Lock()
	s.isShutdown = true
	s.shutdownMu.Unlock()

	// Signal shutdown
	s.cancel()

	// Wait for workers to finish with timeout
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

// GetStats returns service statistics
func (s *EventService) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"batch_queue_size": len(s.batchChan),
		"batch_queue_cap":  cap(s.batchChan),
		"batch_size":       BatchSize,
		"flush_interval":   FlushInterval.String(),
	}
}

func (s *EventService) enrichEventData(ctx context.Context, event *models.Event) {
	// Handle page_path alias from trackers
	if event.Page == "" && event.PagePath != "" {
		event.Page = event.PagePath
	}

	// Parse user agent if provided
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

	// Get comprehensive geolocation from IP
	if (event.Country == nil || *event.Country == "") &&
		(event.IPAddress != nil && *event.IPAddress != "") {

		location := utils.GetLocationFromIP(*event.IPAddress)

		// Set country information - use full country name for the country field
		if event.Country == nil || *event.Country == "" {
			// Use full country name for the country field
			if location.Country != "" {
				event.Country = &location.Country
			}
		}
		if event.CountryCode == nil || *event.CountryCode == "" {
			event.CountryCode = &location.CountryCode
		}

		// Set city information
		if event.City == nil || *event.City == "" {
			event.City = &location.City
		}

		// Set continent information
		if event.Continent == nil || *event.Continent == "" {
			event.Continent = &location.Continent
		}

		// Set coordinates for real-time visualization
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
