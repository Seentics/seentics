package traces

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

// POST /api/v1/observability/traces/ingest
func (h *Handler) Ingest(c *gin.Context) {
	var req IngestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(req.Spans) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "spans array is empty"})
		return
	}
	if len(req.Spans) > 10000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "maximum 10,000 spans per request"})
		return
	}
	if err := h.svc.Ingest(c.Request.Context(), req.Spans); err != nil {
		h.logger.Error().Err(err).Msg("Failed to ingest spans")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to ingest spans"})
		return
	}
	c.JSON(http.StatusAccepted, gin.H{"status": "accepted", "count": len(req.Spans)})
}

// GET /api/v1/observability/traces
func (h *Handler) ListTraces(c *gin.Context) {
	projectID := c.Query("project_id")
	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project_id is required"})
		return
	}

	var from, to *time.Time
	if s := c.Query("from"); s != "" {
		if t, err := time.Parse(time.RFC3339, s); err == nil {
			from = &t
		}
	}
	if s := c.Query("to"); s != "" {
		if t, err := time.Parse(time.RFC3339, s); err == nil {
			to = &t
		}
	}

	limit, offset := 50, 0
	if s := c.Query("limit"); s != "" {
		if n, err := strconv.Atoi(s); err == nil {
			limit = n
		}
	}
	if s := c.Query("offset"); s != "" {
		if n, err := strconv.Atoi(s); err == nil {
			offset = n
		}
	}

	items, err := h.svc.ListTraces(c.Request.Context(), projectID, c.Query("service"), from, to, limit, offset)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to list traces")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list traces"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"traces": items, "count": len(items)})
}

// GET /api/v1/observability/traces/:trace_id
func (h *Handler) GetTrace(c *gin.Context) {
	traceID := c.Param("trace_id")
	projectID := c.Query("project_id")
	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project_id is required"})
		return
	}

	spans, err := h.svc.GetTrace(c.Request.Context(), projectID, traceID)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get trace")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get trace"})
		return
	}
	if len(spans) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "trace not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"trace_id": traceID, "spans": spans, "span_count": len(spans)})
}
