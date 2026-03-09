package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Seentics/seentics/internal/modules/replays/models"
	"github.com/Seentics/seentics/internal/modules/replays/services"
	"github.com/Seentics/seentics/internal/shared/utils"

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

	origin := c.Request.Header.Get("Origin")
	if origin == "" {
		origin = c.Request.Header.Get("Referer")
	}
	userAgent := c.Request.Header.Get("User-Agent")

	country := c.Request.Header.Get("CF-IPCountry")
	if country == "" {
		country = c.Request.Header.Get("X-Vercel-IP-Country")
	}
	if country == "" {
		country = c.Request.Header.Get("X-Country-Code")
	}

	clientIP := c.ClientIP()
	if country == "" || strings.Contains(country, ".") || strings.Contains(country, ":") {
		loc := utils.GetLocationFromIP(clientIP)
		if loc.Country != "Unknown" && loc.Country != "" {
			country = loc.Country
		} else if country == "" {
			country = "Unknown"
		}
	}

	h.logger.Debug().
		Str("website_id", req.WebsiteID).
		Str("session_id", req.SessionID).
		Str("country", country).
		Str("ip", clientIP).
		Str("origin", origin).
		Int("events", len(req.Events)).
		Int("sequence", req.Sequence).
		Msg("Recording session replay chunk")

	if err := h.service.RecordReplay(c.Request.Context(), req, origin, userAgent, country); err != nil {
		h.logger.Error().Err(err).Str("website_id", req.WebsiteID).Str("origin", origin).Msg("Failed to record replay chunk")

		status := http.StatusInternalServerError
		errMsg := err.Error()
		if strings.HasPrefix(errMsg, "domain mismatch") || strings.HasPrefix(errMsg, "invalid website_id") || strings.HasPrefix(errMsg, "website is inactive") {
			status = http.StatusForbidden
		}

		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

// GetReplay returns the full session recording for playback (legacy — prefer manifest+chunk)
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

	chunks, err := h.service.GetReplay(c.Request.Context(), websiteID, sessionID, userID)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to fetch session replay")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch session replay"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"chunks": chunks})
}

// GetReplayManifest returns ordered sequence numbers for a session (no S3 download).
func (h *ReplayHandler) GetReplayManifest(c *gin.Context) {
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

	seqs, err := h.service.GetReplayManifest(c.Request.Context(), websiteID, sessionID, userID)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to get replay manifest")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get replay manifest"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"sequences": seqs, "total_chunks": len(seqs)})
}

// GetReplayChunk downloads and returns a single chunk's events from S3.
func (h *ReplayHandler) GetReplayChunk(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	websiteID := c.Query("website_id")
	sessionID := c.Param("session_id")
	seqStr := c.DefaultQuery("seq", "0")

	seq, err := strconv.Atoi(seqStr)
	if err != nil || seq < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid seq parameter"})
		return
	}

	data, err := h.service.GetReplayChunk(c.Request.Context(), websiteID, sessionID, userID, seq)
	if err != nil {
		h.logger.Error().Err(err).Int("seq", seq).Msg("Failed to get replay chunk")
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.Header("Cache-Control", "private, max-age=3600")
	c.Data(http.StatusOK, "application/json", data)
}

// GetFullReplay downloads all chunks, stitches events into one sorted array,
// and returns {"events": [...]} in a single response. The client no longer
// needs progressive chunk streaming or buffer-ahead management.
func (h *ReplayHandler) GetFullReplay(c *gin.Context) {
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

	events, err := h.service.GetFullReplay(c.Request.Context(), websiteID, sessionID, userID)
	if err != nil {
		h.logger.Error().Err(err).Str("session_id", sessionID).Msg("Failed to get full replay")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Header("Cache-Control", "private, max-age=3600")
	// Write {"events": <raw-json-array>} without double-encoding the array.
	c.Header("Content-Type", "application/json")
	c.Writer.WriteHeader(http.StatusOK)
	c.Writer.Write([]byte(`{"events":`))
	c.Writer.Write(events)
	c.Writer.Write([]byte(`}`))
}

// ListSessions returns a paginated list of sessions with metadata.
// Supports cursor-based pagination via the `before` query param (ISO8601 timestamp).
// Response includes `total` (total sessions for the website) and `has_more` for the UI.
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

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	// Parse optional cursor: ISO8601 timestamp of the last seen session's start_time
	var before *time.Time
	if beforeStr := c.Query("before"); beforeStr != "" {
		t, err := time.Parse(time.RFC3339Nano, beforeStr)
		if err != nil {
			// Try without nanoseconds
			t, err = time.Parse(time.RFC3339, beforeStr)
		}
		if err == nil {
			before = &t
		}
	}

	h.logger.Debug().Str("website_id", websiteID).Msg("Listing recorded sessions")

	sessions, total, err := h.service.ListSessions(c.Request.Context(), websiteID, userID, limit, before)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to list recorded sessions")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list sessions"})
		return
	}

	// Provide next_cursor so the client can request the next page without offset.
	var nextCursor *string
	hasMore := len(sessions) == limit
	if hasMore && len(sessions) > 0 {
		last := sessions[len(sessions)-1]
		cursor := last.StartTime.UTC().Format(time.RFC3339Nano)
		nextCursor = &cursor
	}

	c.JSON(http.StatusOK, gin.H{
		"sessions":    sessions,
		"total":       total,
		"has_more":    hasMore,
		"next_cursor": nextCursor,
	})
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

	if err := h.service.DeleteReplay(c.Request.Context(), websiteID, sessionID, userID); err != nil {
		h.logger.Error().Err(err).Msg("Failed to delete session replay")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete session replay"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success"})
}

func (h *ReplayHandler) BulkDeleteReplays(c *gin.Context) {
	userID := h.getUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req models.BulkDeleteReplaysRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.logger.Info().
		Str("website_id", req.WebsiteID).
		Int("sessions", len(req.SessionIDs)).
		Msg("Bulk deleting session replays")

	if err := h.service.BulkDeleteReplays(c.Request.Context(), req.WebsiteID, req.SessionIDs, userID); err != nil {
		h.logger.Error().Err(err).Msg("Failed to bulk delete session replays")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to bulk delete session replays"})
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

	events, err := h.service.GetPageSnapshot(c.Request.Context(), websiteID, url)
	if err != nil {
		h.logger.Error().Err(err).Msg("Failed to fetch page snapshot")
		c.JSON(http.StatusNotFound, gin.H{"error": "No snapshot found for this URL"})
		return
	}

	c.Data(http.StatusOK, "application/json", events)
}

// GetPresignedManifest ensures the full-replay cache exists in S3 (stitching if
// needed), then returns a presigned URL the browser can use to download the
// complete rrweb event array directly — no API proxy, no double bandwidth.
func (h *ReplayHandler) GetPresignedManifest(c *gin.Context) {
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

	manifest, err := h.service.GetPresignedManifest(c.Request.Context(), websiteID, sessionID, userID)
	if err != nil {
		h.logger.Error().Err(err).Str("session_id", sessionID).Msg("Failed to get presigned manifest")
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Short cache: presigned URL is valid for 1 h, response cache for 5 min.
	c.Header("Cache-Control", "private, max-age=300")
	c.JSON(http.StatusOK, manifest)
}
