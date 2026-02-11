package handlers

import (
	"analytics-app/internal/modules/websites/models"
	"analytics-app/internal/modules/websites/services"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

type WebsiteHandler struct {
	service *services.WebsiteService
	logger  zerolog.Logger
}

func NewWebsiteHandler(service *services.WebsiteService, logger zerolog.Logger) *WebsiteHandler {
	return &WebsiteHandler{
		service: service,
		logger:  logger,
	}
}

// GetTrackerConfig handles the GET /api/v1/tracker/config/:site_id request (Public)
func (h *WebsiteHandler) GetTrackerConfig(c *gin.Context) {
	siteID := c.Param("site_id")
	if siteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Site ID is required"})
		return
	}

	// Capture origin for domain validation
	origin := c.Request.Header.Get("Origin")
	if origin == "" {
		origin = c.Request.Header.Get("Referer")
	}

	config, err := h.service.GetTrackerConfig(c.Request.Context(), siteID, origin)
	if err != nil {
		h.logger.Warn().Err(err).Str("site_id", siteID).Str("origin", origin).Msg("Tracker config fetch failed")
		c.JSON(http.StatusNotFound, gin.H{"error": "Website not found or domain mismatch"})
		return
	}

	c.JSON(http.StatusOK, config)
}

// Create handles the POST /api/v1/user/websites request
func (h *WebsiteHandler) Create(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID context"})
		return
	}

	var req models.CreateWebsiteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	website, err := h.service.CreateWebsite(c.Request.Context(), userID, req)
	if err != nil {
		h.logger.Error().Err(err).Str("user_id", userID.String()).Msg("Failed to create website")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create website"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Website created successfully",
		"data":    website,
	})
}

// List handles the GET /api/v1/user/websites request
func (h *WebsiteHandler) List(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID context"})
		return
	}

	websites, err := h.service.ListUserWebsites(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list websites"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": websites,
	})
}

// Get handles the GET /api/v1/user/websites/:id request
func (h *WebsiteHandler) Get(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID context"})
		return
	}

	id := c.Param("id")
	website, err := h.service.GetWebsiteBySiteID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Website not found"})
		return
	}

	if website.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": website,
	})
}

// Update handles the PUT /api/v1/user/websites/:id request
func (h *WebsiteHandler) Update(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID context"})
		return
	}

	id := c.Param("id")
	var req models.UpdateWebsiteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	website, err := h.service.UpdateWebsite(c.Request.Context(), id, userID, req)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to update website")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update website"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Website updated successfully",
		"data":    website,
	})
}

// ListGoals handles GET /api/v1/user/websites/:id/goals
func (h *WebsiteHandler) ListGoals(c *gin.Context) {
	id := c.Param("id")
	goals, err := h.service.ListGoals(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list goals"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": goals})
}

// CreateGoal handles POST /api/v1/user/websites/:id/goals
func (h *WebsiteHandler) CreateGoal(c *gin.Context) {
	id := c.Param("id")
	var req models.CreateGoalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	goal, err := h.service.CreateGoal(c.Request.Context(), id, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create goal"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Goal created successfully", "data": goal})
}

// DeleteGoal handles DELETE /api/v1/user/websites/:id/goals/:goal_id
func (h *WebsiteHandler) DeleteGoal(c *gin.Context) {
	id := c.Param("id")
	goalIDStr := c.Param("goal_id")
	goalID, err := uuid.Parse(goalIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid goal ID"})
		return
	}

	if err := h.service.DeleteGoal(c.Request.Context(), id, goalID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete goal"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Goal deleted successfully"})
}

// ListMembers handles GET /api/v1/user/websites/:id/members
func (h *WebsiteHandler) ListMembers(c *gin.Context) {
	id := c.Param("id")
	members, err := h.service.ListMembers(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list members"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": members})
}

// AddMember handles POST /api/v1/user/websites/:id/members
func (h *WebsiteHandler) AddMember(c *gin.Context) {
	id := c.Param("id")
	var req models.InviteMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	member, err := h.service.AddMember(c.Request.Context(), id, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Member added successfully", "data": member})
}

// RemoveMember handles DELETE /api/v1/user/websites/:id/members/:user_id
func (h *WebsiteHandler) RemoveMember(c *gin.Context) {
	id := c.Param("id")
	userIDStr := c.Param("user_id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	if err := h.service.RemoveMember(c.Request.Context(), id, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Member removed successfully"})
}

// Delete handles the DELETE /api/v1/user/websites/:id request
func (h *WebsiteHandler) Delete(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID context"})
		return
	}

	id := c.Param("id")
	if err := h.service.DeleteWebsite(c.Request.Context(), id, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete website"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Website deleted successfully",
	})
}
