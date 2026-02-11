package handlers

import (
	"analytics-app/internal/modules/replays/models"
	"analytics-app/internal/modules/replays/services"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

type ReplayHandler struct {
	service services.ReplayService
	logger  zerolog.Logger
}

func NewReplayHandler(service services.ReplayService, logger zerolog.Logger) *ReplayHandler {
	return &ReplayHandler{
		service: service,
		logger:  logger,
	}
}

func (h *ReplayHandler) getUserID(c *gin.Context) string {
	userID, exists := c.Get("user_id")
	if !exists {
		return ""
	}
	return userID.(string)
}

// RecordReplay handles incoming session replay chunks
func (h *ReplayHandler) RecordReplay(c *gin.Context) {
	var req models.RecordReplayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.Error().Err(err).Msg("Failed to bind replay recording request")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.logger.Debug().
		Str("website_id", req.WebsiteID).
		Str("session_id", req.SessionID).
		Int("events", len(req.Events)).
		Int("sequence", req.Sequence).
		Msg("Recording session replay chunk")

	if err := h.service.RecordReplay(c.Request.Context(), req); err != nil {
		h.logger.Error().Err(err).Str("website_id", req.WebsiteID).Msg("Failed to record replay chunk")

		status := http.StatusInternalServerError
		if err.Error() == "domain mismatch" || err.Error() == "invalid website_id" || err.Error() == "website is inactive" {
			status = http.StatusForbidden
		}

		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

// GetReplay returns the full session recording for playback
func (h *ReplayHandler) GetReplay(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Query("website_id")
	sessionID := c.Param("session_id")

	if websiteID == "" || sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id and session_id are required"})
		return
	}

	h.logger.Debug().
		Str("website_id", websiteID).
		Str("session_id", sessionID).
		Msg("Fetching session replay")

	chunks, err := h.service.GetReplay(c.Request.Context(), websiteID, sessionID)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to fetch session replay")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch session replay"})
		return
	}

	// For the frontend, we might want to flatten the chunks into a single events array
	c.JSON(http.StatusOK, gin.H{"chunks": chunks})
}

// ListSessions returns a list of session IDs that have recordings
func (h *ReplayHandler) ListSessions(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Query("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	h.logger.Debug().Str("website_id", websiteID).Msg("Listing recorded sessions")

	sessions, err := h.service.ListSessions(c.Request.Context(), websiteID)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to list recorded sessions")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list sessions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"sessions": sessions})
}

// DeleteReplay deletes all chunks for a session
func (h *ReplayHandler) DeleteReplay(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Query("website_id")
	sessionID := c.Param("session_id")

	if websiteID == "" || sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id and session_id are required"})
		return
	}

	h.logger.Info().
		Str("website_id", websiteID).
		Str("session_id", sessionID).
		Msg("Deleting session replay")

	if err := h.service.DeleteReplay(c.Request.Context(), websiteID, sessionID); err != nil {
		h.logger.Error().Err(err).Msg("Failed to delete session replay")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete session replay"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

// GetPageSnapshot returns rrweb events for the initial state of a URL
func (h *ReplayHandler) GetPageSnapshot(c *gin.Context) {
	websiteID := c.Query("website_id")
	url := c.Query("url")

	if websiteID == "" || url == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id and url are required"})
		return
	}

	h.logger.Debug().
		Str("website_id", websiteID).
		Str("url", url).
		Msg("Fetching page snapshot for heatmap")

	events, err := h.service.GetPageSnapshot(c.Request.Context(), websiteID, url)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to fetch page snapshot")
		c.JSON(http.StatusNotFound, gin.H{"error": "No snapshot found for this URL"})
		return
	}

	c.Data(http.StatusOK, "application/json", events)
}
