package handlers

import (
	"analytics-app/services"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

type PrivacyHandler struct {
	privacyService *services.PrivacyService
	logger         zerolog.Logger
}

func NewPrivacyHandler(
	privacyService *services.PrivacyService,
	logger zerolog.Logger,
) *PrivacyHandler {
	return &PrivacyHandler{
		privacyService: privacyService,
		logger:         logger,
	}
}

// ExportUserAnalytics exports all analytics data for a specific user
func (h *PrivacyHandler) ExportUserAnalytics(c *gin.Context) {
	userID := c.Param("user_id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "User ID is required",
		})
		return
	}

	exportData, err := h.privacyService.ExportUserAnalytics(userID)
	if err != nil {
		h.logger.Error().Err(err).Str("user_id", userID).Msg("Failed to export analytics data")
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to export analytics data",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Analytics data exported successfully",
		"data":    exportData,
	})
}

// DeleteUserAnalytics handles the deletion of all analytics data for a specific user
func (h *PrivacyHandler) DeleteUserAnalytics(c *gin.Context) {
	userID := c.Param("user_id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User ID is required"})
		return
	}

	h.logger.Info().Str("user_id", userID).Msg("Starting user analytics data deletion")

	err := h.privacyService.DeleteUserData(userID)
	if err != nil {
		h.logger.Error().Err(err).Str("user_id", userID).Msg("Failed to delete user analytics data")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete user data"})
		return
	}

	h.logger.Info().Str("user_id", userID).Msg("User analytics data deleted successfully")
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "User analytics data deleted successfully",
	})
}

// DeleteWebsiteAnalytics handles the deletion of all analytics data for a specific website
func (h *PrivacyHandler) DeleteWebsiteAnalytics(c *gin.Context) {
	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Website ID is required"})
		return
	}

	h.logger.Info().Str("website_id", websiteID).Msg("Starting website analytics data deletion")

	err := h.privacyService.DeleteWebsiteData(websiteID)
	if err != nil {
		h.logger.Error().Err(err).Str("website_id", websiteID).Msg("Failed to delete website analytics data")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete website data"})
		return
	}

	h.logger.Info().Str("website_id", websiteID).Msg("Website analytics data deleted successfully")
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Website analytics data deleted successfully",
	})
}

// AnonymizeUserAnalytics anonymizes analytics data for a specific user
func (h *PrivacyHandler) AnonymizeUserAnalytics(c *gin.Context) {
	userID := c.Param("user_id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "User ID is required",
		})
		return
	}

	err := h.privacyService.AnonymizeUserAnalytics(userID)
	if err != nil {
		h.logger.Error().Err(err).Str("user_id", userID).Msg("Failed to anonymize analytics data")
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to anonymize analytics data",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Analytics data anonymized successfully",
	})
}

// GetDataRetentionPolicies returns current data retention policies
func (h *PrivacyHandler) GetDataRetentionPolicies(c *gin.Context) {
	policies := h.privacyService.GetDataRetentionPolicies()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    policies,
	})
}

// RunDataRetentionCleanup runs data retention cleanup for old data
func (h *PrivacyHandler) RunDataRetentionCleanup(c *gin.Context) {
	err := h.privacyService.RunDataRetentionCleanup()
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to run data retention cleanup")
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to run data retention cleanup",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Data retention cleanup completed successfully",
	})
}
