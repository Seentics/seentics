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

	analyticsModels "github.com/Seentics/seentics/internal/modules/analytics/models"
	analyticsRepoPkg "github.com/Seentics/seentics/internal/modules/analytics/repository"
	funnelRepoPkg "github.com/Seentics/seentics/internal/modules/funnels/repository"
	"github.com/Seentics/seentics/internal/shared/cache"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

type WebsiteService struct {
	repo          *repository.WebsiteRepository
	authRepo      *authRepoPkg.AuthRepository
	analyticsRepo analyticsRepoPkg.MainAnalyticsRepository
	eventRepo     analyticsRepoPkg.EventRepository
	funnelRepo    *funnelRepoPkg.FunnelRepository
	cache         *cache.Cache
	env           string
	logger        zerolog.Logger
}

func NewWebsiteService(
	repo *repository.WebsiteRepository,
	authRepo *authRepoPkg.AuthRepository,
	analyticsRepo analyticsRepoPkg.MainAnalyticsRepository,
	eventRepo analyticsRepoPkg.EventRepository,
	funnelRepo *funnelRepoPkg.FunnelRepository,
	cache *cache.Cache,
	env string,
	logger zerolog.Logger,
) *WebsiteService {
	return &WebsiteService{
		repo:          repo,
		authRepo:      authRepo,
		analyticsRepo: analyticsRepo,
		eventRepo:     eventRepo,
		funnelRepo:    funnelRepo,
		cache:         cache,
		env:           env,
		logger:        logger,
	}
}

// trackerConfigCache holds the cacheable portion of tracker config (goals).
type trackerConfigCache struct {
	Goals []map[string]interface{} `json:"goals"`
}

// GetTrackerConfig returns the configuration for the tracker script.
// Goals are cached in Redis for 15 minutes to avoid DB queries on every tracker init request.
func (s *WebsiteService) GetTrackerConfig(ctx context.Context, siteID string, origin string) (map[string]interface{}, error) {
	w, err := s.GetWebsiteBySiteID(ctx, siteID)
	if err != nil {
		return nil, err
	}

	// Domain Validation
	if !s.ValidateOriginDomain(origin, w.URL) {
		return nil, fmt.Errorf("domain mismatch")
	}

	// Try cache for goals
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

		if s.cache != nil {
			s.cache.Set(cacheKey, cached, 15*time.Minute)
		}
	}

	return map[string]interface{}{
		"site_id":                  w.SiteID,
		"funnel_enabled":           w.FunnelEnabled,
		"goals":                    cached.Goals,
		"replay_enabled":           w.ReplayEnabled,
		"replay_sampling_rate":     w.ReplaySamplingRate,
		"replay_include_patterns":  w.ReplayIncludePatterns,
		"replay_exclude_patterns":  w.ReplayExcludePatterns,
		"heatmap_enabled":          w.HeatmapEnabled,
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

// ListAllActiveSiteIDs returns site_id for every active website.
func (s *WebsiteService) ListAllActiveSiteIDs(ctx context.Context) ([]string, error) {
	return s.repo.ListAllActiveSiteIDs(ctx)
}

// ListAllActiveWebsiteUUIDs returns the UUID (id column) of every active website.
func (s *WebsiteService) ListAllActiveWebsiteUUIDs(ctx context.Context) ([]string, error) {
	websites, err := s.repo.ListAllActiveWebsites(ctx)
	if err != nil {
		return nil, err
	}
	uuids := make([]string, len(websites))
	for i, w := range websites {
		uuids[i] = w.UUID
	}
	return uuids, nil
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
	siteID := w.SiteID
	uuidStr := w.ID.String()

	// Website metadata caches
	s.cache.Delete(fmt.Sprintf("website:site_id:%s", siteID))
	s.cache.Delete(fmt.Sprintf("website:site_id:%s", uuidStr))
	s.cache.Delete(fmt.Sprintf("tracker:config:%s", siteID))

	// Analytics caches
	s.cache.DeleteByPattern(fmt.Sprintf("analytics:dashboard:%s:*", siteID))
	s.cache.DeleteByPattern(fmt.Sprintf("analytics:path_analysis:%s:*", siteID))
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
	if req.FunnelEnabled != nil {
		original.FunnelEnabled = *req.FunnelEnabled
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

	// 3. Cascade cleanup for all related data across ClickHouse and Postgres
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

	s.logger.Info().Str("site_id", siteID).Str("id", w.ID.String()).Msg("Performing full data cleanup for website")

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

	// 3. Funnels (Postgres funnels, steps, and step analytics)
	if s.funnelRepo != nil {
		if err := s.funnelRepo.DeleteAllByWebsiteID(ctx, siteID); err != nil {
			s.logger.Error().Err(err).Str("site_id", siteID).Msg("Failed cleanup: funnels")
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
		Revenue:    req.Revenue,
		Currency:   req.Currency,
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

// GetUserRole returns the role of a user for a website.
// The website owner (websites.user_id) always has "owner" role even without a website_members row.
func (s *WebsiteService) GetUserRole(ctx context.Context, siteID string, userID uuid.UUID) (string, error) {
	w, err := s.GetWebsiteBySiteID(ctx, siteID)
	if err != nil {
		return "", err
	}

	// Website creator is always owner
	if w.UserID == userID {
		return "owner", nil
	}

	role, err := s.repo.GetMemberRole(ctx, w.ID, userID)
	if err != nil {
		return "", err
	}
	return role, nil
}

// requireRole checks that requesterID has at least one of the allowed roles for this website.
// Returns the website and an error if permission is denied.
func (s *WebsiteService) requireRole(ctx context.Context, siteID string, requesterID uuid.UUID, allowedRoles ...string) (*models.Website, error) {
	w, err := s.GetWebsiteBySiteID(ctx, siteID)
	if err != nil {
		return nil, err
	}

	// Website creator is always owner
	userRole := ""
	if w.UserID == requesterID {
		userRole = "owner"
	} else {
		userRole, err = s.repo.GetMemberRole(ctx, w.ID, requesterID)
		if err != nil {
			return nil, fmt.Errorf("permission check failed")
		}
	}

	if userRole == "" {
		return nil, fmt.Errorf("access denied: not a member of this website")
	}

	for _, r := range allowedRoles {
		if userRole == r {
			return w, nil
		}
	}
	return nil, fmt.Errorf("access denied: requires %v role, you have '%s'", allowedRoles, userRole)
}

// ListMembers returns all members of a website (any member can view)
func (s *WebsiteService) ListMembers(ctx context.Context, siteID string, requesterID uuid.UUID) ([]models.WebsiteMember, error) {
	w, err := s.requireRole(ctx, siteID, requesterID, "owner", "admin", "viewer")
	if err != nil {
		return nil, err
	}
	return s.repo.ListMembers(ctx, w.ID)
}

// AddMember adds a user to a website team (owner/admin only)
func (s *WebsiteService) AddMember(ctx context.Context, siteID string, requesterID uuid.UUID, req models.InviteMemberRequest) (*models.WebsiteMember, error) {
	w, err := s.requireRole(ctx, siteID, requesterID, "owner", "admin")
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

// RemoveMember removes a user from a website team (owner/admin only)
func (s *WebsiteService) RemoveMember(ctx context.Context, siteID string, requesterID uuid.UUID, targetUserID uuid.UUID) error {
	w, err := s.requireRole(ctx, siteID, requesterID, "owner", "admin")
	if err != nil {
		return err
	}

	// Cannot remove the owner
	if w.UserID == targetUserID {
		return fmt.Errorf("cannot remove the website owner from the team")
	}

	// Admins cannot remove other admins — only owners can
	if w.UserID != requesterID {
		targetRole, _ := s.repo.GetMemberRole(ctx, w.ID, targetUserID)
		if targetRole == "admin" {
			return fmt.Errorf("only the website owner can remove admins")
		}
	}

	return s.repo.RemoveMember(ctx, w.ID, targetUserID)
}

// UpdateMemberRole changes a team member's role (owner only)
func (s *WebsiteService) UpdateMemberRole(ctx context.Context, siteID string, requesterID uuid.UUID, targetUserID uuid.UUID, role string) error {
	w, err := s.requireRole(ctx, siteID, requesterID, "owner")
	if err != nil {
		return err
	}

	// Cannot change the owner's role
	if w.UserID == targetUserID {
		return fmt.Errorf("cannot change the website owner's role")
	}

	if role != "admin" && role != "viewer" {
		return fmt.Errorf("invalid role: must be 'admin' or 'viewer'")
	}

	return s.repo.UpdateMemberRole(ctx, w.ID, targetUserID, role)
}

// --- Token-based Invitation Flow ---

// InviteMemberByToken creates a pending invitation with a unique token and returns it.
// The caller (or an email service) should send the accept URL to the invitee.
func (s *WebsiteService) InviteMemberByToken(ctx context.Context, siteID string, requesterID uuid.UUID, req models.InviteMemberRequest) (*models.WebsiteInvitation, error) {
	w, err := s.requireRole(ctx, siteID, requesterID, "owner", "admin")
	if err != nil {
		return nil, err
	}

	// Check if already a member by email
	user, _ := s.authRepo.GetByEmail(ctx, req.Email)
	if user != nil {
		existing, _ := s.repo.GetMember(ctx, w.ID, user.ID)
		if existing != nil {
			return nil, fmt.Errorf("user is already a member of this website")
		}
	}

	token := generateID(16) // 32-char hex token
	inv := &models.WebsiteInvitation{
		WebsiteID: w.ID,
		Email:     req.Email,
		Role:      req.Role,
		Token:     token,
		InvitedBy: requesterID,
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
		CreatedAt: time.Now(),
	}

	if err := s.repo.CreateInvitation(ctx, inv); err != nil {
		return nil, fmt.Errorf("failed to create invitation (may already be pending): %w", err)
	}

	inv.WebsiteName = w.Name
	return inv, nil
}

// AcceptInvitation validates a token and adds the user as a member.
func (s *WebsiteService) AcceptInvitation(ctx context.Context, token string, userID uuid.UUID, userEmail string) error {
	inv, err := s.repo.GetInvitationByToken(ctx, token)
	if err != nil || inv == nil {
		return fmt.Errorf("invalid invitation token")
	}

	if inv.AcceptedAt != nil {
		return fmt.Errorf("invitation already accepted")
	}

	if time.Now().After(inv.ExpiresAt) {
		return fmt.Errorf("invitation has expired")
	}

	// Verify the accepting user's email matches the invitation
	if strings.EqualFold(inv.Email, userEmail) == false {
		return fmt.Errorf("this invitation was sent to a different email address")
	}

	// Check if already a member
	existing, _ := s.repo.GetMember(ctx, inv.WebsiteID, userID)
	if existing != nil {
		// Already a member, just mark accepted
		return s.repo.AcceptInvitation(ctx, inv.ID)
	}

	member := &models.WebsiteMember{
		WebsiteID: inv.WebsiteID,
		UserID:    userID,
		Role:      inv.Role,
	}

	if err := s.repo.AddMember(ctx, member); err != nil {
		return fmt.Errorf("failed to add member: %w", err)
	}

	return s.repo.AcceptInvitation(ctx, inv.ID)
}

// ListPendingInvitations returns pending invitations for a website (owner/admin only).
func (s *WebsiteService) ListPendingInvitations(ctx context.Context, siteID string, requesterID uuid.UUID) ([]models.WebsiteInvitation, error) {
	w, err := s.requireRole(ctx, siteID, requesterID, "owner", "admin")
	if err != nil {
		return nil, err
	}
	return s.repo.ListPendingInvitations(ctx, w.ID)
}

// RevokeInvitation cancels a pending invitation (owner/admin only).
func (s *WebsiteService) RevokeInvitation(ctx context.Context, siteID string, requesterID uuid.UUID, invitationID uuid.UUID) error {
	_, err := s.requireRole(ctx, siteID, requesterID, "owner", "admin")
	if err != nil {
		return err
	}
	return s.repo.DeleteInvitation(ctx, invitationID)
}

// TogglePublicShare enables or disables public dashboard sharing for a website.
// Returns the share ID (non-empty when enabled, empty when disabled).
func (s *WebsiteService) TogglePublicShare(ctx context.Context, siteID string, userID uuid.UUID, enabled bool) (string, error) {
	w, err := s.GetWebsiteByAnyID(ctx, siteID)
	if err != nil {
		return "", err
	}
	if w.UserID != userID {
		return "", fmt.Errorf("unauthorized")
	}

	var shareID *string
	if enabled {
		id := generateID(16) // 32-char hex
		shareID = &id
	}

	if err := s.repo.UpdatePublicShareID(ctx, w.ID, shareID); err != nil {
		return "", err
	}

	if shareID != nil {
		return *shareID, nil
	}
	return "", nil
}

// GetPublicDashboard returns dashboard data for a publicly shared website.
func (s *WebsiteService) GetPublicDashboard(ctx context.Context, publicShareID string, days int) (map[string]interface{}, error) {
	w, err := s.repo.GetByPublicShareID(ctx, publicShareID)
	if err != nil {
		return nil, fmt.Errorf("dashboard not found")
	}

	// Use the analytics repo to get basic dashboard metrics (no auth required)
	metrics, err := s.analyticsRepo.GetDashboardMetrics(ctx, w.SiteID, days, "UTC", analyticsModels.AnalyticsFilters{})
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"website_name":     w.Name,
		"website_url":      w.URL,
		"total_visitors":   metrics.TotalVisitors,
		"unique_visitors":  metrics.UniqueVisitors,
		"sessions":         metrics.Sessions,
		"page_views":       metrics.PageViews,
		"bounce_rate":      metrics.BounceRate,
		"session_duration": metrics.AvgSessionTime,
	}, nil
}

// Helper to generate secure random identifiers
func generateID(length int) string {
	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		return ""
	}
	return hex.EncodeToString(b)
}
