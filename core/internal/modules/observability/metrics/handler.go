package metrics

import (
	"net/http"
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

// POST /api/v1/observability/metrics/ingest
func (h *Handler) Ingest(c *gin.Context) {
	var req IngestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(req.Metrics) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "metrics array is empty"})
		return
	}
	if len(req.Metrics) > 50000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "maximum 50,000 metrics per request"})
		return
	}
	if err := h.svc.Ingest(c.Request.Context(), req.Metrics); err != nil {
		h.logger.Error().Err(err).Msg("Failed to ingest metrics")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to ingest metrics"})
		return
	}
	c.JSON(http.StatusAccepted, gin.H{"status": "accepted", "count": len(req.Metrics)})
}

// GET /api/v1/observability/metrics
func (h *Handler) Query(c *gin.Context) {
	projectID := c.Query("project_id")
	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project_id is required"})
		return
	}

	p := QueryParams{
		ProjectID:   projectID,
		Service:     c.Query("service"),
		MetricName:  c.Query("name"),
		Granularity: c.Query("granularity"),
	}
	if p.Granularity == "" {
		p.Granularity = "minute"
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

	buckets, err := h.svc.Query(c.Request.Context(), p)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to query metrics")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query metrics"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"metrics": buckets, "count": len(buckets)})
}
