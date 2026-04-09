package services

import (
	"github.com/Seentics/seentics/internal/modules/analytics/repository/privacy"
	websiteServicePkg "github.com/Seentics/seentics/internal/modules/websites/services"
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

type PrivacyService struct {
	privacyRepo *privacy.PrivacyRepository
	websites    *websiteServicePkg.WebsiteService
	logger      zerolog.Logger
}

func NewPrivacyService(privacyRepo *privacy.PrivacyRepository, websites *websiteServicePkg.WebsiteService, logger zerolog.Logger) *PrivacyService {
	return &PrivacyService{
		privacyRepo: privacyRepo,
		websites:    websites,
		logger:      logger,
	}
}

// validateOwnership ensures the website belongs to the user
func (s *PrivacyService) validateOwnership(ctx context.Context, websiteID string, userID string) (string, error) {
	if userID == "" {
		return "", fmt.Errorf("user_id is required")
	}

	uid, err := uuid.Parse(userID)
	if err != nil {
		return "", fmt.Errorf("invalid user_id format")
	}

	w, err := s.websites.GetWebsiteByID(ctx, websiteID)
	if err != nil {
		return "", fmt.Errorf("website not found")
	}

	if w.UserID != uid {
		return "", fmt.Errorf("unauthorized access to website data")
	}

	return w.SiteID, nil
}

// ExportUserAnalytics exports all analytics data for a specific user
func (s *PrivacyService) ExportUserAnalytics(userID string, authUserID string) (map[string]interface{}, error) {
	if userID != authUserID {
		return nil, fmt.Errorf("unauthorized: cannot export data for another user")
	}
	s.logger.Info().Str("user_id", userID).Msg("Starting analytics data export")

	data := make(map[string]interface{})

	// Export events data
	events, err := s.privacyRepo.ExportEventsData(userID)
	if err != nil {
		s.logger.Error().Err(err).Str("user_id", userID).Msg("Failed to export events data")
		return nil, err
	}
	data["events"] = events

	// Export analytics data
	analytics, err := s.privacyRepo.ExportAnalyticsData(userID)
	if err != nil {
		s.logger.Error().Err(err).Str("user_id", userID).Msg("Failed to export analytics data")
		return nil, err
	}
	data["analytics"] = analytics

	// Export funnel data
	funnels, err := s.privacyRepo.ExportFunnelData(userID)
	if err != nil {
		s.logger.Error().Err(err).Str("user_id", userID).Msg("Failed to export funnel data")
		return nil, err
	}
	data["funnels"] = funnels

	// Export sessions data
	sessions, err := s.privacyRepo.ExportSessionsData(userID)
	if err != nil {
		s.logger.Warn().Err(err).Str("user_id", userID).Msg("Failed to export sessions data")
	} else {
		data["sessions"] = sessions
	}

	// Export heatmap data
	heatmaps, err := s.privacyRepo.ExportHeatmapData(userID)
	if err != nil {
		s.logger.Warn().Err(err).Str("user_id", userID).Msg("Failed to export heatmap data")
	} else {
		data["heatmaps"] = heatmaps
	}

	// Export replay data
	replays, err := s.privacyRepo.ExportReplayData(userID)
	if err != nil {
		s.logger.Warn().Err(err).Str("user_id", userID).Msg("Failed to export replay data")
	} else {
		data["replays"] = replays
	}

	// Export goal data
	goals, err := s.privacyRepo.ExportGoalData(userID)
	if err != nil {
		s.logger.Warn().Err(err).Str("user_id", userID).Msg("Failed to export goal data")
	} else {
		data["goals"] = goals
	}

	exportData := map[string]interface{}{
		"user_id":     userID,
		"exported_at": time.Now().UTC().Format(time.RFC3339),
		"data":        data,
	}

	s.logger.Info().Str("user_id", userID).Msg("Analytics data export completed")
	return exportData, nil
}

// ExportWebsiteAnalytics exports all analytics data for a specific website
func (s *PrivacyService) ExportWebsiteAnalytics(websiteID string, authUserID string) (map[string]interface{}, error) {
	canonicalID, err := s.validateOwnership(context.Background(), websiteID, authUserID)
	if err != nil {
		return nil, err
	}

	s.logger.Info().Str("website_id", canonicalID).Msg("Starting website data export")

	exportData, err := s.privacyRepo.ExportWebsiteData(canonicalID)
	if err != nil {
		s.logger.Error().Err(err).Str("website_id", canonicalID).Msg("Failed to export website data")
		return nil, err
	}

	s.logger.Info().Str("website_id", canonicalID).Msg("Website data export completed")
	return exportData, nil
}

// DeleteUserData deletes all analytics data for a specific user
func (s *PrivacyService) DeleteUserData(userID string, authUserID string) error {
	if userID != authUserID {
		return fmt.Errorf("unauthorized: cannot delete data for another user")
	}
	s.logger.Info().Str("user_id", userID).Msg("Starting user analytics data deletion")

	err := s.privacyRepo.DeleteUserData(userID)
	if err != nil {
		s.logger.Error().Err(err).Str("user_id", userID).Msg("Failed to delete user analytics data")
		return err
	}

	s.logger.Info().Str("user_id", userID).Msg("User analytics data deletion completed")
	return nil
}

// DeleteWebsiteData deletes all analytics data for a specific website
func (s *PrivacyService) DeleteWebsiteData(websiteID string, authUserID string) error {
	canonicalID, err := s.validateOwnership(context.Background(), websiteID, authUserID)
	if err != nil {
		return err
	}

	s.logger.Info().Str("website_id", canonicalID).Msg("Starting website analytics data deletion")

	err = s.privacyRepo.DeleteWebsiteData(canonicalID)
	if err != nil {
		s.logger.Error().Err(err).Str("website_id", canonicalID).Msg("Failed to delete website analytics data")
		return err
	}

	s.logger.Info().Str("website_id", canonicalID).Msg("Website analytics data deletion completed")
	return nil
}

// DeleteUserAnalytics deletes all analytics data for a specific user
func (s *PrivacyService) DeleteUserAnalytics(userID string) error {
	s.logger.Info().Str("user_id", userID).Msg("Starting analytics data deletion")

	// Delete events data
	if err := s.privacyRepo.DeleteEventsData(userID); err != nil {
		s.logger.Error().Err(err).Str("user_id", userID).Msg("Failed to delete events data")
		return err
	}

	// Delete analytics data
	if err := s.privacyRepo.DeleteAnalyticsData(userID); err != nil {
		s.logger.Error().Err(err).Str("user_id", userID).Msg("Failed to delete analytics data")
		return err
	}

	// Delete funnel data
	if err := s.privacyRepo.DeleteFunnelData(userID); err != nil {
		s.logger.Error().Err(err).Str("user_id", userID).Msg("Failed to delete funnel data")
		return err
	}

	s.logger.Info().Str("user_id", userID).Msg("Analytics data deletion completed")
	return nil
}

// ImportWebsiteAnalytics imports analytics data from a JSON export into a website
func (s *PrivacyService) ImportWebsiteAnalytics(websiteID string, authUserID string, data []byte) (map[string]int, error) {
	canonicalID, err := s.validateOwnership(context.Background(), websiteID, authUserID)
	if err != nil {
		return nil, err
	}

	s.logger.Info().Str("website_id", canonicalID).Msg("Starting website data import")

	counts, err := s.privacyRepo.ImportWebsiteData(canonicalID, data)
	if err != nil {
		s.logger.Error().Err(err).Str("website_id", canonicalID).Msg("Failed to import website data")
		return nil, err
	}

	s.logger.Info().Str("website_id", canonicalID).Interface("counts", counts).Msg("Website data import completed")
	return counts, nil
}

// AnonymizeUserAnalytics anonymizes analytics data for a specific user
func (s *PrivacyService) AnonymizeUserAnalytics(userID string) error {
	s.logger.Info().Str("user_id", userID).Msg("Starting analytics data anonymization")

	// Anonymize events data
	if err := s.privacyRepo.AnonymizeEventsData(userID); err != nil {
		s.logger.Error().Err(err).Str("user_id", userID).Msg("Failed to anonymize events data")
		return err
	}

	// Anonymize analytics data
	if err := s.privacyRepo.AnonymizeAnalyticsData(userID); err != nil {
		s.logger.Error().Err(err).Str("user_id", userID).Msg("Failed to anonymize analytics data")
		return err
	}

	s.logger.Info().Str("user_id", userID).Msg("Analytics data anonymization completed")
	return nil
}

// GetDataRetentionPolicies returns current data retention policies
func (s *PrivacyService) GetDataRetentionPolicies() []map[string]interface{} {
	return []map[string]interface{}{
		{
			"data_type":        "Analytics Events",
			"retention_period": 2,
			"retention_unit":   "years",
			"auto_delete":      true,
			"description":      "Raw analytics events (page views, clicks, etc.)",
		},
		{
			"data_type":        "Session Data",
			"retention_period": 1,
			"retention_unit":   "year",
			"auto_delete":      true,
			"description":      "User session information and behavior patterns",
		},
		{
			"data_type":        "IP Addresses",
			"retention_period": 90,
			"retention_unit":   "days",
			"auto_delete":      true,
			"description":      "Visitor IP addresses for security and analytics",
		},
	}
}

// RunDataRetentionCleanup runs data retention cleanup for old data
func (s *PrivacyService) RunDataRetentionCleanup() error {
	s.logger.Info().Msg("Starting data retention cleanup")

	// Clean up old events (older than 2 years)
	if err := s.privacyRepo.CleanupOldEvents(); err != nil {
		s.logger.Error().Err(err).Msg("Failed to cleanup old events")
		return err
	}

	// Clean up old analytics data (older than 1 year)
	if err := s.privacyRepo.CleanupOldAnalytics(); err != nil {
		s.logger.Error().Err(err).Msg("Failed to cleanup old analytics data")
		return err
	}

	// Anonymize IP addresses older than 90 days
	if err := s.privacyRepo.AnonymizeOldIPs(); err != nil {
		s.logger.Error().Err(err).Msg("Failed to anonymize old IP addresses")
		return err
	}

	s.logger.Info().Msg("Data retention cleanup completed")
	return nil
}
