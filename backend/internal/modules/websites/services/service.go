package services

import (
	authRepoPkg "analytics-app/internal/modules/auth/repository"
	billingModels "analytics-app/internal/modules/billing/models"
	billingServicePkg "analytics-app/internal/modules/billing/services"
	"analytics-app/internal/modules/websites/models"
	"analytics-app/internal/modules/websites/repository"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

type WebsiteService struct {
	repo     *repository.WebsiteRepository
	authRepo *authRepoPkg.AuthRepository
	billing  *billingServicePkg.BillingService
	redis    *redis.Client
	logger   zerolog.Logger
}

func NewWebsiteService(repo *repository.WebsiteRepository, authRepo *authRepoPkg.AuthRepository, billing *billingServicePkg.BillingService, redis *redis.Client, logger zerolog.Logger) *WebsiteService {
	return &WebsiteService{
		repo:     repo,
		authRepo: authRepo,
		billing:  billing,
		redis:    redis,
		logger:   logger,
	}
}

// GetTrackerConfig returns the configuration for the tracker script
func (s *WebsiteService) GetTrackerConfig(ctx context.Context, siteID string, origin string) (map[string]interface{}, error) {
	w, err := s.GetWebsiteBySiteID(ctx, siteID)
	if err != nil {
		return nil, err
	}

	// Domain Validation
	if !s.ValidateOriginDomain(origin, w.URL) {
		return nil, fmt.Errorf("domain mismatch")
	}

	goals, err := s.repo.ListGoals(ctx, w.ID)
	if err != nil {
		return nil, err
	}

	// Filter and format goals for the tracker
	trackerGoals := make([]map[string]interface{}, 0)
	for _, g := range goals {
		if g.Type == "event" && g.Selector != nil && *g.Selector != "" {
			trackerGoals = append(trackerGoals, map[string]interface{}{
				"id":       g.ID,
				"name":     g.Identifier, // Use the identifier as the event name
				"selector": *g.Selector,
			})
		}
	}

	return map[string]interface{}{
		"site_id":            w.SiteID,
		"automation_enabled": w.AutomationEnabled,
		"funnel_enabled":     w.FunnelEnabled,
		"heatmap_enabled":    w.HeatmapEnabled,
		"goals":              trackerGoals,
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

	// Normalize URL to just the domain
	normalizedURL := strings.TrimPrefix(parsedURL.Hostname(), "www.")

	// Generate unique 24-char site_id (KSUID/NanoID style)
	siteID := generateID(12) // 24 hex chars

	// Generate tracking ID (looks like 'ST-XXXXXXXX')
	trackingID := fmt.Sprintf("ST-%s", generateID(8))

	website := &models.Website{
		SiteID:            siteID,
		UserID:            userID,
		Name:              req.Name,
		URL:               normalizedURL,
		TrackingID:        trackingID,
		IsActive:          true,
		IsVerified:        false,
		AutomationEnabled: true,
		FunnelEnabled:     true,
		HeatmapEnabled:    true,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
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

	// Update billing usage
	if err := s.billing.IncrementUsageRedis(ctx, userID.String(), billingModels.ResourceWebsites, 1); err != nil {
		s.logger.Error().Err(err).Msg("Failed to update billing usage on website creation")
	}

	return website, nil
}

// ListUserWebsites returns all websites owned by the user
func (s *WebsiteService) ListUserWebsites(ctx context.Context, userID uuid.UUID) ([]models.Website, error) {
	return s.repo.ListByUserID(ctx, userID)
}

// GetWebsiteBySiteID returns details for a specific site, using Redis cache
func (s *WebsiteService) GetWebsiteBySiteID(ctx context.Context, siteID string) (*models.Website, error) {
	cacheKey := fmt.Sprintf("website:site_id:%s", siteID)

	if s.redis != nil {
		if val, err := s.redis.Get(ctx, cacheKey).Result(); err == nil {
			var w models.Website
			if err := json.Unmarshal([]byte(val), &w); err == nil {
				return &w, nil
			}
		}
	}

	w, err := s.repo.GetBySiteID(ctx, siteID)
	if err != nil {
		return nil, err
	}

	if s.redis != nil {
		data, _ := json.Marshal(w)
		// Cache under both shorthand SiteID and internal UUID for faster lookups
		s.redis.Set(ctx, fmt.Sprintf("website:site_id:%s", w.SiteID), data, 1*time.Hour)
		s.redis.Set(ctx, fmt.Sprintf("website:site_id:%s", w.ID.String()), data, 1*time.Hour)
	}

	return w, nil
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

	// registeredDomain should already be normalized, but we'll be safe
	siteDomain := strings.TrimPrefix(registeredDomain, "http://")
	siteDomain = strings.TrimPrefix(siteDomain, "https://")
	siteDomain = strings.Split(siteDomain, "/")[0]
	siteDomain = strings.TrimPrefix(siteDomain, "www.")

	return originDomain == siteDomain
}

func (s *WebsiteService) invalidateCache(ctx context.Context, siteID string) {
	if s.redis == nil {
		return
	}
	s.redis.Del(ctx, fmt.Sprintf("website:site_id:%s", siteID))
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

	// 3. Save
	if err := s.repo.Update(ctx, original); err != nil {
		return nil, err
	}

	s.invalidateCache(ctx, original.SiteID)

	return original, nil
}

// DeleteWebsite removes a website tracking profile
func (s *WebsiteService) DeleteWebsite(ctx context.Context, id string, userID uuid.UUID) error {
	if err := s.repo.Delete(ctx, id, userID); err != nil {
		return err
	}

	// Update billing usage (decrement)
	if err := s.billing.IncrementUsageRedis(ctx, userID.String(), billingModels.ResourceWebsites, -1); err != nil {
		s.logger.Error().Err(err).Msg("Failed to update billing usage on website deletion")
	}

	s.invalidateCache(ctx, id) // id might be site_id

	return nil
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

// Helper to generate secure random identifiers
func generateID(length int) string {
	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		return ""
	}
	return hex.EncodeToString(b)
}
