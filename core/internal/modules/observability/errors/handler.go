package errors

import (
	"net/http"
	"strconv"

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

// POST /api/v1/observability/errors/ingest
func (h *Handler) Ingest(c *gin.Context) {
	var req IngestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if len(req.Errors) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "errors array is empty"})
		return
	}
	if len(req.Errors) > 1000 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "maximum 1,000 errors per request"})
		return
	}
	if err := h.svc.Ingest(c.Request.Context(), req.Errors); err != nil {
		h.logger.Error().Err(err).Msg("Failed to ingest errors")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to ingest errors"})
		return
	}
	c.JSON(http.StatusAccepted, gin.H{"status": "accepted", "count": len(req.Errors)})
}

// GET /api/v1/observability/errors/groups
func (h *Handler) ListGroups(c *gin.Context) {
	projectID := c.Query("project_id")
	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project_id is required"})
		return
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

	groups, err := h.svc.ListGroups(
		c.Request.Context(),
		projectID,
		c.Query("service"),
		c.Query("status"),
		limit, offset,
	)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to list error groups")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list error groups"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"groups": groups, "count": len(groups)})
}

// GET /api/v1/observability/errors/groups/:fingerprint/events
func (h *Handler) ListEvents(c *gin.Context) {
	fingerprint := c.Param("fingerprint")
	projectID := c.Query("project_id")
	if projectID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project_id is required"})
		return
	}

	limit := 50
	if s := c.Query("limit"); s != "" {
		if n, err := strconv.Atoi(s); err == nil {
			limit = n
		}
	}

	events, err := h.svc.ListEvents(c.Request.Context(), fingerprint, projectID, limit)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to list error events")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list error events"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"events": events, "count": len(events)})
}

// PATCH /api/v1/observability/errors/groups/:fingerprint/status
func (h *Handler) UpdateStatus(c *gin.Context) {
	fingerprint := c.Param("fingerprint")

	var body struct {
		ProjectID string `json:"project_id" binding:"required"`
		Status    string `json:"status"     binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.svc.UpdateGroupStatus(c.Request.Context(), fingerprint, body.ProjectID, body.Status); err != nil {
		h.logger.Error().Err(err).Msg("Failed to update error group status")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}
