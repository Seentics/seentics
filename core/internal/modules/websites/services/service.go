package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/url"
	"strings"
	"time"

	authRepoPkg "github.com/Seentics/seentics/internal/modules/auth/repository"
	"github.com/Seentics/seentics/internal/modules/websites/models"
	"github.com/Seentics/seentics/internal/modules/websites/repository"

	heatmapRepoPkg "github.com/Seentics/seentics/internal/modules/heatmaps/repository"

	analyticsRepoPkg "github.com/Seentics/seentics/internal/modules/analytics/repository"
	autoRepoPkg "github.com/Seentics/seentics/internal/modules/automations/repository"
	funnelRepoPkg "github.com/Seentics/seentics/internal/modules/funnels/repository"
	replayRepoPkg "github.com/Seentics/seentics/internal/modules/replays/repository"
	"github.com/Seentics/seentics/internal/shared/cache"
	"github.com/Seentics/seentics/internal/shared/storage"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

type WebsiteService struct {
	repo          *repository.WebsiteRepository
	authRepo      *authRepoPkg.AuthRepository
	heatmapRepo   heatmapRepoPkg.HeatmapRepository
	analyticsRepo analyticsRepoPkg.MainAnalyticsRepository
	eventRepo     analyticsRepoPkg.EventRepository
	autoRepo      *autoRepoPkg.AutomationRepository
	funnelRepo    *funnelRepoPkg.FunnelRepository
	replayRepo    replayRepoPkg.ReplayRepository
	s3Store       *storage.S3Store
	cache         *cache.Cache
	env           string
	logger        zerolog.Logger
}

func NewWebsiteService(
	repo *repository.WebsiteRepository,
	authRepo *authRepoPkg.AuthRepository,
	heatmapRepo heatmapRepoPkg.HeatmapRepository,
	analyticsRepo analyticsRepoPkg.MainAnalyticsRepository,
	eventRepo analyticsRepoPkg.EventRepository,
	autoRepo *autoRepoPkg.AutomationRepository,
	funnelRepo *funnelRepoPkg.FunnelRepository,
	replayRepo replayRepoPkg.ReplayRepository,
	s3Store *storage.S3Store,
	cache *cache.Cache,
	env string,
	logger zerolog.Logger,
) *WebsiteService {
	return &WebsiteService{
		repo:          repo,
		authRepo:      authRepo,
		heatmapRepo:   heatmapRepo,
		analyticsRepo: analyticsRepo,
		eventRepo:     eventRepo,
		autoRepo:      autoRepo,
		funnelRepo:    funnelRepo,
		replayRepo:    replayRepo,
		s3Store:       s3Store,
		cache:         cache,
		env:           env,
		logger:        logger,
	}
}

// trackerConfigCache holds the cacheable portion of tracker config (goals + tracked URLs).
// Plan limits (max_heatmaps/max_replays) are NOT cached here because they come from
// the gateway context and vary per request.
type trackerConfigCache struct {
	Goals       []map[string]interface{} `json:"goals"`
	TrackedURLs []string                 `json:"tracked_urls"`
}

// GetTrackerConfig returns the configuration for the tracker script.
// Goals and tracked URLs are cached in Redis for 15 minutes to avoid
// DB queries on every tracker init request.
func (s *WebsiteService) GetTrackerConfig(ctx context.Context, siteID string, origin string) (map[string]interface{}, error) {
	w, err := s.GetWebsiteBySiteID(ctx, siteID)
	if err != nil {
		return nil, err
	}

	// Domain Validation
	if !s.ValidateOriginDomain(origin, w.URL) {
		return nil, fmt.Errorf("domain mismatch")
	}

	// Try cache for goals + tracked URLs
	cacheKey := fmt.Sprintf("tracker:config:%s", w.SiteID)
	var cached trackerConfigCache
	cacheHit := s.cache != nil && s.cache.Get(cacheKey, &cached)

	if !cacheHit {
		goals, err := s.repo.ListGoals(ctx, w.ID)
		if err != nil {
			return nil, err
		}

		cached.Goals = make([]map[string]interface{}, 0)
		for _, g := range goals {
			if g.Type == "event" && g.Selector != nil && *g.Selector != "" {
				cached.Goals = append(cached.Goals, map[string]interface{}{
					"id":       g.ID,
					"name":     g.Identifier,
					"selector": *g.Selector,
				})
			}
		}

		cached.TrackedURLs = []string{}
		if w.HeatmapEnabled {
			if urls, err := s.heatmapRepo.GetTrackedURLs(ctx, w.ID.String()); err == nil {
				cached.TrackedURLs = urls
			}
		}

		if s.cache != nil {
			s.cache.Set(cacheKey, cached, 15*time.Minute)
		}
	}

	// Plan limits come from gateway context and vary per request — never cached.
	maxHeatmaps := -1
	if limit, ok := ctx.Value("max_heatmaps").(int); ok {
		maxHeatmaps = limit
	}
	maxReplays := -1
	if limit, ok := ctx.Value("max_replays").(int); ok {
		maxReplays = limit
	}

	return map[string]interface{}{
		"site_id":                  w.SiteID,
		"automation_enabled":       w.AutomationEnabled,
		"funnel_enabled":           w.FunnelEnabled,
		"heatmap_enabled":          w.HeatmapEnabled,
		"heatmap_include_patterns": w.HeatmapIncludePatterns,
		"heatmap_exclude_patterns": w.HeatmapExcludePatterns,
		"max_heatmaps":             maxHeatmaps,
		"tracked_urls":             cached.TrackedURLs,
		"replay_enabled":           w.ReplayEnabled,
		"replay_sampling_rate":     w.ReplaySamplingRate,
		"replay_include_patterns":  w.ReplayIncludePatterns,
		"replay_exclude_patterns":  w.ReplayExcludePatterns,
		"max_replays":              maxReplays,
		"goals":                    cached.Goals,
	}, nil
}

// CreateWebsite creates a new website tracking profile
func (s *WebsiteService) CreateWebsite(ctx context.Context, userID uuid.UUID, req models.CreateWebsiteRequest) (*models.Website, error) {
	// 0. Validate Domain
	if req.URL == "" {
		return nil, fmt.Errorf("website URL is required")
	}

	rawURL := req.URL
	if !strings.HasPrefix(rawURL, "http://") && !strings.HasPrefix(rawURL, "https://") {
		rawURL = "https://" + rawURL
	}

	parsedURL, err := url.Parse(rawURL)
	if err != nil || parsedURL.Hostname() == "" {
		return nil, fmt.Errorf("invalid website URL format")
	}

	// Normalize URL: include port if present, but strip www.
	normalizedURL := strings.TrimPrefix(parsedURL.Host, "www.")

	// Generate unique 24-char site_id (KSUID/NanoID style)
	siteID := generateID(12) // 24 hex chars

	// Generate tracking ID (looks like 'ST-XXXXXXXX')
	trackingID := fmt.Sprintf("ST-%s", generateID(8))

	website := &models.Website{
		SiteID:             siteID,
		UserID:             userID,
		Name:               req.Name,
		URL:                normalizedURL,
		TrackingID:         trackingID,
		IsActive:           true,
		IsVerified:         false,
		AutomationEnabled:  true,
		FunnelEnabled:      true,
		HeatmapEnabled:     true,
		ReplayEnabled:      true,
		ReplaySamplingRate: 1.0,
		CreatedAt:          time.Now(),
		UpdatedAt:          time.Now(),
	}

	if err := s.repo.Create(ctx, website); err != nil {
		s.logger.Error().Err(err).Msg("Failed to create website")
		return nil, err
	}

	// Add owner as a member
	member := &models.WebsiteMember{
		WebsiteID: website.ID,
		UserID:    userID,
		Role:      "owner",
	}
	if err := s.repo.AddMember(ctx, member); err != nil {
		s.logger.Error().Err(err).Msg("Failed to add owner as member")
		// Continue anyway, as the website is created
	}

	return website, nil
}

// ListUserWebsites returns all websites owned by the user
func (s *WebsiteService) ListUserWebsites(ctx context.Context, userID uuid.UUID) ([]models.Website, error) {
	return s.repo.ListByUserID(ctx, userID)
}

// GetWebsiteBySiteID returns details for a specific site, using cache
func (s *WebsiteService) GetWebsiteBySiteID(ctx context.Context, siteID string) (*models.Website, error) {
	cacheKey := fmt.Sprintf("website:site_id:%s", siteID)

	if s.cache != nil {
		var w models.Website
		if s.cache.Get(cacheKey, &w) {
			return &w, nil
		}
	}

	w, err := s.repo.GetBySiteID(ctx, siteID)
	if err != nil {
		return nil, err
	}

	if s.cache != nil {
		s.cache.Set(fmt.Sprintf("website:site_id:%s", w.SiteID), w, 1*time.Hour)
		s.cache.Set(fmt.Sprintf("website:site_id:%s", w.ID.String()), w, 1*time.Hour)
	}

	return w, nil
}

// GetWebsiteByAnyID returns details for a specific site, trying SiteID first then UUID
func (s *WebsiteService) GetWebsiteByAnyID(ctx context.Context, id string) (*models.Website, error) {
	// 1. Try SiteID (24-char)
	w, err := s.GetWebsiteBySiteID(ctx, id)
	if err == nil {
		return w, nil
	}

	// 2. Try UUID
	if uid, errParse := uuid.Parse(id); errParse == nil {
		wUUID, errUUID := s.repo.GetByUUIDOnly(ctx, uid)
		if errUUID == nil {
			return wUUID, nil
		}
	}

	return nil, fmt.Errorf("website not found with id: %s", id)
}

// ValidateOriginDomain checks if the origin matches the registered domain
func (s *WebsiteService) ValidateOriginDomain(origin string, registeredDomain string) bool {
	if origin == "" {
		return true // Allow if origin is missing (though trackers should provide it)
	}

	var originDomain string
	if strings.Contains(origin, "://") {
		parsedURL, err := url.Parse(origin)
		if err != nil {
			return false
		}
		originDomain = parsedURL.Hostname()
	} else {
		originDomain = origin
	}

	originDomain = strings.TrimPrefix(originDomain, "www.")

	s.logger.Debug().
		Str("env", s.env).
		Str("host", originDomain).
		Msg("Validating origin domain")

	if s.env != "production" && (originDomain == "localhost" || originDomain == "127.0.0.1") {
		return true
	}

	// registeredDomain should already be normalized, but we'll be safe
	siteDomain := strings.TrimPrefix(registeredDomain, "http://")
	siteDomain = strings.TrimPrefix(siteDomain, "https://")
	siteDomain = strings.Split(siteDomain, "/")[0]
	siteDomain = strings.TrimPrefix(siteDomain, "www.")

	return originDomain == siteDomain
}

func (s *WebsiteService) invalidateCache(ctx context.Context, w *models.Website) {
	if s.cache == nil || w == nil {
		return
	}
	s.cache.Delete(fmt.Sprintf("website:site_id:%s", w.SiteID))
	s.cache.Delete(fmt.Sprintf("website:site_id:%s", w.ID.String()))
}

// UpdateWebsite updates website settings
func (s *WebsiteService) UpdateWebsite(ctx context.Context, id string, userID uuid.UUID, req models.UpdateWebsiteRequest) (*models.Website, error) {
	// 1. Get original
	var original *models.Website
	var err error

	// Check if id is UUID or site_id
	if uid, errParse := uuid.Parse(id); errParse == nil {
		original, err = s.repo.GetByID(ctx, uid, userID)
	} else {
		original, err = s.repo.GetBySiteID(ctx, id)
		if err == nil && original.UserID != userID {
			return nil, repository.ErrWebsiteNotFound
		}
	}

	if err != nil {
		return nil, err
	}

	// 2. Apply changes
	if req.Name != nil {
		original.Name = *req.Name
	}
	if req.URL != nil {
		original.URL = *req.URL
	}
	if req.IsActive != nil {
		original.IsActive = *req.IsActive
	}
	if req.AutomationEnabled != nil {
		original.AutomationEnabled = *req.AutomationEnabled
	}
	if req.FunnelEnabled != nil {
		original.FunnelEnabled = *req.FunnelEnabled
	}
	if req.HeatmapEnabled != nil {
		original.HeatmapEnabled = *req.HeatmapEnabled
	}
	if req.HeatmapIncludePatterns != nil {
		original.HeatmapIncludePatterns = req.HeatmapIncludePatterns
	}
	if req.HeatmapExcludePatterns != nil {
		original.HeatmapExcludePatterns = req.HeatmapExcludePatterns
	}
	if req.ReplayEnabled != nil {
		original.ReplayEnabled = *req.ReplayEnabled
	}
	if req.ReplaySamplingRate != nil {
		original.ReplaySamplingRate = *req.ReplaySamplingRate
	}
	if req.ReplayIncludePatterns != nil {
		original.ReplayIncludePatterns = req.ReplayIncludePatterns
	}
	if req.ReplayExcludePatterns != nil {
		original.ReplayExcludePatterns = req.ReplayExcludePatterns
	}

	// 3. Save to database
	if err := s.repo.Update(ctx, original); err != nil {
		return nil, err
	}

	s.invalidateCache(ctx, original)

	return original, nil
}

// DeleteWebsite removes a website tracking profile and all its associated data
func (s *WebsiteService) DeleteWebsite(ctx context.Context, id string, userID uuid.UUID) error {
	// 1. Get website info first for cleanup (need UUID and SiteID)
	// We use GetWebsiteByAnyID to reconcile public SiteID or internal ID
	w, err := s.GetWebsiteByAnyID(ctx, id)
	if err != nil {
		// If website doesn't exist, just return nil (it's already gone)
		return nil
	}

	// 2. Validate ownership (even though repo.Delete does it, we need details for cleanup)
	if w.UserID != userID {
		return fmt.Errorf("unauthorized")
	}

	// 3. Cascade cleanup for all related data across ClickHouse, Postgres, and S3
	s.cleanupAllRelatedData(ctx, w)

	// 4. Delete the main website record from PostgreSQL
	if err := s.repo.Delete(ctx, id, userID); err != nil {
		return err
	}

	// 5. Invalidate caches
	s.invalidateCache(ctx, w)

	return nil
}

// cleanupAllRelatedData wipes all associated data for a website across all storage modules.
func (s *WebsiteService) cleanupAllRelatedData(ctx context.Context, w *models.Website) {
	siteID := w.SiteID
	uuidStr := w.ID.String()

	s.logger.Info().Str("site_id", siteID).Str("id", uuidStr).Msg("Performing full data cleanup for website")

	// 1. ClickHouse Analytics Data (Aggregated stats tables)
	if s.analyticsRepo != nil {
		if err := s.analyticsRepo.DeleteAllWebsiteData(ctx, siteID); err != nil {
			s.logger.Error().Err(err).Str("site_id", siteID).Msg("Failed cleanup: analytics stats")
		}
	}

	// 2. ClickHouse Raw Events
	if s.eventRepo != nil {
		if err := s.eventRepo.DeleteByWebsiteID(ctx, siteID); err != nil {
			s.logger.Error().Err(err).Str("site_id", siteID).Msg("Failed cleanup: raw events")
		}
	}

	// 3. Heatmaps (Postgres heatmap_points and heatmap_sessions)
	if s.heatmapRepo != nil {
		if err := s.heatmapRepo.DeleteAllByWebsiteID(ctx, uuidStr); err != nil {
			s.logger.Error().Err(err).Str("id", uuidStr).Msg("Failed cleanup: heatmap points")
		}
	}

	// 4. Funnels (Postgres funnels, steps, and step analytics)
	if s.funnelRepo != nil {
		if err := s.funnelRepo.DeleteAllByWebsiteID(ctx, siteID); err != nil {
			s.logger.Error().Err(err).Str("site_id", siteID).Msg("Failed cleanup: funnels")
		}
	}

	// 5. Automations (Postgres automations, actions, conditions, and executions)
	if s.autoRepo != nil {
		if err := s.autoRepo.DeleteAllByWebsiteID(ctx, siteID); err != nil {
			s.logger.Error().Err(err).Str("site_id", siteID).Msg("Failed cleanup: automations")
		}
	}

	// 6. Session Replays (Postgres DB metadata + S3 file deletion)
	if s.replayRepo != nil {
		s3Keys, err := s.replayRepo.DeleteAllByWebsiteID(ctx, siteID)
		if err != nil {
			s.logger.Error().Err(err).Str("site_id", siteID).Msg("Failed cleanup: replay metadata")
		} else if s.s3Store != nil && len(s3Keys) > 0 {
			// Trigger asynchronous S3 cleanup to avoid blocking the main delete request
			go func(keys []string, site string) {
				bgCtx := context.Background()
				count := 0
				for _, key := range keys {
					if err := s.s3Store.Delete(bgCtx, key); err == nil {
						count++
					}
				}
				s.logger.Info().Int("deleted_count", count).Str("site_id", site).Msg("S3 storage cleanup completed")
			}(s3Keys, siteID)
		}
	}
}

// ListGoals returns all goals for a website
func (s *WebsiteService) ListGoals(ctx context.Context, siteID string) ([]models.Goal, error) {
	w, err := s.GetWebsiteBySiteID(ctx, siteID)
	if err != nil {
		return nil, err
	}
	return s.repo.ListGoals(ctx, w.ID)
}

// CreateGoal creates a new goal for a website
func (s *WebsiteService) CreateGoal(ctx context.Context, siteID string, req models.CreateGoalRequest) (*models.Goal, error) {
	w, err := s.GetWebsiteBySiteID(ctx, siteID)
	if err != nil {
		return nil, err
	}

	goal := &models.Goal{
		WebsiteID:  w.ID,
		Name:       req.Name,
		Type:       req.Type,
		Identifier: req.Identifier,
		Selector:   req.Selector,
	}

	if err := s.repo.CreateGoal(ctx, goal); err != nil {
		return nil, err
	}
	return goal, nil
}

// DeleteGoal removes a goal
func (s *WebsiteService) DeleteGoal(ctx context.Context, siteID string, goalID uuid.UUID) error {
	w, err := s.GetWebsiteBySiteID(ctx, siteID)
	if err != nil {
		return err
	}
	return s.repo.DeleteGoal(ctx, goalID, w.ID)
}

// ListMembers returns all members of a website
func (s *WebsiteService) ListMembers(ctx context.Context, siteID string) ([]models.WebsiteMember, error) {
	w, err := s.GetWebsiteBySiteID(ctx, siteID)
	if err != nil {
		return nil, err
	}
	return s.repo.ListMembers(ctx, w.ID)
}

// AddMember adds a user to a website team
func (s *WebsiteService) AddMember(ctx context.Context, siteID string, req models.InviteMemberRequest) (*models.WebsiteMember, error) {
	w, err := s.GetWebsiteBySiteID(ctx, siteID)
	if err != nil {
		return nil, err
	}

	// 1. Find user by email
	user, err := s.authRepo.GetByEmail(ctx, req.Email)
	if err != nil {
		return nil, fmt.Errorf("user with email %s not found", req.Email)
	}

	// 2. Check if already a member
	existing, _ := s.repo.GetMember(ctx, w.ID, user.ID)
	if existing != nil {
		return nil, fmt.Errorf("user is already a member of this website")
	}

	// 3. Add member
	member := &models.WebsiteMember{
		WebsiteID: w.ID,
		UserID:    user.ID,
		Role:      req.Role,
	}

	if err := s.repo.AddMember(ctx, member); err != nil {
		return nil, err
	}

	member.UserName = user.Name
	member.UserEmail = user.Email

	return member, nil
}

// RemoveMember removes a user from a website team
func (s *WebsiteService) RemoveMember(ctx context.Context, siteID string, userID uuid.UUID) error {
	w, err := s.GetWebsiteBySiteID(ctx, siteID)
	if err != nil {
		return err
	}

	// Cannot remove the owner (the user_id in websites table)
	if w.UserID == userID {
		return fmt.Errorf("cannot remove the website owner from the team")
	}

	return s.repo.RemoveMember(ctx, w.ID, userID)
}

// UpdateMemberRole changes a team member's role
func (s *WebsiteService) UpdateMemberRole(ctx context.Context, siteID string, userID uuid.UUID, role string) error {
	w, err := s.GetWebsiteBySiteID(ctx, siteID)
	if err != nil {
		return err
	}

	// Cannot change the owner's role
	if w.UserID == userID {
		return fmt.Errorf("cannot change the website owner's role")
	}

	if role != "admin" && role != "viewer" {
		return fmt.Errorf("invalid role: must be 'admin' or 'viewer'")
	}

	return s.repo.UpdateMemberRole(ctx, w.ID, userID, role)
}

// Helper to generate secure random identifiers
func generateID(length int) string {
	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		return ""
	}
	return hex.EncodeToString(b)
}
