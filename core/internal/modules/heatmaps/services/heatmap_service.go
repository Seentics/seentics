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
	"github.com/Seentics/seentics/internal/shared/cache"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
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
	// StartCacheWarmer proactively warms heatmap page lists for all active websites.
	StartCacheWarmer(ctx context.Context)
}

type heatmapService struct {
	repo     repository.HeatmapRepository
	websites *websiteServicePkg.WebsiteService
	logger   zerolog.Logger
	rdb      *redis.Client
	appCache *cache.Cache

	isShutdown bool
	shutdownMu sync.RWMutex
}

func NewHeatmapService(repo repository.HeatmapRepository, websites *websiteServicePkg.WebsiteService, logger zerolog.Logger, rdb *redis.Client, appCache ...*cache.Cache) HeatmapService {
	s := &heatmapService{
		repo:     repo,
		websites: websites,
		logger:   logger,
		rdb:      rdb,
	}
	if len(appCache) > 0 {
		s.appCache = appCache[0]
	}

	return s
}

func (s *heatmapService) RecordHeatmapData(ctx context.Context, req models.HeatmapRecordRequest, origin string) error {
	s.shutdownMu.RLock()
	if s.isShutdown {
		s.shutdownMu.RUnlock()
		return fmt.Errorf("service is shutdown")
	}
	s.shutdownMu.RUnlock()

	w, err := s.websites.GetWebsiteByAnyID(ctx, req.WebsiteID)
	if err != nil {
		return fmt.Errorf("invalid website_id: %s", req.WebsiteID)
	}
	if !w.IsActive {
		return fmt.Errorf("website is inactive: %s", req.WebsiteID)
	}
	req.WebsiteID = w.ID.String()

	if !s.websites.ValidateOriginDomain(origin, w.URL) {
		return fmt.Errorf("domain mismatch: origin=%s, expected=%s", origin, w.URL)
	}
	if !w.HeatmapEnabled {
		return fmt.Errorf("heatmap recording is manually disabled for this website. enable it in settings")
	}

	// Quota enforcement via DB query
	if limit, ok := ctx.Value("max_heatmaps").(int); ok && limit > 0 {
		count, err := s.repo.CountHeatmapPages(ctx, req.WebsiteID)
		if err != nil {
			s.logger.Warn().Err(err).Str("website_id", req.WebsiteID).Msg("Heatmap: failed to count pages for quota check")
			// On error, allow the request through rather than blocking
		} else if count >= limit {
			// At or over limit: only allow points for URLs that already exist
			existingURLs, err := s.repo.GetTrackedURLs(ctx, req.WebsiteID)
			if err != nil {
				s.logger.Warn().Err(err).Msg("Heatmap: failed to get tracked URLs for quota filtering")
			} else {
				existingSet := make(map[string]struct{}, len(existingURLs))
				for _, u := range existingURLs {
					existingSet[u] = struct{}{}
				}
				filtered := req.Points[:0]
				for _, p := range req.Points {
					if _, ok := existingSet[p.URL]; ok {
						filtered = append(filtered, p)
					}
				}
				req.Points = filtered
				if len(req.Points) == 0 {
					return fmt.Errorf("heatmap limit reached (%d). cannot track new pages", limit)
				}
			}
		}
	}

	// Filter out points with empty URLs and set website ID
	validPoints := make([]models.HeatmapPoint, 0, len(req.Points))
	for i := range req.Points {
		req.Points[i].WebsiteID = req.WebsiteID
		if req.Points[i].URL == "" {
			continue
		}
		validPoints = append(validPoints, req.Points[i])
	}

	if len(validPoints) == 0 {
		return nil
	}

	// Aggregate points before writing to DB
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
	for _, p := range validPoints {
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

	// Write directly to PostgreSQL
	if err := s.repo.RecordHeatmapBatch(ctx, finalBatch); err != nil {
		s.logger.Error().Err(err).Int("points", len(finalBatch)).Msg("Failed to write heatmap batch to DB")
		return fmt.Errorf("failed to record heatmap data")
	}

	// Invalidate cached heatmap pages so new data appears immediately
	if s.appCache != nil {
		s.appCache.Delete(fmt.Sprintf("heatmap:pages:%s", req.WebsiteID))
	}

	return nil
}

func (s *heatmapService) Shutdown(timeout time.Duration) error {
	s.logger.Info().Msg("Shutting down heatmap service")
	s.shutdownMu.Lock()
	s.isShutdown = true
	s.shutdownMu.Unlock()
	return nil
}

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

	if s.appCache != nil {
		cacheKey := fmt.Sprintf("heatmap:data:%s:%s:%s:%s:%d", canonicalID, url, heatmapType, deviceType, from.Unix())
		var cached []models.HeatmapPoint
		if s.appCache.Get(cacheKey, &cached) {
			return cached, nil
		}
		result, err := s.repo.GetHeatmapData(ctx, canonicalID, url, heatmapType, deviceType, from, to)
		if err != nil {
			return nil, err
		}
		_ = s.appCache.Set(cacheKey, result, 3*time.Minute)
		return result, nil
	}

	return s.repo.GetHeatmapData(ctx, canonicalID, url, heatmapType, deviceType, from, to)
}

func (s *heatmapService) GetHeatmapPages(ctx context.Context, websiteID string, userID string) ([]models.HeatmapPageStat, error) {
	canonicalID, _, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}

	if s.appCache != nil {
		cacheKey := fmt.Sprintf("heatmap:pages:%s", canonicalID)
		var cached []models.HeatmapPageStat
		if s.appCache.Get(cacheKey, &cached) {
			return cached, nil
		}
		result, err := s.repo.GetHeatmapPages(ctx, canonicalID)
		if err != nil {
			return nil, err
		}
		_ = s.appCache.Set(cacheKey, result, 3*time.Minute)
		return result, nil
	}

	return s.repo.GetHeatmapPages(ctx, canonicalID)
}

func (s *heatmapService) GetTrackedURLs(ctx context.Context, websiteID string) ([]string, error) {
	return s.repo.GetTrackedURLs(ctx, websiteID)
}

func (s *heatmapService) GetTopElements(ctx context.Context, websiteID string, url string, eventType string, from, to time.Time, userID string) ([]models.TopElement, error) {
	canonicalID, _, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}

	if s.appCache != nil {
		cacheKey := fmt.Sprintf("heatmap:elements:%s:%s:%s:%d", canonicalID, url, eventType, from.Unix())
		var cached []models.TopElement
		if s.appCache.Get(cacheKey, &cached) {
			return cached, nil
		}
		result, err := s.repo.GetTopElements(ctx, canonicalID, url, eventType, from, to)
		if err != nil {
			return nil, err
		}
		_ = s.appCache.Set(cacheKey, result, 3*time.Minute)
		return result, nil
	}

	return s.repo.GetTopElements(ctx, canonicalID, url, eventType, from, to)
}

func (s *heatmapService) DeleteHeatmapPage(ctx context.Context, websiteID string, url string, userID string) error {
	canonicalID, _, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return err
	}
	s.invalidateHeatmapCache(canonicalID, url)
	return s.repo.DeleteHeatmapPage(ctx, canonicalID, url)
}

func (s *heatmapService) BulkDeleteHeatmapPages(ctx context.Context, websiteID string, urls []string, userID string) error {
	canonicalID, _, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return err
	}
	for _, url := range urls {
		s.invalidateHeatmapCache(canonicalID, url)
	}
	return s.repo.BulkDeleteHeatmapPages(ctx, canonicalID, urls)
}

// invalidateHeatmapCache clears cached page lists and per-URL data/element caches
// so that deletions are immediately reflected in the UI.
func (s *heatmapService) invalidateHeatmapCache(canonicalID string, url string) {
	if s.appCache == nil {
		return
	}
	// Clear the page list cache for this website
	s.appCache.Delete(fmt.Sprintf("heatmap:pages:%s", canonicalID))
	// Clear cached heatmap data and element data for the deleted URL
	s.appCache.DeleteByPattern(fmt.Sprintf("heatmap:data:%s:%s:*", canonicalID, url))
	s.appCache.DeleteByPattern(fmt.Sprintf("heatmap:elements:%s:%s:*", canonicalID, url))
}

// ── Cache warmer ──────────────────────────────────────────────────────────────

// StartCacheWarmer proactively warms the heatmap page list cache for all active
// websites every 90 seconds so the first visit to the heatmaps page is instant.
func (s *heatmapService) StartCacheWarmer(ctx context.Context) {
	if s.appCache == nil || s.websites == nil {
		s.logger.Info().Msg("Heatmap cache warmer: skipped (cache or websites service not available)")
		return
	}

	go func() {
		select {
		case <-time.After(10 * time.Second):
		case <-ctx.Done():
			return
		}

		s.logger.Info().Msg("Heatmap cache warmer: started")
		s.warmHeatmapPages(ctx)

		ticker := time.NewTicker(90 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				s.warmHeatmapPages(ctx)
			case <-ctx.Done():
				s.logger.Info().Msg("Heatmap cache warmer: stopped")
				return
			}
		}
	}()
}

func (s *heatmapService) warmHeatmapPages(ctx context.Context) {
	uuids, err := s.websites.ListAllActiveWebsiteUUIDs(ctx)
	if err != nil {
		s.logger.Warn().Err(err).Msg("Heatmap cache warmer: failed to list active sites")
		return
	}

	sem := make(chan struct{}, 10)
	var wg sync.WaitGroup

	for _, id := range uuids {
		select {
		case <-ctx.Done():
			break
		default:
		}

		wg.Add(1)
		sem <- struct{}{}
		go func(websiteUUID string) {
			defer wg.Done()
			defer func() { <-sem }()

			cacheKey := fmt.Sprintf("heatmap:pages:%s", websiteUUID)
			if s.appCache.Exists(cacheKey) {
				return
			}

			warmCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
			defer cancel()

			pages, err := s.repo.GetHeatmapPages(warmCtx, websiteUUID)
			if err != nil {
				return
			}
			_ = s.appCache.Set(cacheKey, pages, 3*time.Minute)
		}(id)
	}

	wg.Wait()
	s.logger.Debug().Int("sites", len(uuids)).Msg("Heatmap cache warmer: cycle complete")
}
