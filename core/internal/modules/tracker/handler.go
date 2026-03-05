package tracker

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"sync"
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

	ctx := c.Request.Context()
	if h := c.GetHeader("X-Max-Heatmaps"); h != "" {
		if limit, err := strconv.Atoi(h); err == nil {
			ctx = context.WithValue(ctx, "max_heatmaps", limit)
		}
	}
	if h := c.GetHeader("X-Max-Replays"); h != "" {
		if limit, err := strconv.Atoi(h); err == nil {
			ctx = context.WithValue(ctx, "max_replays", limit)
		}
	}

	// 1. Site config (includes goals, feature flags, heatmap/replay settings)
	config, err := h.websites.GetTrackerConfig(ctx, siteID, origin)
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
	SiteID      string                                 `json:"site_id"`
	Domain      string                                 `json:"domain"`
	Events      []analyticsModels.Event                `json:"events,omitempty"`
	Heatmaps    []heatmapModels.HeatmapPoint           `json:"heatmaps,omitempty"`
	Replay      *replayModels.RecordReplayRequest      `json:"replay,omitempty"`
	Funnels     []funnelModels.TrackFunnelEventRequest `json:"funnels,omitempty"`
	Automations []autoModels.AutomationExecution       `json:"automations,omitempty"`
}

// CollectResponse reports how many items were processed per section.
type CollectResponse struct {
	Status    string         `json:"status"`
	Processed map[string]int `json:"processed"`
}

// Collect receives all tracking data from the tracker in a single POST.
// All independent sections (events, heatmaps, funnels, automations) are processed
// concurrently. Replay is fire-and-forget. Enrichment happens upfront in a single
// pass before any goroutine is spawned to avoid data races.
func (h *TrackerHandler) Collect(c *gin.Context) {
	// Inject plan limits from gateway headers into context.
	ctx := c.Request.Context()
	if v := c.GetHeader("X-Max-Heatmaps"); v != "" {
		if limit, err := strconv.Atoi(v); err == nil {
			ctx = context.WithValue(ctx, "max_heatmaps", limit)
		}
	}
	if v := c.GetHeader("X-Max-Replays"); v != "" {
		if limit, err := strconv.Atoi(v); err == nil {
			ctx = context.WithValue(ctx, "max_replays", limit)
		}
	}

	var req CollectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if req.SiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "site_id is required"})
		return
	}

	// Guard against oversized batches to prevent memory/CPU abuse.
	const (
		maxEvents        = 500
		maxHeatmapPoints = 2000
		maxReplayEvents  = 5000
		maxFunnelEvents  = 200
		maxAutomations   = 100
	)
	switch {
	case len(req.Events) > maxEvents:
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("too many events (max %d)", maxEvents)})
		return
	case len(req.Heatmaps) > maxHeatmapPoints:
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("too many heatmap points (max %d)", maxHeatmapPoints)})
		return
	case req.Replay != nil && len(req.Replay.Events) > maxReplayEvents:
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("too many replay events (max %d)", maxReplayEvents)})
		return
	case len(req.Funnels) > maxFunnelEvents:
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("too many funnel events (max %d)", maxFunnelEvents)})
		return
	case len(req.Automations) > maxAutomations:
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("too many automations (max %d)", maxAutomations)})
		return
	}

	origin := c.Request.Header.Get("Origin")
	if origin == "" {
		origin = c.Request.Header.Get("Referer")
	}
	clientIP := c.ClientIP()
	userAgent := c.Request.UserAgent()
	now := time.Now()

	// processed collects per-section counts; written only from section goroutines
	// which are guarded by wg, so a simple map + mu is sufficient.
	var mu sync.Mutex
	processed := make(map[string]int, 5)
	record := func(key string, n int) {
		mu.Lock()
		processed[key] = n
		mu.Unlock()
	}

	var wg sync.WaitGroup

	// --- Events (single batch call — IP/UA enrichment happens inside the service) ---
	if len(req.Events) > 0 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			resp, err := h.events.TrackBatchEvents(ctx, &analyticsModels.BatchEventRequest{
				SiteID:   req.SiteID,
				Domain:   req.Domain,
				Events:   req.Events,
				ClientIP: clientIP,
				ClientUA: userAgent,
			})
			if err != nil {
				h.logger.Warn().Err(err).Str("site_id", req.SiteID).Msg("Collect: events processing failed")
				return
			}
			record("events", resp.EventsCount)
		}()
	}

	// --- Heatmaps (single batch call) ---
	if len(req.Heatmaps) > 0 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := h.heatmaps.RecordHeatmapData(ctx, heatmapModels.HeatmapRecordRequest{
				WebsiteID: req.SiteID,
				Points:    req.Heatmaps,
			}, origin); err != nil {
				h.logger.Warn().Err(err).Str("site_id", req.SiteID).Msg("Collect: heatmap processing failed")
				return
			}
			record("heatmaps", len(req.Heatmaps))
		}()
	}

	// --- Replay (fire-and-forget — S3 upload must not block the response) ---
	if req.Replay != nil && len(req.Replay.Events) > 0 {
		req.Replay.WebsiteID = req.SiteID
		country := c.Request.Header.Get("CF-IPCountry")
		if country == "" {
			country = c.Request.Header.Get("X-Vercel-IP-Country")
		}
		if country == "" {
			country = c.Request.Header.Get("X-Country-Code")
		}
		if country == "" {
			if geo := utils.GetLocationFromIP(clientIP); geo.CountryCode != "" && geo.CountryCode != "XX" {
				country = geo.CountryCode
			}
		}
		replayCopy := *req.Replay
		go func() {
			bgCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			if err := h.replays.RecordReplay(bgCtx, replayCopy, origin, userAgent, country); err != nil {
				h.logger.Warn().Err(err).Str("site_id", req.SiteID).Msg("Collect: replay processing failed (async)")
			}
		}()
		record("replay", 1)
	}

	// --- Funnels (1 DB lookup for all events via batch method) ---
	if len(req.Funnels) > 0 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := h.funnels.TrackFunnelEventBatch(ctx, req.SiteID, req.Funnels, origin); err != nil {
				h.logger.Warn().Err(err).Str("site_id", req.SiteID).Msg("Collect: funnel batch processing failed")
				return
			}
			record("funnels", len(req.Funnels))
		}()
	}

	// --- Automations (1 DB lookup + 1 batch insert via batch method) ---
	if len(req.Automations) > 0 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := h.automations.TrackExecutionBatch(ctx, req.SiteID, req.Automations, origin, now); err != nil {
				h.logger.Warn().Err(err).Str("site_id", req.SiteID).Msg("Collect: automation batch processing failed")
				return
			}
			record("automations", len(req.Automations))
		}()
	}

	wg.Wait()
	c.JSON(http.StatusOK, CollectResponse{
		Status:    "ok",
		Processed: processed,
	})
}
