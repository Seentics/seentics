package services

import (
	"analytics-app/repository/privacy"
	"time"

	"github.com/rs/zerolog"
)

type PrivacyService struct {
	privacyRepo *privacy.PrivacyRepository
	logger      zerolog.Logger
}

func NewPrivacyService(privacyRepo *privacy.PrivacyRepository, logger zerolog.Logger) *PrivacyService {
	return &PrivacyService{
		privacyRepo: privacyRepo,
		logger:      logger,
	}
}

// ExportUserAnalytics exports all analytics data for a specific user
func (s *PrivacyService) ExportUserAnalytics(userID string) (map[string]interface{}, error) {
	s.logger.Info().Str("user_id", userID).Msg("Starting analytics data export")

	exportData := map[string]interface{}{
		"user_id":     userID,
		"exported_at": time.Now().UTC().Format(time.RFC3339),
		"data":        make(map[string]interface{}),
	}

	// Export events data
	events, err := s.privacyRepo.ExportEventsData(userID)
	if err != nil {
		s.logger.Error().Err(err).Str("user_id", userID).Msg("Failed to export events data")
		return nil, err
	}
	exportData["data"].(map[string]interface{})["events"] = events

	// Export analytics data
	analytics, err := s.privacyRepo.ExportAnalyticsData(userID)
	if err != nil {
		s.logger.Error().Err(err).Str("user_id", userID).Msg("Failed to export analytics data")
		return nil, err
	}
	exportData["data"].(map[string]interface{})["analytics"] = analytics

	// Export funnel data
	funnels, err := s.privacyRepo.ExportFunnelData(userID)
	if err != nil {
		s.logger.Error().Err(err).Str("user_id", userID).Msg("Failed to export funnel data")
		return nil, err
	}
	exportData["data"].(map[string]interface{})["funnels"] = funnels

	s.logger.Info().Str("user_id", userID).Msg("Analytics data export completed")
	return exportData, nil
}

// DeleteUserData deletes all analytics data for a specific user
func (s *PrivacyService) DeleteUserData(userID string) error {
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
func (s *PrivacyService) DeleteWebsiteData(websiteID string) error {
	s.logger.Info().Str("website_id", websiteID).Msg("Starting website analytics data deletion")

	err := s.privacyRepo.DeleteWebsiteData(websiteID)
	if err != nil {
		s.logger.Error().Err(err).Str("website_id", websiteID).Msg("Failed to delete website analytics data")
		return err
	}

	s.logger.Info().Str("website_id", websiteID).Msg("Website analytics data deletion completed")
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
