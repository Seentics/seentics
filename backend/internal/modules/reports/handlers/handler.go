package handlers

import (
"analytics-app/internal/modules/reports/models"
"analytics-app/internal/modules/reports/services"
"net/http"

"github.com/gin-gonic/gin"
"github.com/rs/zerolog"
)

type ReportHandler struct {
service *services.ReportService
logger  zerolog.Logger
}

func NewReportHandler(service *services.ReportService, logger zerolog.Logger) *ReportHandler {
return &ReportHandler{
service: service,
logger:  logger,
}
}

func (h *ReportHandler) Create(c *gin.Context) {
websiteID := c.Param("website_id")
userID := c.GetString("userId")

var req models.CreateReportRequest
if err := c.ShouldBindJSON(&req); err != nil {
c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
return
}

report, err := h.service.CreateReport(c.Request.Context(), websiteID, userID, req)
if err != nil {
h.logger.Error().Err(err).Msg("Failed to create saved report")
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create report"})
return
}

c.JSON(http.StatusCreated, report)
}

func (h *ReportHandler) List(c *gin.Context) {
websiteID := c.Param("website_id")

reports, err := h.service.ListReports(c.Request.Context(), websiteID)
if err != nil {
h.logger.Error().Err(err).Msg("Failed to list saved reports")
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list reports"})
return
}

c.JSON(http.StatusOK, reports)
}

func (h *ReportHandler) Delete(c *gin.Context) {
websiteID := c.Param("website_id")
id := c.Param("id")

if err := h.service.DeleteReport(c.Request.Context(), id, websiteID); err != nil {
h.logger.Error().Err(err).Msg("Failed to delete saved report")
c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete report"})
return
}

c.JSON(http.StatusOK, gin.H{"status": "success"})
}
