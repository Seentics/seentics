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
