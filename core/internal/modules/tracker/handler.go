package tracker

import (
	"net/http"
	"time"

	analyticsModels "github.com/Seentics/seentics/internal/modules/analytics/models"
	analyticsSvc "github.com/Seentics/seentics/internal/modules/analytics/services"
	autoModels "github.com/Seentics/seentics/internal/modules/automations/models"
	autoSvc "github.com/Seentics/seentics/internal/modules/automations/services"
	funnelModels "github.com/Seentics/seentics/internal/modules/funnels/models"
	funnelSvc "github.com/Seentics/seentics/internal/modules/funnels/services"
	heatmapModels "github.com/Seentics/seentics/internal/modules/heatmaps/models"
	heatmapSvc "github.com/Seentics/seentics/internal/modules/heatmaps/services"
	replayModels "github.com/Seentics/seentics/internal/modules/replays/models"
	replaySvc "github.com/Seentics/seentics/internal/modules/replays/services"
	websiteSvc "github.com/Seentics/seentics/internal/modules/websites/services"
	"github.com/Seentics/seentics/internal/shared/utils"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

// TrackerHandler provides two unified endpoints for the tracker script:
// Init (GET) — returns all config data in one call
// Collect (POST) — receives all tracking data in one payload
type TrackerHandler struct {
	websites    *websiteSvc.WebsiteService
	events      *analyticsSvc.EventService
	heatmaps    heatmapSvc.HeatmapService
	replays     replaySvc.ReplayService
	funnels     *funnelSvc.FunnelService
	automations *autoSvc.AutomationService
	logger      zerolog.Logger
}

func NewTrackerHandler(
	websites *websiteSvc.WebsiteService,
	events *analyticsSvc.EventService,
	heatmaps heatmapSvc.HeatmapService,
	replays replaySvc.ReplayService,
	funnels *funnelSvc.FunnelService,
	automations *autoSvc.AutomationService,
	logger zerolog.Logger,
) *TrackerHandler {
	return &TrackerHandler{
		websites:    websites,
		events:      events,
		heatmaps:    heatmaps,
		replays:     replays,
		funnels:     funnels,
		automations: automations,
		logger:      logger,
	}
}

// Init returns all configuration data the tracker needs in a single response:
// site config (goals, feature flags), active funnels, and active automation workflows.
func (h *TrackerHandler) Init(c *gin.Context) {
	siteID := c.Param("site_id")
	if siteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "site_id is required"})
		return
	}

	origin := c.Request.Header.Get("Origin")
	if origin == "" {
		origin = c.Request.Header.Get("Referer")
	}

	// 1. Site config (includes goals, feature flags, heatmap/replay settings)
	config, err := h.websites.GetTrackerConfig(c.Request.Context(), siteID, origin)
	if err != nil {
		h.logger.Warn().Err(err).Str("site_id", siteID).Msg("Tracker init: config fetch failed")
		c.JSON(http.StatusNotFound, gin.H{"error": "Website not found or domain mismatch"})
		return
	}

	// 2. Active funnels (fail-open: return empty array on error)
	funnels, err := h.funnels.GetActiveFunnels(c.Request.Context(), siteID, origin)
	if err != nil {
		h.logger.Warn().Err(err).Str("site_id", siteID).Msg("Tracker init: funnels fetch failed")
		funnels = []funnelModels.Funnel{}
	}

	// 3. Active automation workflows (fail-open: return empty array on error)
	workflows, err := h.automations.GetActiveAutomations(c.Request.Context(), siteID, origin)
	if err != nil {
		h.logger.Warn().Err(err).Str("site_id", siteID).Msg("Tracker init: workflows fetch failed")
		workflows = []autoModels.Automation{}
	}

	c.JSON(http.StatusOK, gin.H{
		"config":    config,
		"funnels":   funnels,
		"workflows": workflows,
	})
}

// CollectRequest is the unified payload from the tracker script.
// All fields are optional — only sections with data need to be present.
type CollectRequest struct {
	SiteID      string                              `json:"site_id"`
	Domain      string                              `json:"domain"`
	Events      []analyticsModels.Event             `json:"events,omitempty"`
	Heatmaps    []heatmapModels.HeatmapPoint        `json:"heatmaps,omitempty"`
	Replay      *replayModels.RecordReplayRequest    `json:"replay,omitempty"`
	Funnels     []funnelModels.TrackFunnelEventRequest `json:"funnels,omitempty"`
	Automations []autoModels.AutomationExecution     `json:"automations,omitempty"`
}

// CollectResponse reports how many items were processed per section.
type CollectResponse struct {
	Status    string            `json:"status"`
	Processed map[string]int    `json:"processed"`
}

// Collect receives all tracking data from the tracker in a single POST.
// Each section is processed independently — failure in one doesn't block others.
func (h *TrackerHandler) Collect(c *gin.Context) {
	var req CollectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if req.SiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "site_id is required"})
		return
	}

	origin := c.Request.Header.Get("Origin")
	if origin == "" {
		origin = c.Request.Header.Get("Referer")
	}

	// Extract client IP once for all sections
	clientIP := c.ClientIP()
	userAgent := c.Request.UserAgent()

	processed := make(map[string]int)
	ctx := c.Request.Context()

	// --- Events ---
	if len(req.Events) > 0 {
		// Set IP and website_id on all events
		for i := range req.Events {
			req.Events[i].WebsiteID = req.SiteID
			if req.Events[i].IPAddress == nil || *req.Events[i].IPAddress == "" {
				req.Events[i].IPAddress = &clientIP
			}
			if req.Events[i].UserAgent == nil || *req.Events[i].UserAgent == "" {
				req.Events[i].UserAgent = &userAgent
			}
		}

		batchReq := &analyticsModels.BatchEventRequest{
			SiteID: req.SiteID,
			Domain: req.Domain,
			Events: req.Events,
		}
		resp, err := h.events.TrackBatchEvents(ctx, batchReq)
		if err != nil {
			h.logger.Warn().Err(err).Str("site_id", req.SiteID).Msg("Collect: events processing failed")
		} else {
			processed["events"] = resp.EventsCount
		}
	}

	// --- Heatmaps ---
	if len(req.Heatmaps) > 0 {
		for i := range req.Heatmaps {
			req.Heatmaps[i].WebsiteID = req.SiteID
		}
		heatmapReq := heatmapModels.HeatmapRecordRequest{
			WebsiteID: req.SiteID,
			Points:    req.Heatmaps,
		}
		if err := h.heatmaps.RecordHeatmapData(heatmapReq, origin); err != nil {
			h.logger.Warn().Err(err).Str("site_id", req.SiteID).Msg("Collect: heatmap processing failed")
		} else {
			processed["heatmaps"] = len(req.Heatmaps)
		}
	}

	// --- Replay ---
	if req.Replay != nil && len(req.Replay.Events) > 0 {
		req.Replay.WebsiteID = req.SiteID

		// Resolve country from CDN headers or geolocation
		country := c.Request.Header.Get("CF-IPCountry")
		if country == "" {
			country = c.Request.Header.Get("X-Vercel-IP-Country")
		}
		if country == "" {
			country = c.Request.Header.Get("X-Country-Code")
		}
		if country == "" {
			geo := utils.GetLocationFromIP(clientIP)
			if geo.CountryCode != "" && geo.CountryCode != "XX" {
				country = geo.CountryCode
			}
		}

		if err := h.replays.RecordReplay(ctx, *req.Replay, origin, userAgent, country); err != nil {
			h.logger.Warn().Err(err).Str("site_id", req.SiteID).Msg("Collect: replay processing failed")
		} else {
			processed["replay"] = 1
		}
	}

	// --- Funnels ---
	if len(req.Funnels) > 0 {
		count := 0
		for i := range req.Funnels {
			req.Funnels[i].WebsiteID = req.SiteID
			if err := h.funnels.TrackFunnelEvent(ctx, &req.Funnels[i], origin); err != nil {
				h.logger.Warn().Err(err).Str("site_id", req.SiteID).Msg("Collect: funnel event processing failed")
			} else {
				count++
			}
		}
		processed["funnels"] = count
	}

	// --- Automations ---
	if len(req.Automations) > 0 {
		count := 0
		for i := range req.Automations {
			req.Automations[i].WebsiteID = req.SiteID
			if req.Automations[i].ExecutedAt.IsZero() {
				req.Automations[i].ExecutedAt = time.Now()
			}
			if err := h.automations.TrackExecution(ctx, &req.Automations[i], origin); err != nil {
				h.logger.Warn().Err(err).Str("site_id", req.SiteID).Msg("Collect: automation execution processing failed")
			} else {
				count++
			}
		}
		processed["automations"] = count
	}

	c.JSON(http.StatusOK, CollectResponse{
		Status:    "ok",
		Processed: processed,
	})
}

