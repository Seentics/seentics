package logs

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

type Handler struct {
	svc    *Service
	logger zerolog.Logger
}

func NewHandler(svc *Service, logger zerolog.Logger) *Handler {
	return &Handler{svc: svc, logger: logger}
}

// POST /api/v1/observability/logs/ingest
func (h *Handler) Ingest(c *gin.Context) {
	var req IngestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(req.Logs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "logs array is empty"})
		return
	}
	if len(req.Logs) > 10000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "maximum 10,000 logs per request"})
		return
	}
	if err := h.svc.Ingest(c.Request.Context(), req.Logs); err != nil {
		h.logger.Error().Err(err).Msg("Failed to ingest logs")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to ingest logs"})
		return
	}
	c.JSON(http.StatusAccepted, gin.H{"status": "accepted", "count": len(req.Logs)})
}

// GET /api/v1/observability/logs
func (h *Handler) Query(c *gin.Context) {
	projectID := c.Query("project_id")
	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project_id is required"})
		return
	}

	p := QueryParams{
		ProjectID: projectID,
		Service:   c.Query("service"),
		Level:     c.Query("level"),
		Search:    c.Query("search"),
	}
	if s := c.Query("from"); s != "" {
		if t, err := time.Parse(time.RFC3339, s); err == nil {
			p.From = t
		}
	}
	if s := c.Query("to"); s != "" {
		if t, err := time.Parse(time.RFC3339, s); err == nil {
			p.To = t
		}
	}
	if s := c.Query("limit"); s != "" {
		if n, err := strconv.Atoi(s); err == nil {
			p.Limit = n
		}
	}
	if s := c.Query("offset"); s != "" {
		if n, err := strconv.Atoi(s); err == nil {
			p.Offset = n
		}
	}

	entries, err := h.svc.Query(c.Request.Context(), p)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to query logs")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query logs"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"logs": entries, "count": len(entries)})
}
