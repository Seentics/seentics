package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
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

const (
	BatchSize     = 2000
	FlushInterval = 5 * time.Second

	heatmapStream = "sn:stream:heatmap"
	heatmapGroup  = "seentics-heatmap"
	heatmapWorker = "heatmap-worker"
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

// urlAdmitScript atomically checks the URL quota and admits new URLs.
//
//	KEYS[1]  = Redis set key  (sn:heatmap:urls:{websiteID})
//	ARGV[1]  = limit
//	ARGV[2]  = number of URLs
//	ARGV[3+] = URL strings
//
// Returns the admitted URL list: all URLs if under limit, only existing ones if at/over limit.
var urlAdmitScript = redis.NewScript(`
local setKey = KEYS[1]
local limit  = tonumber(ARGV[1])
local n      = tonumber(ARGV[2])
local count  = tonumber(redis.call('SCARD', setKey))
local result = {}

if count >= limit then
    for i = 3, 2 + n do
        if redis.call('SISMEMBER', setKey, ARGV[i]) == 1 then
            result[#result+1] = ARGV[i]
        end
    end
else
    for i = 3, 2 + n do
        if ARGV[i] ~= '' then
            redis.call('SADD', setKey, ARGV[i])
            result[#result+1] = ARGV[i]
        end
    end
end
return result
`)

type heatmapService struct {
	repo     repository.HeatmapRepository
	websites *websiteServicePkg.WebsiteService
	logger   zerolog.Logger
	rdb      *redis.Client
	appCache *cache.Cache

	ctx        context.Context
	cancel     context.CancelFunc
	wg         sync.WaitGroup
	isShutdown bool
	shutdownMu sync.RWMutex
}

func NewHeatmapService(repo repository.HeatmapRepository, websites *websiteServicePkg.WebsiteService, logger zerolog.Logger, rdb *redis.Client, appCache ...*cache.Cache) HeatmapService {
	ctx, cancel := context.WithCancel(context.Background())

	s := &heatmapService{
		repo:     repo,
		websites: websites,
		logger:   logger,
		rdb:      rdb,
		ctx:      ctx,
		cancel:   cancel,
	}
	if len(appCache) > 0 {
		s.appCache = appCache[0]
	}

	// Ensure stream consumer group exists
	bgCtx := context.Background()
	if err := rdb.XGroupCreateMkStream(bgCtx, heatmapStream, heatmapGroup, "$").Err(); err != nil {
		if !strings.Contains(err.Error(), "BUSYGROUP") {
			logger.Error().Err(err).Msg("Failed to create heatmap stream consumer group")
		}
	}

	s.startStreamConsumer()
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

	// Quota enforcement via Redis Set
	if limit, ok := ctx.Value("max_heatmaps").(int); ok && limit > 0 {
		req.Points = s.admitPoints(ctx, req.WebsiteID, req.Points, limit)
		if len(req.Points) == 0 {
			return fmt.Errorf("heatmap limit reached (%d). cannot track new pages", limit)
		}
	}

	// Publish all points to the heatmap stream in a single pipeline round-trip.
	pipe := s.rdb.Pipeline()
	for i := range req.Points {
		req.Points[i].WebsiteID = req.WebsiteID
		if req.Points[i].URL == "" {
			continue
		}
		data, err := json.Marshal(req.Points[i])
		if err != nil {
			continue
		}
		pipe.XAdd(ctx, &redis.XAddArgs{
			Stream: heatmapStream,
			MaxLen: 200000,
			Approx: true,
			Values: map[string]interface{}{"d": string(data)},
		})
	}
	if _, err := pipe.Exec(ctx); err != nil {
		s.logger.Warn().Err(err).Msg("Heatmap: pipeline XADD failed")
	}

	return nil
}

// admitPoints uses a Redis Lua script to atomically check the URL quota
// and filter req.Points to only admitted URLs.
func (s *heatmapService) admitPoints(ctx context.Context, websiteID string, points []models.HeatmapPoint, limit int) []models.HeatmapPoint {
	// Collect unique non-empty URLs
	seen := make(map[string]struct{}, len(points))
	urls := make([]string, 0, len(points))
	for _, p := range points {
		if p.URL != "" {
			if _, exists := seen[p.URL]; !exists {
				seen[p.URL] = struct{}{}
				urls = append(urls, p.URL)
			}
		}
	}
	if len(urls) == 0 {
		return points
	}

	// Seed the Redis set from DB on first use (SETNX sentinel)
	s.ensureURLSet(ctx, websiteID)

	setKey := "sn:heatmap:urls:" + websiteID
	args := make([]interface{}, 2+len(urls))
	args[0] = limit
	args[1] = len(urls)
	for i, u := range urls {
		args[2+i] = u
	}

	admitted, err := urlAdmitScript.Run(ctx, s.rdb, []string{setKey}, args...).StringSlice()
	if err != nil {
		// Redis unavailable: fall through and allow all points
		return points
	}

	admittedSet := make(map[string]struct{}, len(admitted))
	for _, u := range admitted {
		admittedSet[u] = struct{}{}
	}

	filtered := points[:0]
	for _, p := range points {
		if _, ok := admittedSet[p.URL]; ok {
			filtered = append(filtered, p)
		}
	}
	return filtered
}

// ensureURLSet seeds the Redis set from DB on first use (one-time per website).
func (s *heatmapService) ensureURLSet(ctx context.Context, websiteID string) {
	sentinelKey := "sn:heatmap:seeded:" + websiteID
	seeded, err := s.rdb.SetNX(ctx, sentinelKey, "1", 0).Result()
	if err != nil || !seeded {
		return // already seeded or Redis error
	}
	tracked, err := s.repo.GetTrackedURLs(ctx, websiteID)
	if err != nil || len(tracked) == 0 {
		return
	}
	setKey := "sn:heatmap:urls:" + websiteID
	members := make([]interface{}, len(tracked))
	for i, u := range tracked {
		members[i] = u
	}
	s.rdb.SAdd(ctx, setKey, members...)
}

// startStreamConsumer reads batches from the heatmap stream, aggregates,
// writes to the database, and ACKs messages.
func (s *heatmapService) startStreamConsumer() {
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
				Group:    heatmapGroup,
				Consumer: heatmapWorker,
				Streams:  []string{heatmapStream, ">"},
				Count:    BatchSize,
				Block:    FlushInterval,
			}).Result()

			if err != nil {
				if errors.Is(err, context.Canceled) {
					return
				}
				if errors.Is(err, redis.Nil) {
					continue
				}
				s.logger.Error().Err(err).Msg("Heatmap stream read error")
				time.Sleep(time.Second)
				continue
			}

			if len(msgs) == 0 || len(msgs[0].Messages) == 0 {
				continue
			}

			rawMsgs := msgs[0].Messages
			batch := make([]models.HeatmapPoint, 0, len(rawMsgs))
			ids := make([]string, 0, len(rawMsgs))

			for _, msg := range rawMsgs {
				ids = append(ids, msg.ID)
				data, ok := msg.Values["d"].(string)
				if !ok {
					continue
				}
				var point models.HeatmapPoint
				if err := json.Unmarshal([]byte(data), &point); err != nil {
					continue
				}
				batch = append(batch, point)
			}

			if len(batch) > 0 {
				s.processBatch(batch)
			}

			if len(ids) > 0 {
				s.rdb.XAck(context.Background(), heatmapStream, heatmapGroup, ids...)
			}
		}
	}()
}

// processBatch aggregates and flushes a batch of heatmap points to the DB.
func (s *heatmapService) processBatch(batch []models.HeatmapPoint) {
	if len(batch) == 0 {
		return
	}

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

	ctx := context.Background()
	if err := s.repo.RecordHeatmapBatch(ctx, finalBatch); err != nil {
		s.logger.Error().Err(err).Int("points", len(finalBatch)).Msg("Failed to flush heatmap batch to DB")
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
	// Evict from Redis URL set so quota is recalculated
	s.rdb.SRem(ctx, "sn:heatmap:urls:"+canonicalID, url)
	s.invalidateHeatmapCache(canonicalID, url)
	return s.repo.DeleteHeatmapPage(ctx, canonicalID, url)
}

func (s *heatmapService) BulkDeleteHeatmapPages(ctx context.Context, websiteID string, urls []string, userID string) error {
	canonicalID, _, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return err
	}
	if len(urls) > 0 {
		members := make([]interface{}, len(urls))
		for i, u := range urls {
			members[i] = u
		}
		s.rdb.SRem(ctx, "sn:heatmap:urls:"+canonicalID, members...)
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
