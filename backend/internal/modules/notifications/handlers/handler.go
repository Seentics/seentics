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
userId := c.GetString("userId")
if userId == "" {
c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
return
}

notifications, err := h.service.GetUserNotifications(c.Request.Context(), userId)
if err != nil {
h.logger.Error().Err(err).Msg("Failed to list notifications")
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list notifications"})
return
}
c.JSON(http.StatusOK, notifications)
}

func (h *NotificationHandler) MarkRead(c *gin.Context) {
userId := c.GetString("userId")
id := c.Param("id")

if err := h.service.MarkRead(c.Request.Context(), id, userId); err != nil {
h.logger.Error().Err(err).Msg("Failed to mark notification as read")
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update notification"})
return
}
c.JSON(http.StatusOK, gin.H{"status": "success"})
}

func (h *NotificationHandler) MarkAllRead(c *gin.Context) {
userId := c.GetString("userId")
if err := h.service.MarkAllRead(c.Request.Context(), userId); err != nil {
h.logger.Error().Err(err).Msg("Failed to mark all as read")
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark all as read"})
return
}
c.JSON(http.StatusOK, gin.H{"status": "success"})
}
