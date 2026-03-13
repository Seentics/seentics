package services

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/Seentics/seentics/internal/modules/analytics/models"
	"github.com/Seentics/seentics/internal/modules/analytics/repository"
	websiteServicePkg "github.com/Seentics/seentics/internal/modules/websites/services"
	"github.com/Seentics/seentics/internal/shared/cache"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"golang.org/x/sync/errgroup"
)

// Cache TTLs for analytics results.
const (
	cacheTTLDashboard = 30 * time.Second
	cacheTTLStats     = 1 * time.Minute
	cacheTTLTopN      = 3 * time.Minute
	cacheTTLHeavy     = 5 * time.Minute
)

// filtersKey returns a short hash of the filters for cache key construction.
// Empty filters produce an empty string so keys stay short for the common case.
func filtersKey(f models.AnalyticsFilters) string {
	if !f.HasFilters() {
		return ""
	}
	raw, _ := json.Marshal(f)
	h := sha256.Sum256(raw)
	return hex.EncodeToString(h[:8])
}

// cachedQuery checks Redis for a cached result keyed by cacheKey.
// On miss it calls queryFn, caches the result with the given TTL, and returns it.
// If the cache is nil or any cache operation fails, it falls through to queryFn.
func cachedQuery[T any](c *cache.Cache, cacheKey string, ttl time.Duration, queryFn func() (T, error)) (T, error) {
	if c != nil {
		var cached T
		if c.Get(cacheKey, &cached) {
			return cached, nil
		}
	}

	result, err := queryFn()
	if err != nil {
		return result, err
	}

	if c != nil {
		_ = c.Set(cacheKey, result, ttl)
	}
	return result, nil
}

type AnalyticsService struct {
	repo     repository.MainAnalyticsRepository
	websites *websiteServicePkg.WebsiteService
	cache    *cache.Cache
	logger   zerolog.Logger
}

func NewAnalyticsService(repo repository.MainAnalyticsRepository, websites *websiteServicePkg.WebsiteService, logger zerolog.Logger, appCache ...*cache.Cache) *AnalyticsService {
	svc := &AnalyticsService{
		repo:     repo,
		websites: websites,
		logger:   logger,
	}
	if len(appCache) > 0 {
		svc.cache = appCache[0]
	}
	return svc
}

// resolveWebsiteID canonicalizes the website ID to its hex SiteID form
func (s *AnalyticsService) resolveWebsiteID(ctx context.Context, websiteID string) string {
	if s.websites == nil {
		return websiteID
	}
	website, err := s.websites.GetWebsiteByAnyID(ctx, websiteID)
	if err != nil {
		return websiteID
	}
	return website.SiteID
}

// validateOwnership ensures the website belongs to the user
func (s *AnalyticsService) validateOwnership(ctx context.Context, websiteID string, userID string) (string, error) {
	if userID == "" {
		return "", fmt.Errorf("user_id is required")
	}

	uid, err := uuid.Parse(userID)
	if err != nil {
		return "", fmt.Errorf("invalid user_id format")
	}

	w, err := s.websites.GetWebsiteByAnyID(ctx, websiteID)
	if err != nil {
		return "", fmt.Errorf("website not found")
	}

	if w.UserID != uid {
		return "", fmt.Errorf("unauthorized access to website data")
	}

	return w.SiteID, nil
}

func (s *AnalyticsService) GetDashboard(ctx context.Context, websiteID string, days int, timezone string, filters models.AnalyticsFilters, userID string) (*models.DashboardData, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	websiteID = canonicalID

	cacheKey := fmt.Sprintf("analytics:dashboard:%s:%d:%s:%s", websiteID, days, timezone, filtersKey(filters))
	return cachedQuery(s.cache, cacheKey, cacheTTLDashboard, func() (*models.DashboardData, error) {
		g, gCtx := errgroup.WithContext(ctx)

		var metrics *models.DashboardMetrics
		var comparison *models.ComparisonMetrics
		var liveVisitors int

		g.Go(func() error {
			var err error
			metrics, err = s.repo.GetDashboardMetrics(gCtx, websiteID, days, timezone, filters)
			if err != nil {
				s.logger.Error().Err(err).Msg("Failed to get dashboard metrics")
				return fmt.Errorf("failed to get dashboard metrics: %w", err)
			}
			return nil
		})

		if days <= 30 {
			g.Go(func() error {
				var err error
				comparison, err = s.repo.GetComparisonMetrics(gCtx, websiteID, days, timezone, filters)
				if err != nil {
					s.logger.Warn().Err(err).Msg("Failed to get comparison metrics")
					return nil
				}
				return nil
			})
		}

		g.Go(func() error {
			var err error
			liveVisitors, err = s.repo.GetLiveVisitors(gCtx, websiteID)
			if err != nil {
				s.logger.Warn().Err(err).Msg("Failed to get live visitors")
				liveVisitors = 0
			}
			return nil
		})

		if err := g.Wait(); err != nil {
			return nil, err
		}

		return &models.DashboardData{
			WebsiteID:         websiteID,
			DateRange:         days,
			TotalVisitors:     metrics.TotalVisitors,
			UniqueVisitors:    metrics.UniqueVisitors,
			LiveVisitors:      liveVisitors,
			PageViews:         metrics.PageViews,
			SessionDuration:   metrics.AvgSessionTime,
			BounceRate:        metrics.BounceRate,
			Comparison:        comparison,
			Metrics:           metrics,
			TopResolutions:    []models.TopItem{},
			NewVisitors:       0,
			ReturningVisitors: 0,
		}, nil
	})
}

func (s *AnalyticsService) GetTopPages(ctx context.Context, websiteID string, days, limit int, timezone string, filters models.AnalyticsFilters, userID string) ([]models.PageStat, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	cacheKey := fmt.Sprintf("analytics:top_pages:%s:%d:%d:%s:%s", canonicalID, days, limit, timezone, filtersKey(filters))
	return cachedQuery(s.cache, cacheKey, cacheTTLTopN, func() ([]models.PageStat, error) {
		return s.repo.GetTopPages(ctx, canonicalID, days, timezone, limit, filters)
	})
}

func (s *AnalyticsService) GetPageUTMBreakdown(ctx context.Context, websiteID, pagePath string, days int, userID string) (map[string]interface{}, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	h := sha256.Sum256([]byte(pagePath))
	pathHash := hex.EncodeToString(h[:8])
	cacheKey := fmt.Sprintf("analytics:page_utm:%s:%s:%d", canonicalID, pathHash, days)
	return cachedQuery(s.cache, cacheKey, cacheTTLTopN, func() (map[string]interface{}, error) {
		return s.repo.GetPageUTMBreakdown(ctx, canonicalID, pagePath, days)
	})
}

func (s *AnalyticsService) GetTopReferrers(ctx context.Context, websiteID string, days, limit int, timezone string, filters models.AnalyticsFilters, userID string) ([]models.ReferrerStat, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	cacheKey := fmt.Sprintf("analytics:top_referrers:%s:%d:%d:%s:%s", canonicalID, days, limit, timezone, filtersKey(filters))
	return cachedQuery(s.cache, cacheKey, cacheTTLTopN, func() ([]models.ReferrerStat, error) {
		return s.repo.GetTopReferrers(ctx, canonicalID, days, timezone, limit, filters)
	})
}

func (s *AnalyticsService) GetTopSources(ctx context.Context, websiteID string, days, limit int, timezone string, filters models.AnalyticsFilters, userID string) ([]models.SourceStat, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	cacheKey := fmt.Sprintf("analytics:top_sources:%s:%d:%d:%s:%s", canonicalID, days, limit, timezone, filtersKey(filters))
	return cachedQuery(s.cache, cacheKey, cacheTTLTopN, func() ([]models.SourceStat, error) {
		return s.repo.GetTopSources(ctx, canonicalID, days, timezone, limit, filters)
	})
}

func (s *AnalyticsService) GetTopCountries(ctx context.Context, websiteID string, days, limit int, timezone string, filters models.AnalyticsFilters, userID string) ([]models.CountryStat, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	cacheKey := fmt.Sprintf("analytics:top_countries:%s:%d:%d:%s:%s", canonicalID, days, limit, timezone, filtersKey(filters))
	return cachedQuery(s.cache, cacheKey, cacheTTLTopN, func() ([]models.CountryStat, error) {
		return s.repo.GetTopCountries(ctx, canonicalID, days, timezone, limit, filters)
	})
}

func (s *AnalyticsService) GetTopBrowsers(ctx context.Context, websiteID string, days, limit int, timezone string, filters models.AnalyticsFilters, userID string) ([]models.BrowserStat, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	cacheKey := fmt.Sprintf("analytics:top_browsers:%s:%d:%d:%s:%s", canonicalID, days, limit, timezone, filtersKey(filters))
	return cachedQuery(s.cache, cacheKey, cacheTTLTopN, func() ([]models.BrowserStat, error) {
		return s.repo.GetTopBrowsers(ctx, canonicalID, days, timezone, limit, filters)
	})
}

func (s *AnalyticsService) GetTopDevices(ctx context.Context, websiteID string, days, limit int, timezone string, filters models.AnalyticsFilters, userID string) ([]models.DeviceStat, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	cacheKey := fmt.Sprintf("analytics:top_devices:%s:%d:%d:%s:%s", canonicalID, days, limit, timezone, filtersKey(filters))
	return cachedQuery(s.cache, cacheKey, cacheTTLTopN, func() ([]models.DeviceStat, error) {
		return s.repo.GetTopDevices(ctx, canonicalID, days, timezone, limit, filters)
	})
}

func (s *AnalyticsService) GetTopResolutions(ctx context.Context, websiteID string, days, limit int, userID string) ([]models.TopItem, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	cacheKey := fmt.Sprintf("analytics:top_resolutions:%s:%d:%d", canonicalID, days, limit)
	return cachedQuery(s.cache, cacheKey, cacheTTLTopN, func() ([]models.TopItem, error) {
		return s.repo.GetTopResolutions(ctx, canonicalID, days, limit)
	})
}

func (s *AnalyticsService) GetTopOS(ctx context.Context, websiteID string, days, limit int, timezone string, filters models.AnalyticsFilters, userID string) ([]models.OSStat, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	cacheKey := fmt.Sprintf("analytics:top_os:%s:%d:%d:%s:%s", canonicalID, days, limit, timezone, filtersKey(filters))
	return cachedQuery(s.cache, cacheKey, cacheTTLTopN, func() ([]models.OSStat, error) {
		return s.repo.GetTopOS(ctx, canonicalID, days, timezone, limit, filters)
	})
}

func (s *AnalyticsService) GetTrafficSummary(ctx context.Context, websiteID string, days int, timezone string, userID string) (*models.TrafficSummary, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	cacheKey := fmt.Sprintf("analytics:traffic_summary:%s:%d:%s", canonicalID, days, timezone)
	return cachedQuery(s.cache, cacheKey, cacheTTLTopN, func() (*models.TrafficSummary, error) {
		return s.repo.GetTrafficSummary(ctx, canonicalID, days, timezone)
	})
}

func (s *AnalyticsService) GetDailyStats(ctx context.Context, websiteID string, days int, timezone string, filters models.AnalyticsFilters, userID string) ([]models.DailyStat, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	if days <= 0 {
		days = 30
	}
	cacheKey := fmt.Sprintf("analytics:daily_stats:%s:%d:%s:%s", canonicalID, days, timezone, filtersKey(filters))
	return cachedQuery(s.cache, cacheKey, cacheTTLStats, func() ([]models.DailyStat, error) {
		return s.repo.GetDailyStats(ctx, canonicalID, days, timezone, filters)
	})
}

func (s *AnalyticsService) GetHourlyStats(ctx context.Context, websiteID string, days int, timezone string, filters models.AnalyticsFilters, userID string) ([]models.HourlyStat, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	cacheKey := fmt.Sprintf("analytics:hourly_stats:%s:%d:%s:%s", canonicalID, days, timezone, filtersKey(filters))
	return cachedQuery(s.cache, cacheKey, cacheTTLStats, func() ([]models.HourlyStat, error) {
		return s.repo.GetHourlyStats(ctx, canonicalID, days, timezone, filters)
	})
}

func (s *AnalyticsService) GetCustomEvents(ctx context.Context, websiteID string, days int, userID string) ([]models.CustomEventStat, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	cacheKey := fmt.Sprintf("analytics:custom_events:%s:%d", canonicalID, days)
	return cachedQuery(s.cache, cacheKey, cacheTTLTopN, func() ([]models.CustomEventStat, error) {
		return s.repo.GetCustomEventStats(ctx, canonicalID, days)
	})
}

// CustomEventsData holds combined custom events and UTM data from a single ownership check.
type CustomEventsData struct {
	Events []models.CustomEventStat
	UTM    map[string]interface{}
}

// GetCustomEventsWithUTM validates ownership once then fetches both custom events and UTM data.
func (s *AnalyticsService) GetCustomEventsWithUTM(ctx context.Context, websiteID string, days int, userID string) (*CustomEventsData, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	cacheKey := fmt.Sprintf("analytics:custom_events_utm:%s:%d", canonicalID, days)
	return cachedQuery(s.cache, cacheKey, cacheTTLTopN, func() (*CustomEventsData, error) {
		events, err := s.repo.GetCustomEventStats(ctx, canonicalID, days)
		if err != nil {
			return nil, err
		}
		utm, err := s.repo.GetUTMAnalytics(ctx, canonicalID, days)
		if err != nil {
			utm = map[string]interface{}{}
		}
		return &CustomEventsData{Events: events, UTM: utm}, nil
	})
}

func (s *AnalyticsService) GetLiveVisitors(ctx context.Context, websiteID string, userID string) (int, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return 0, err
	}

	// Fast path: read from Redis HyperLogLog (sub-ms, no ClickHouse query)
	if s.cache != nil {
		hlKey := fmt.Sprintf("active:%s", canonicalID)
		count, err := s.cache.PFCount(hlKey)
		if err == nil && count > 0 {
			return int(count), nil
		}
	}

	// Fallback: query ClickHouse
	return s.repo.GetLiveVisitors(ctx, canonicalID)
}

func (s *AnalyticsService) GetUTMAnalytics(ctx context.Context, websiteID string, days int, userID string) (map[string]interface{}, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	cacheKey := fmt.Sprintf("analytics:utm:%s:%d", canonicalID, days)
	return cachedQuery(s.cache, cacheKey, cacheTTLTopN, func() (map[string]interface{}, error) {
		return s.repo.GetUTMAnalytics(ctx, canonicalID, days)
	})
}

func (s *AnalyticsService) GetGeolocationBreakdown(ctx context.Context, websiteID string, days int, timezone string, userID string) (*models.GeolocationBreakdown, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}

	cacheKey := fmt.Sprintf("analytics:geo:%s:%d:%s", canonicalID, days, timezone)
	return cachedQuery(s.cache, cacheKey, cacheTTLHeavy, func() (*models.GeolocationBreakdown, error) {
		loc, err := time.LoadLocation(timezone)
		if err != nil {
			loc = time.UTC
		}
		now := time.Now().In(loc)
		startOfToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
		startDate := startOfToday.AddDate(0, 0, -(days - 1)).UTC()
		endDate := time.Now().UTC()

		breakdown, err := s.repo.GetGeolocationBreakdown(ctx, canonicalID, startDate, endDate)
		if err != nil {
			return nil, fmt.Errorf("failed to get geolocation breakdown: %w", err)
		}

		if breakdown == nil {
			return &models.GeolocationBreakdown{
				Countries:  []models.TopItem{},
				Cities:     []models.TopItem{},
				Continents: []models.TopItem{},
				Regions:    []models.TopItem{},
			}, nil
		}

		return breakdown, nil
	})
}

func (s *AnalyticsService) GetVisitorInsights(ctx context.Context, websiteID string, days int, timezone string, userID string) (*models.VisitorInsights, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	cacheKey := fmt.Sprintf("analytics:visitor_insights:%s:%d:%s", canonicalID, days, timezone)
	return cachedQuery(s.cache, cacheKey, cacheTTLHeavy, func() (*models.VisitorInsights, error) {
		return s.repo.GetVisitorInsights(ctx, canonicalID, days, timezone)
	})
}

func (s *AnalyticsService) GetActivityTrends(ctx context.Context, websiteID string, timezone string, userID string) (*models.ActivityTrendsResponse, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	cacheKey := fmt.Sprintf("analytics:activity_trends:%s:%s", canonicalID, timezone)
	return cachedQuery(s.cache, cacheKey, cacheTTLHeavy, func() (*models.ActivityTrendsResponse, error) {
		return s.repo.GetActivityTrends(ctx, canonicalID, timezone)
	})
}

func (s *AnalyticsService) GetGoalStats(ctx context.Context, websiteID string, days int, userID string) ([]models.EventItem, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	cacheKey := fmt.Sprintf("analytics:goal_stats:%s:%d", canonicalID, days)
	return cachedQuery(s.cache, cacheKey, cacheTTLTopN, func() ([]models.EventItem, error) {
		return s.repo.GetGoalStats(ctx, canonicalID, days)
	})
}

func (s *AnalyticsService) ExportWebsiteData(ctx context.Context, websiteID string, days int, format string, userID string) ([]byte, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	websiteID = canonicalID

	metrics, err := s.repo.GetDashboardMetrics(ctx, websiteID, days, "UTC", models.AnalyticsFilters{})
	if err != nil {
		return nil, err
	}

	pages, _ := s.repo.GetTopPages(ctx, websiteID, days, "UTC", 100, models.AnalyticsFilters{})
	sources, _ := s.repo.GetTopSources(ctx, websiteID, days, "UTC", 100, models.AnalyticsFilters{})

	exportData := struct {
		WebsiteID  string                   `json:"website_id"`
		Period     int                      `json:"period_days"`
		Metrics    *models.DashboardMetrics `json:"metrics"`
		TopPages   []models.PageStat        `json:"top_pages"`
		Sources    []models.SourceStat      `json:"top_sources"`
		ExportedAt time.Time                `json:"exported_at"`
	}{
		WebsiteID:  websiteID,
		Period:     days,
		Metrics:    metrics,
		TopPages:   pages,
		Sources:    sources,
		ExportedAt: time.Now(),
	}

	if format == "csv" {
		var buf bytes.Buffer
		buf.WriteString("Metric,Value\n")
		buf.WriteString(fmt.Sprintf("Total Visitors,%d\n", metrics.TotalVisitors))
		buf.WriteString(fmt.Sprintf("Unique Visitors,%d\n", metrics.UniqueVisitors))
		buf.WriteString(fmt.Sprintf("Page Views,%d\n", metrics.PageViews))
		buf.WriteString(fmt.Sprintf("Avg Session Duration,%.2f\n", metrics.AvgSessionTime))
		buf.WriteString(fmt.Sprintf("Bounce Rate,%.2f\n", metrics.BounceRate))
		return buf.Bytes(), nil
	}

	return json.MarshalIndent(exportData, "", "  ")
}

func (s *AnalyticsService) ImportWebsiteData(ctx context.Context, websiteID string, source string, data []byte, userID string) (int, error) {
	_, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return 0, err
	}
	return 0, fmt.Errorf("import not implemented")
}

func (s *AnalyticsService) GetRealtimeData(ctx context.Context, websiteID string, userID string, timezone string) (*models.RealtimeData, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	cacheKey := fmt.Sprintf("analytics:realtime:%s:%s", canonicalID, timezone)
	return cachedQuery(s.cache, cacheKey, 5*time.Second, func() (*models.RealtimeData, error) {
		return s.repo.GetRealtimeData(ctx, canonicalID, timezone)
	})
}

func (s *AnalyticsService) GetRecentActivity(ctx context.Context, websiteID string, limit int, userID string) ([]models.RecentActivity, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	cacheKey := fmt.Sprintf("analytics:recent_activity:%s:%d", canonicalID, limit)
	return cachedQuery(s.cache, cacheKey, cacheTTLStats, func() ([]models.RecentActivity, error) {
		return s.repo.GetRecentActivity(ctx, canonicalID, limit)
	})
}

func (s *AnalyticsService) GetTopLanguages(ctx context.Context, websiteID string, days int, timezone string, userID string) ([]models.TopItem, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	cacheKey := fmt.Sprintf("analytics:languages:%s:%d:%s", canonicalID, days, timezone)
	return cachedQuery(s.cache, cacheKey, cacheTTLTopN, func() ([]models.TopItem, error) {
		return s.repo.GetTopLanguages(ctx, canonicalID, days, timezone, 20)
	})
}

func (s *AnalyticsService) GetTopCities(ctx context.Context, websiteID string, days int, timezone string, userID string) ([]models.TopItem, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}
	cacheKey := fmt.Sprintf("analytics:cities:%s:%d:%s", canonicalID, days, timezone)
	return cachedQuery(s.cache, cacheKey, cacheTTLTopN, func() ([]models.TopItem, error) {
		return s.repo.GetTopCities(ctx, canonicalID, days, timezone, 20)
	})
}

func (s *AnalyticsService) GetPathAnalysis(ctx context.Context, websiteID string, days int, userID string) (*models.PathAnalysis, error) {
	canonicalID, err := s.validateOwnership(ctx, websiteID, userID)
	if err != nil {
		return nil, err
	}

	cacheKey := fmt.Sprintf("analytics:path_analysis:%s:%d", canonicalID, days)
	return cachedQuery(s.cache, cacheKey, cacheTTLHeavy, func() (*models.PathAnalysis, error) {
		g, gCtx := errgroup.WithContext(ctx)

		var entryPages []models.TopItem
		var exitPages []models.TopItem
		var pageFlows []models.PageFlow
		var avgPathLength float64

		g.Go(func() error {
			var e error
			entryPages, e = s.repo.GetEntryPages(gCtx, canonicalID, days, 10)
			return e
		})
		g.Go(func() error {
			var e error
			exitPages, e = s.repo.GetExitPages(gCtx, canonicalID, days, 10)
			return e
		})
		g.Go(func() error {
			var e error
			pageFlows, e = s.repo.GetPageFlows(gCtx, canonicalID, days, 30)
			return e
		})
		g.Go(func() error {
			var e error
			avgPathLength, e = s.repo.GetAvgPathLength(gCtx, canonicalID, days)
			return e
		})

		if err := g.Wait(); err != nil {
			return nil, err
		}

		return &models.PathAnalysis{
			TopEntryPages: entryPages,
			TopExitPages:  exitPages,
			PageFlows:     pageFlows,
			AvgPathLength: avgPathLength,
		}, nil
	})
}

// StartCacheWarmer launches a background goroutine that proactively warms the
// Redis cache for all active websites. This ensures that even the very first
// dashboard visit serves data from cache (sub-ms) instead of hitting ClickHouse.
//
// Warmed queries use the default parameters (7 days, UTC, no filters) which
// covers the vast majority of first-visit dashboard loads.
func (s *AnalyticsService) StartCacheWarmer(ctx context.Context) {
	if s.cache == nil || s.websites == nil {
		s.logger.Info().Msg("Cache warmer: skipped (cache or websites service not available)")
		return
	}

	go func() {
		// Small initial delay so the rest of the app finishes booting.
		select {
		case <-time.After(5 * time.Second):
		case <-ctx.Done():
			return
		}

		s.logger.Info().Msg("Cache warmer: started")
		s.warmAll(ctx)

		ticker := time.NewTicker(90 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				s.warmAll(ctx)
			case <-ctx.Done():
				s.logger.Info().Msg("Cache warmer: stopped")
				return
			}
		}
	}()
}

// warmAll fetches all active site IDs and warms their default dashboard queries.
func (s *AnalyticsService) warmAll(ctx context.Context) {
	siteIDs, err := s.websites.ListAllActiveSiteIDs(ctx)
	if err != nil {
		s.logger.Warn().Err(err).Msg("Cache warmer: failed to list active sites")
		return
	}

	// Bounded parallelism — at most 10 sites warming concurrently.
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
			s.warmSite(ctx, siteID)
		}(id)
	}

	wg.Wait()
	s.logger.Debug().Int("sites", len(siteIDs)).Msg("Cache warmer: cycle complete")
}

// warmSite pre-computes the above-the-fold dashboard queries for a single site
// using default parameters (7 days, UTC, no filters).
func (s *AnalyticsService) warmSite(ctx context.Context, siteID string) {
	const days = 7
	const tz = "UTC"
	noFilters := models.AnalyticsFilters{}

	warmCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	// Dashboard metrics + comparison + live visitors
	dashKey := fmt.Sprintf("analytics:dashboard:%s:%d:%s:", siteID, days, tz)
	if !s.cache.Exists(dashKey) {
		g, gCtx := errgroup.WithContext(warmCtx)
		var metrics *models.DashboardMetrics
		var comparison *models.ComparisonMetrics
		var liveVisitors int

		g.Go(func() error {
			var err error
			metrics, err = s.repo.GetDashboardMetrics(gCtx, siteID, days, tz, noFilters)
			return err
		})
		g.Go(func() error {
			var err error
			comparison, err = s.repo.GetComparisonMetrics(gCtx, siteID, days, tz, noFilters)
			if err != nil {
				comparison = nil
			}
			return nil
		})
		g.Go(func() error {
			var err error
			liveVisitors, err = s.repo.GetLiveVisitors(gCtx, siteID)
			if err != nil {
				liveVisitors = 0
			}
			return nil
		})

		if err := g.Wait(); err == nil && metrics != nil {
			data := &models.DashboardData{
				WebsiteID:         siteID,
				DateRange:         days,
				TotalVisitors:     metrics.TotalVisitors,
				UniqueVisitors:    metrics.UniqueVisitors,
				LiveVisitors:      liveVisitors,
				PageViews:         metrics.PageViews,
				SessionDuration:   metrics.AvgSessionTime,
				BounceRate:        metrics.BounceRate,
				Comparison:        comparison,
				Metrics:           metrics,
				TopResolutions:    []models.TopItem{},
				NewVisitors:       0,
				ReturningVisitors: 0,
			}
			_ = s.cache.Set(dashKey, data, cacheTTLDashboard)
		}
	}

	// Daily stats (above the fold)
	dailyKey := fmt.Sprintf("analytics:daily_stats:%s:%d:%s:", siteID, days, tz)
	if !s.cache.Exists(dailyKey) {
		if stats, err := s.repo.GetDailyStats(warmCtx, siteID, days, tz, noFilters); err == nil {
			_ = s.cache.Set(dailyKey, stats, cacheTTLStats)
		}
	}

	// Hourly stats (above the fold)
	hourlyKey := fmt.Sprintf("analytics:hourly_stats:%s:1:%s:", siteID, tz)
	if !s.cache.Exists(hourlyKey) {
		if stats, err := s.repo.GetHourlyStats(warmCtx, siteID, 1, tz, noFilters); err == nil {
			_ = s.cache.Set(hourlyKey, stats, cacheTTLStats)
		}
	}

	// Visitor insights (above the fold)
	insightsKey := fmt.Sprintf("analytics:visitor_insights:%s:%d:%s", siteID, days, tz)
	if !s.cache.Exists(insightsKey) {
		if insights, err := s.repo.GetVisitorInsights(warmCtx, siteID, days, tz); err == nil {
			_ = s.cache.Set(insightsKey, insights, cacheTTLHeavy)
		}
	}

	// Path analysis
	pathKey := fmt.Sprintf("analytics:path_analysis:%s:%d", siteID, days)
	if !s.cache.Exists(pathKey) {
		g, gCtx := errgroup.WithContext(warmCtx)
		var entryPages, exitPages []models.TopItem
		var pageFlows []models.PageFlow
		var avgPathLength float64

		g.Go(func() error { var e error; entryPages, e = s.repo.GetEntryPages(gCtx, siteID, days, 10); return e })
		g.Go(func() error { var e error; exitPages, e = s.repo.GetExitPages(gCtx, siteID, days, 10); return e })
		g.Go(func() error { var e error; pageFlows, e = s.repo.GetPageFlows(gCtx, siteID, days, 30); return e })
		g.Go(func() error { var e error; avgPathLength, e = s.repo.GetAvgPathLength(gCtx, siteID, days); return e })

		if err := g.Wait(); err == nil {
			_ = s.cache.Set(pathKey, &models.PathAnalysis{
				TopEntryPages: entryPages,
				TopExitPages:  exitPages,
				PageFlows:     pageFlows,
				AvgPathLength: avgPathLength,
			}, cacheTTLHeavy)
		}
	}
}
