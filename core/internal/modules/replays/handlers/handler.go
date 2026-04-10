package handlers

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/Seentics/seentics/internal/modules/replays/services"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

// ReplayHandler exposes session replay endpoints
type ReplayHandler struct {
	service *services.ReplayService
	logger  zerolog.Logger
}

// NewReplayHandler creates a new ReplayHandler
func NewReplayHandler(service *services.ReplayService, logger zerolog.Logger) *ReplayHandler {
	return &ReplayHandler{service: service, logger: logger}
}

// ListSessions godoc
// GET /replays/:website_id?limit=&offset=
func (h *ReplayHandler) ListSessions(c *gin.Context) {
	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	limit := 20
	offset := 0
	if l := c.Query("limit"); l != "" {
		fmt.Sscanf(l, "%d", &limit)
	}
	if o := c.Query("offset"); o != "" {
		fmt.Sscanf(o, "%d", &offset)
	}

	sessions, err := h.service.ListSessions(c.Request.Context(), websiteID, limit, offset)
	if err != nil {
		h.logger.Error().Err(err).Str("website_id", websiteID).Msg("replay: list sessions failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"sessions": sessions,
		"limit":    limit,
		"offset":   offset,
	})
}

// GetSession godoc
// GET /replays/:website_id/:session_id
func (h *ReplayHandler) GetSession(c *gin.Context) {
	websiteID := c.Param("website_id")
	sessionID := c.Param("session_id")

	if websiteID == "" || sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id and session_id are required"})
		return
	}

	meta, access, err := h.service.GetSession(c.Request.Context(), websiteID, sessionID)
	if err != nil {
		if errors.Is(err, services.ErrReplayNotReady) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		h.logger.Error().Err(err).Str("website_id", websiteID).Str("session_id", sessionID).Msg("replay: get session failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"session_id":             sessionID,
		"meta":                   meta,
		"warm_chunks":            access.WarmChunks,
		"replay_url":             access.ReplayURL,
		"replay_url_expires_at":  access.ReplayURLExpiresAt,
	})
}
// BatchDelete godoc
// DELETE /replays/:website_id/batch
// Request body: { "sessionIds": ["id1", "id2"] }
func (h *ReplayHandler) BatchDelete(c *gin.Context) {
	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	var req struct {
		SessionIDs []string `json:"sessionIds"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if err := h.service.DeleteSessions(c.Request.Context(), websiteID, req.SessionIDs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "sessions deleted"})
}
