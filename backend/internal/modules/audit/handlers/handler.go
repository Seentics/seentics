package handlers

import (
"analytics-app/internal/modules/audit/services"
"net/http"
"strconv"

"github.com/gin-gonic/gin"
"github.com/rs/zerolog"
)

type AuditHandler struct {
service services.AuditService
logger  zerolog.Logger
}

func NewAuditHandler(service services.AuditService, logger zerolog.Logger) *AuditHandler {
return &AuditHandler{
service: service,
logger:  logger,
}
}

func (h *AuditHandler) List(c *gin.Context) {
websiteID := c.Param("website_id")
page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

logs, err := h.service.GetWebsiteLogs(c.Request.Context(), websiteID, page, pageSize)
if err != nil {
h.logger.Error().Err(err).Msg("Failed to get audit logs")
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get audit logs"})
return
}

c.JSON(http.StatusOK, logs)
}
