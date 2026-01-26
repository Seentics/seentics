package services

import (
	"analytics-app/internal/modules/websites/models"
	"analytics-app/internal/modules/websites/repository"
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

type WebsiteService struct {
	repo   *repository.WebsiteRepository
	logger zerolog.Logger
}

func NewWebsiteService(repo *repository.WebsiteRepository, logger zerolog.Logger) *WebsiteService {
	return &WebsiteService{
		repo:   repo,
		logger: logger,
	}
}

// CreateWebsite handles the logic of creating a new website tracking profile
func (s *WebsiteService) CreateWebsite(ctx context.Context, userID uuid.UUID, req models.CreateWebsiteRequest) (*models.Website, error) {
	// Generate unique 24-char site_id (KSUID/NanoID style)
	siteID := generateID(12) // 24 hex chars

	// Generate tracking ID (looks like 'ST-XXXXXXXX')
	trackingID := fmt.Sprintf("ST-%s", generateID(8))

	website := &models.Website{
		SiteID:     siteID,
		UserID:     userID,
		Name:       req.Name,
		URL:        req.URL,
		TrackingID: trackingID,
		IsActive:   true,
		IsVerified: false,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	if err := s.repo.Create(ctx, website); err != nil {
		s.logger.Error().Err(err).Msg("Failed to create website")
		return nil, err
	}

	return website, nil
}

// ListUserWebsites returns all websites owned by the user
func (s *WebsiteService) ListUserWebsites(ctx context.Context, userID uuid.UUID) ([]models.Website, error) {
	return s.repo.ListByUserID(ctx, userID)
}

// GetWebsiteBySiteID returns details for a specific site
func (s *WebsiteService) GetWebsiteBySiteID(ctx context.Context, siteID string) (*models.Website, error) {
	return s.repo.GetBySiteID(ctx, siteID)
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

	// 3. Save
	if err := s.repo.Update(ctx, original); err != nil {
		return nil, err
	}

	return original, nil
}

// DeleteWebsite removes a website tracking profile
func (s *WebsiteService) DeleteWebsite(ctx context.Context, id string, userID uuid.UUID) error {
	return s.repo.Delete(ctx, id, userID)
}

// Helper to generate secure random identifiers
func generateID(length int) string {
	b := make([]byte, length)
	if _, err := rand.Read(b); err != nil {
		return ""
	}
	return hex.EncodeToString(b)
}
