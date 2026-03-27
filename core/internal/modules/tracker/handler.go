package tracker

import (
	"net/http"
	"sync"
	"time"

	analyticsModels "github.com/Seentics/seentics/internal/modules/analytics/models"
	analyticsSvc    "github.com/Seentics/seentics/internal/modules/analytics/services"
	automationSvc   "github.com/Seentics/seentics/internal/modules/automations/services"
	funnelModels    "github.com/Seentics/seentics/internal/modules/funnels/models"
	funnelSvc       "github.com/Seentics/seentics/internal/modules/funnels/services"
	heatmapSvc      "github.com/Seentics/seentics/internal/modules/heatmaps/services"
	replaySvc       "github.com/Seentics/seentics/internal/modules/replays/services"
	websiteSvc      "github.com/Seentics/seentics/internal/modules/websites/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

type TrackerHandler struct {
	websites    *websiteSvc.WebsiteService
	events      *analyticsSvc.EventService
	funnels     *funnelSvc.FunnelService
	heatmaps    *heatmapSvc.HeatmapService
	replays     *replaySvc.ReplayService
	automations *automationSvc.AutomationService
	logger      zerolog.Logger
}

func NewTrackerHandler(
	websites    *websiteSvc.WebsiteService,
	events      *analyticsSvc.EventService,
	funnels     *funnelSvc.FunnelService,
	heatmaps    *heatmapSvc.HeatmapService,
	replays     *replaySvc.ReplayService,
	automations *automationSvc.AutomationService,
	logger      zerolog.Logger,
) *TrackerHandler {
	return &TrackerHandler{
		websites: websites, events: events, funnels: funnels,
		heatmaps: heatmaps, replays: replays, automations: automations,
		logger: logger,
	}
}

// ── Init ─────────────────────────────────────────────────────────────────────

func (h *TrackerHandler) Init(c *gin.Context) {
	siteID := c.Param("site_id")
	if siteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "site_id is required"})
		return
	}

	origin := originOf(c)
	ctx    := c.Request.Context()

	config, err := h.websites.GetTrackerConfig(ctx, siteID, origin)
	if err != nil {
		h.logger.Warn().Err(err).Str("site_id", siteID).Msg("tracker init: config fetch failed")
		c.JSON(http.StatusNotFound, gin.H{"error": "website not found or domain mismatch"})
		return
	}

	funnels, err := h.funnels.GetActiveFunnels(ctx, siteID, origin)
	if err != nil {
		h.logger.Warn().Err(err).Str("site_id", siteID).Msg("tracker init: funnels fetch failed")
		funnels = []funnelModels.Funnel{}
	}

	// Return automations so the tracker script can evaluate conditions client-side
	automations, err := h.automations.GetActive(ctx, siteID)
	if err != nil {
		h.logger.Warn().Err(err).Str("site_id", siteID).Msg("tracker init: automations fetch failed")
		automations = nil
	}

	c.Header("Cache-Control", "private, max-age=60, stale-while-revalidate=120")
	c.JSON(http.StatusOK, gin.H{
		"config":      config,
		"funnels":     funnels,
		"automations": automations,
	})
}

// ── Collect ───────────────────────────────────────────────────────────────────

type TrackerEvent struct {
	Type string                 `json:"type"`
	Data map[string]interface{} `json:"data"`
	TS   int64                  `json:"ts"`
	URL  string                 `json:"url"`
	SID  string                 `json:"sid"`
	VID  string                 `json:"vid"`
}

type CollectRequest struct {
	SiteID      string         `json:"site_id"`
	Domain      string         `json:"domain"`
	Events      []TrackerEvent `json:"events,omitempty"`
	Session     []TrackerEvent `json:"session,omitempty"`
	Heatmaps    []TrackerEvent `json:"heatmaps,omitempty"`
	Funnels     []TrackerEvent `json:"funnels,omitempty"`
	Automations []TrackerEvent `json:"automations,omitempty"`
}

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
	total := len(req.Events) + len(req.Session) + len(req.Heatmaps) + len(req.Funnels) + len(req.Automations)
	if total == 0 {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "processed": 0})
		return
	}
	if total > 500 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "too many events (max 500 total)"})
		return
	}

	website, err := h.websites.GetWebsiteByAnyID(ctx, req.SiteID)
	if err != nil || !website.IsActive {
		c.JSON(http.StatusNotFound, gin.H{"error": "website not found or inactive"})
		return
	}
	if !h.websites.ValidateOriginDomain(req.Domain, website.URL) {
		h.logger.Warn().Str("domain", req.Domain).Str("site", website.URL).Msg("collect: domain mismatch")
		c.JSON(http.StatusForbidden, gin.H{"error": "domain mismatch"})
		return
	}

	clientIP := c.ClientIP()
	clientUA := c.Request.UserAgent()
	siteID   := website.SiteID
	now      := time.Now()

	var (
		mu        sync.Mutex
		processed int
		wg        sync.WaitGroup
	)
	add := func(n int) { mu.Lock(); processed += n; mu.Unlock() }

	// ── Analytics (pageview / custom / identify / performance) ──────────────
	if len(req.Events) > 0 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			resp, err := h.events.TrackBatchEvents(ctx, &analyticsModels.BatchEventRequest{
				SiteID:   siteID,
				Domain:   req.Domain,
				Events:   toAnalyticsEvents(siteID, req.Events, now),
				ClientIP: clientIP,
				ClientUA: clientUA,
			})
			if err != nil {
				h.logger.Warn().Err(err).Str("section", "events").Msg("collect: dispatch failed")
				return
			}
			add(resp.EventsCount)
		}()
	}

	// ── Heatmaps → dedicated heatmap_points table ────────────────────────────
	if len(req.Heatmaps) > 0 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			websiteUUID, err := uuid.Parse(website.ID.String())
			if err != nil {
				return
			}
			if err := h.heatmaps.ProcessEvents(ctx, websiteUUID, toHeatmapEvents(req.Heatmaps), clientUA); err != nil {
				h.logger.Warn().Err(err).Str("section", "heatmaps").Msg("collect: dispatch failed")
				return
			}
			add(len(req.Heatmaps))
		}()
	}

	// ── Session recording → MinIO/S3 ─────────────────────────────────────────
	if len(req.Session) > 0 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := h.replays.ProcessEvents(ctx, siteID, toReplayEvents(req.Session), clientUA, clientIP); err != nil {
				h.logger.Warn().Err(err).Str("section", "session").Msg("collect: dispatch failed")
				return
			}
			add(len(req.Session))
		}()
	}

	// ── Funnels → analytics events table (event_type=funnel_step/complete) ──
	if len(req.Funnels) > 0 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			resp, err := h.events.TrackBatchEvents(ctx, &analyticsModels.BatchEventRequest{
				SiteID:   siteID,
				Domain:   req.Domain,
				Events:   toAnalyticsEvents(siteID, req.Funnels, now),
				ClientIP: clientIP,
				ClientUA: clientUA,
			})
			if err != nil {
				h.logger.Warn().Err(err).Str("section", "funnels").Msg("collect: dispatch failed")
				return
			}
			add(resp.EventsCount)
		}()
	}

	// ── Automations → verify + record execution ───────────────────────────────
	if len(req.Automations) > 0 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := h.automations.ProcessTriggers(ctx, siteID, toAutomationEvents(req.Automations)); err != nil {
				h.logger.Warn().Err(err).Str("section", "automations").Msg("collect: dispatch failed")
				return
			}
			add(len(req.Automations))
		}()
	}

	wg.Wait()
	c.JSON(http.StatusOK, gin.H{"status": "ok", "processed": processed})
}

// ── Type converters ───────────────────────────────────────────────────────────

func toAnalyticsEvents(siteID string, evs []TrackerEvent, now time.Time) []analyticsModels.Event {
	out := make([]analyticsModels.Event, 0, len(evs))
	for _, e := range evs {
		out = append(out, normalize(siteID, e, now))
	}
	return out
}

func toHeatmapEvents(evs []TrackerEvent) []heatmapSvc.TrackerEvent {
	out := make([]heatmapSvc.TrackerEvent, len(evs))
	for i, e := range evs {
		out[i] = heatmapSvc.TrackerEvent{Type: e.Type, Data: e.Data, TS: e.TS, URL: e.URL, SID: e.SID, VID: e.VID}
	}
	return out
}

func toReplayEvents(evs []TrackerEvent) []replaySvc.TrackerEvent {
	out := make([]replaySvc.TrackerEvent, len(evs))
	for i, e := range evs {
		out[i] = replaySvc.TrackerEvent{Type: e.Type, Data: e.Data, TS: e.TS, URL: e.URL, SID: e.SID, VID: e.VID}
	}
	return out
}

func toAutomationEvents(evs []TrackerEvent) []automationSvc.TrackerEvent {
	out := make([]automationSvc.TrackerEvent, len(evs))
	for i, e := range evs {
		out[i] = automationSvc.TrackerEvent{Type: e.Type, Data: e.Data, TS: e.TS, URL: e.URL, SID: e.SID, VID: e.VID}
	}
	return out
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func originOf(c *gin.Context) string {
	if o := c.Request.Header.Get("Origin"); o != "" {
		return o
	}
	return c.Request.Header.Get("Referer")
}

func toInt(v interface{}) (int, bool) {
	switch n := v.(type) {
	case float64:
		return int(n), true
	case int:
		return n, true
	case int64:
		return int(n), true
	}
	return 0, false
}

func normalize(siteID string, e TrackerEvent, now time.Time) analyticsModels.Event {
	ts := now
	if e.TS > 0 {
		candidate := time.UnixMilli(e.TS)
		if diff := now.Sub(candidate); diff < 24*time.Hour && diff > -24*time.Hour {
			ts = candidate
		}
	}

	ev := analyticsModels.Event{
		ID:        uuid.New(),
		WebsiteID: siteID,
		VisitorID: e.VID,
		SessionID: e.SID,
		EventType: e.Type,
		Page:      e.URL,
		Timestamp: ts,
	}

	props := analyticsModels.Properties{}
	for k, v := range e.Data {
		switch k {
		case "referrer":
			if s, ok := v.(string); ok {
				ev.Referrer = &s
			}
		case "lang", "language":
			if s, ok := v.(string); ok {
				ev.Language = &s
			}
		case "sw":
			if n, ok := toInt(v); ok {
				ev.ScreenWidth = &n
			}
		case "sh":
			if n, ok := toInt(v); ok {
				ev.ScreenHeight = &n
			}
		case "utm_source":
			if s, ok := v.(string); ok {
				ev.UTMSource = &s
			}
		case "utm_medium":
			if s, ok := v.(string); ok {
				ev.UTMMedium = &s
			}
		case "utm_campaign":
			if s, ok := v.(string); ok {
				ev.UTMCampaign = &s
			}
		case "utm_term":
			if s, ok := v.(string); ok {
				ev.UTMTerm = &s
			}
		case "utm_content":
			if s, ok := v.(string); ok {
				ev.UTMContent = &s
			}
		default:
			props[k] = v
		}
	}
	if len(props) > 0 {
		ev.Properties = props
	}
	return ev
}
