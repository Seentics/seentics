package handlers

import (
	"analytics-app/internal/modules/notifications/services"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

type NotificationHandler struct {
	service *services.NotificationService
	logger  zerolog.Logger
}

func NewNotificationHandler(service *services.NotificationService, logger zerolog.Logger) *NotificationHandler {
	return &NotificationHandler{
		service: service,
		logger:  logger,
	}
}

func (h *NotificationHandler) List(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	notifications, err := h.service.GetUserNotifications(c.Request.Context(), userID.(string))
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to list notifications")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list notifications"})
		return
	}
	c.JSON(http.StatusOK, notifications)
}

func (h *NotificationHandler) MarkRead(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	id := c.Param("id")

	if err := h.service.MarkRead(c.Request.Context(), id, userID.(string)); err != nil {
		h.logger.Error().Err(err).Msg("Failed to mark notification as read")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update notification"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

func (h *NotificationHandler) MarkAllRead(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	if err := h.service.MarkAllRead(c.Request.Context(), userID.(string)); err != nil {
		h.logger.Error().Err(err).Msg("Failed to mark all as read")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark all as read"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "success"})
}
