package tracker

import (
	"fmt"
	"net/http"
	"sync"

	analyticsModels "github.com/Seentics/seentics/internal/modules/analytics/models"
	analyticsSvc "github.com/Seentics/seentics/internal/modules/analytics/services"
	funnelModels "github.com/Seentics/seentics/internal/modules/funnels/models"
	funnelSvc "github.com/Seentics/seentics/internal/modules/funnels/services"
	websiteSvc "github.com/Seentics/seentics/internal/modules/websites/services"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

// TrackerHandler provides two unified endpoints for the tracker script:
// Init (GET) — returns all config data in one call
// Collect (POST) — receives all tracking data in one payload
type TrackerHandler struct {
	websites *websiteSvc.WebsiteService
	events   *analyticsSvc.EventService
	funnels  *funnelSvc.FunnelService
	logger   zerolog.Logger
}

func NewTrackerHandler(
	websites *websiteSvc.WebsiteService,
	events *analyticsSvc.EventService,
	funnels *funnelSvc.FunnelService,
	logger zerolog.Logger,
) *TrackerHandler {
	return &TrackerHandler{
		websites: websites,
		events:   events,
		funnels:  funnels,
		logger:   logger,
	}
}

// Init returns all configuration data the tracker needs in a single response:
// site config (goals, feature flags) and active funnels.
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

	// Fetch config first — it validates the website + origin and is required.
	config, err := h.websites.GetTrackerConfig(ctx, siteID, origin)
	if err != nil {
		h.logger.Warn().Err(err).Str("site_id", siteID).Msg("Tracker init: config fetch failed")
		c.JSON(http.StatusNotFound, gin.H{"error": "Website not found or domain mismatch"})
		return
	}

	// Fetch active funnels (fail-open).
	funnels, err := h.funnels.GetActiveFunnels(ctx, siteID, origin)
	if err != nil {
		h.logger.Warn().Err(err).Str("site_id", siteID).Msg("Tracker init: funnels fetch failed")
		funnels = []funnelModels.Funnel{}
	}

	// Cache config for 60s — it changes rarely and the tracker polls on every page load.
	c.Header("Cache-Control", "private, max-age=60, stale-while-revalidate=120")
	c.JSON(http.StatusOK, gin.H{
		"config":  config,
		"funnels": funnels,
	})
}

// CollectRequest is the unified payload from the tracker script.
// All fields are optional — only sections with data need to be present.
type CollectRequest struct {
	SiteID  string                                 `json:"site_id"`
	Domain  string                                 `json:"domain"`
	Events  []analyticsModels.Event                `json:"events,omitempty"`
	Funnels []funnelModels.TrackFunnelEventRequest `json:"funnels,omitempty"`
}

// CollectResponse reports how many items were processed per section.
type CollectResponse struct {
	Status    string         `json:"status"`
	Processed map[string]int `json:"processed"`
}

// Collect receives all tracking data from the tracker in a single POST.
// Events and funnels are processed concurrently.
func (h *TrackerHandler) Collect(c *gin.Context) {
	ctx := c.Request.Context()

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
		maxEvents      = 500
		maxFunnelEvents = 200
	)
	switch {
	case len(req.Events) > maxEvents:
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("too many events (max %d)", maxEvents)})
		return
	case len(req.Funnels) > maxFunnelEvents:
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("too many funnel events (max %d)", maxFunnelEvents)})
		return
	}

	origin := c.Request.Header.Get("Origin")
	if origin == "" {
		origin = c.Request.Header.Get("Referer")
	}
	clientIP := c.ClientIP()
	userAgent := c.Request.UserAgent()

	// processed collects per-section counts; written only from section goroutines
	// which are guarded by wg, so a simple map + mu is sufficient.
	var mu sync.Mutex
	processed := make(map[string]int, 2)
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

	wg.Wait()
	c.JSON(http.StatusOK, CollectResponse{
		Status:    "ok",
		Processed: processed,
	})
}
