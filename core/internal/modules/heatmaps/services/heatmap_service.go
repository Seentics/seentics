package services

import (
	"context"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/Seentics/seentics/internal/modules/heatmaps/models"
	"github.com/Seentics/seentics/internal/modules/heatmaps/repository"
	websiteServicePkg "github.com/Seentics/seentics/internal/modules/websites/services"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

const (
	BatchSize     = 2000
	FlushInterval = 5 * time.Second
)

type HeatmapService interface {
	RecordHeatmapData(ctx context.Context, req models.HeatmapRecordRequest, origin string) error
	GetHeatmapData(ctx context.Context, websiteID string, url string, heatmapType string, deviceType string, from, to time.Time, userID string) ([]models.HeatmapPoint, error)
	GetHeatmapPages(ctx context.Context, websiteID string, userID string) ([]models.HeatmapPageStat, error)
	GetTrackedURLs(ctx context.Context, websiteID string) ([]string, error)
	GetTopElements(ctx context.Context, websiteID string, url string, eventType string, from, to time.Time, userID string) ([]models.TopElement, error)
	DeleteHeatmapPage(ctx context.Context, websiteID string, url string, userID string) error
	BulkDeleteHeatmapPages(ctx context.Context, websiteID string, urls []string, userID string) error
	Shutdown(timeout time.Duration) error
}

func (s *heatmapService) RecordHeatmapData(ctx context.Context, req models.HeatmapRecordRequest, origin string) error {
	s.shutdownMu.RLock()
	if s.isShutdown {
		s.shutdownMu.RUnlock()
		return fmt.Errorf("service is shutdown")
	}
	s.shutdownMu.RUnlock()

	// Validate website existence
	w, err := s.websites.GetWebsiteByAnyID(ctx, req.WebsiteID)
	if err != nil {
		return fmt.Errorf("invalid website_id: %s", req.WebsiteID)
	}

	if !w.IsActive {
		return fmt.Errorf("website is inactive: %s", req.WebsiteID)
	}

	// Canonicalize website ID
	req.WebsiteID = w.ID.String()

	// 1. Domain Validation
	if !s.websites.ValidateOriginDomain(origin, w.URL) {
		return fmt.Errorf("domain mismatch: origin=%s, expected=%s", origin, w.URL)
	}

	// 2. Feature Toggle Check
	if !w.HeatmapEnabled {
		return fmt.Errorf("heatmap recording is manually disabled for this website. enable it in settings")
	}

	// 3. Quota Enforcement (Enterprise Mode)
	// If max_heatmaps is present in context, we must ensure we don't exceed the number of unique URLs.
	if limit, ok := ctx.Value("max_heatmaps").(int); ok && limit > 0 {
		tracked, err := s.repo.GetTrackedURLs(ctx, req.WebsiteID)
		if err == nil {
			// Create a map for fast lookup of existing tracked URLs
			trackedMap := make(map[string]bool)
			for _, u := range tracked {
				trackedMap[u] = true
			}

			// If we are at or over the limit, we only allow points for ALREADY tracked URLs.
			if len(tracked) >= limit {
				// Check if ALL points in this request are for existing URLs.
				// If any point is for a NEW URL, we must block/filter it.
				filteredPoints := make([]models.HeatmapPoint, 0, len(req.Points))
				for _, p := range req.Points {
					if trackedMap[p.URL] {
						filteredPoints = append(filteredPoints, p)
					}
				}

				if len(filteredPoints) == 0 && len(req.Points) > 0 {
					return fmt.Errorf("heatmap limit reached (%d/%d). cannot track new pages", len(tracked), limit)
				}
				req.Points = filteredPoints
			}
		}
	}

	// Push points to buffer
	for i := range req.Points {
		req.Points[i].WebsiteID = req.WebsiteID
		if req.Points[i].URL == "" {
			// If URL is missing, it's likely a bad request from tracker or old version
			continue
		}
		select {
		case s.pointsChan <- req.Points[i]:
			// Success
		default:
			s.logger.Warn().Msg("Heatmap points channel full, dropping point")
		}
	}

	return nil
}

type heatmapService struct {
	repo     repository.HeatmapRepository
	websites *websiteServicePkg.WebsiteService
	logger   zerolog.Logger

	pointsChan chan models.HeatmapPoint
	batchChan  chan []models.HeatmapPoint

	ctx        context.Context
	cancel     context.CancelFunc
	wg         sync.WaitGroup
	isShutdown bool
	shutdownMu sync.RWMutex
}

func NewHeatmapService(repo repository.HeatmapRepository, websites *websiteServicePkg.WebsiteService, logger zerolog.Logger) HeatmapService {
	ctx, cancel := context.WithCancel(context.Background())

	s := &heatmapService{
		repo:       repo,
		websites:   websites,
		logger:     logger,
		pointsChan: make(chan models.HeatmapPoint, 20000), // Larger buffer for dense heatmap data
		batchChan:  make(chan []models.HeatmapPoint, 500),
		ctx:        ctx,
		cancel:     cancel,
	}

	s.startHeatmapConsumer()
	s.startBatchProcessor()

	return s
}

func (s *heatmapService) startHeatmapConsumer() {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()

		ticker := time.NewTicker(FlushInterval)
		defer ticker.Stop()

		batch := make([]models.HeatmapPoint, 0, BatchSize)

		for {
			select {
			case <-s.ctx.Done():
				if len(batch) > 0 {
					s.sendBatch(batch)
				}
				return
			case point := <-s.pointsChan:
				batch = append(batch, point)
				if len(batch) >= BatchSize {
					s.sendBatch(batch)
					batch = make([]models.HeatmapPoint, 0, BatchSize)
					ticker.Reset(FlushInterval)
				}
			case <-ticker.C:
				if len(batch) > 0 {
					s.sendBatch(batch)
					batch = make([]models.HeatmapPoint, 0, BatchSize)
				}
			}
		}
	}()
}

func (s *heatmapService) sendBatch(batch []models.HeatmapPoint) {
	// Aggregate points in the batch to reduce DB load
	// key format: website_id:page_path:event_type:device_type:x_percent:y_percent:selector
	type aggKey struct {
		WebsiteID string
		PagePath  string
		EventType string
		Device    string
		X         int
		Y         int
		Selector  string
	}

	aggregated := make(map[aggKey]int)
	for _, p := range batch {
		key := aggKey{
			WebsiteID: p.WebsiteID,
			PagePath:  p.URL,
			EventType: p.Type,
			Device:    p.DeviceType,
			X:         int(math.Round(p.XPercent * 100)),
			Y:         int(math.Round(p.YPercent * 100)),
			Selector:  p.Selector,
		}
		aggregated[key]++
	}

	// Convert back to points for repository (carrying intensity)
	finalBatch := make([]models.HeatmapPoint, 0, len(aggregated))
	for k, count := range aggregated {
		finalBatch = append(finalBatch, models.HeatmapPoint{
			WebsiteID:  k.WebsiteID,
			URL:        k.PagePath,
			Type:       k.EventType,
			DeviceType: k.Device,
			XPercent:   float64(k.X) / 100.0,
			YPercent:   float64(k.Y) / 100.0,
			Selector:   k.Selector,
			Intensity:  count,
		})
	}

	select {
	case s.batchChan <- finalBatch:
		// Success
	case <-s.ctx.Done():
		s.logger.Warn().Msg("Heatmap batch dropped during shutdown")
	default:
		s.logger.Warn().Msg("Heatmap batch channel full, dropping batch")
	}
}

func (s *heatmapService) startBatchProcessor() {
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()

		for {
			select {
			case <-s.ctx.Done():
				// Flush remaining batches
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

func (s *heatmapService) processBatch(batch []models.HeatmapPoint) {
	if len(batch) == 0 {
		return
	}

	// Note: We need to group by websiteID because the repo call takes websiteID as arg
	// In the future, the repo could be updated to take points with WebsiteID internally.
	// For now, we group by websiteID.
	byWebsite := make(map[string][]models.HeatmapPoint)
	for _, p := range batch {
		byWebsite[p.WebsiteID] = append(byWebsite[p.WebsiteID], p)
	}

	ctx := context.Background()
	for websiteID, points := range byWebsite {
		if err := s.repo.RecordHeatmap(ctx, websiteID, points); err != nil {
			s.logger.Error().Err(err).Str("website_id", websiteID).Msg("Failed to flush heatmap batch to DB")
		}
	}
}

func (s *heatmapService) Shutdown(timeout time.Duration) error {
	s.logger.Info().Msg("Shutting down heatmap service")
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
		return nil
	case <-time.After(timeout):
		return fmt.Errorf("heatmap service shutdown timed out")
	}
}

// validateOwnership ensures the website belongs to the user and returns (canonicalUUID, siteID, error)
func (s *heatmapService) validateOwnership(ctx context.Context, websiteID string, userID string) (string, string, error) {
	if userID == "" {
		return "", "", fmt.Errorf("user_id is required")
	}

	uid, err := uuid.Parse(userID)
	if err != nil {
		return "", "", fmt.Errorf("invalid user_id format")
	}

	w, err := s.websites.GetWebsiteByAnyID(ctx, websiteID)
	if err != nil {
		return "", "", fmt.Errorf("website not found")
	}

	if w.UserID != uid {
		return "", "", fmt.Errorf("unauthorized access to website data")
	}

	return w.ID.String(), w.SiteID, nil
}

func (s *heatmapService) GetHeatmapData(ctx context.Context, websiteID string, url string, heatmapType string, deviceType string, from, to time.Time, userID string) ([]models.HeatmapPoint, error) {
	canonicalID, _, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetHeatmapData(ctx, canonicalID, url, heatmapType, deviceType, from, to)
}

func (s *heatmapService) GetHeatmapPages(ctx context.Context, websiteID string, userID string) ([]models.HeatmapPageStat, error) {
	canonicalID, _, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetHeatmapPages(ctx, canonicalID)
}

func (s *heatmapService) GetTrackedURLs(ctx context.Context, websiteID string) ([]string, error) {
	// Note: We don't use validateOwnership here because this is called by the internal WebsiteService
	// for the tracker config, which already has the website object.
	return s.repo.GetTrackedURLs(ctx, websiteID)
}

func (s *heatmapService) GetTopElements(ctx context.Context, websiteID string, url string, eventType string, from, to time.Time, userID string) ([]models.TopElement, error) {
	canonicalID, _, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	return s.repo.GetTopElements(ctx, canonicalID, url, eventType, from, to)
}

func (s *heatmapService) DeleteHeatmapPage(ctx context.Context, websiteID string, url string, userID string) error {
	canonicalID, _, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return err
	}
	return s.repo.DeleteHeatmapPage(ctx, canonicalID, url)
}

func (s *heatmapService) BulkDeleteHeatmapPages(ctx context.Context, websiteID string, urls []string, userID string) error {
	canonicalID, _, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return err
	}
	return s.repo.BulkDeleteHeatmapPages(ctx, canonicalID, urls)
}
