package tracker

import (
	"context"
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
	websiteModels   "github.com/Seentics/seentics/internal/modules/websites/models"
	websiteSvc      "github.com/Seentics/seentics/internal/modules/websites/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

type websiteCacheEntry struct {
	w      *websiteModels.Website
	expiry time.Time
}

type TrackerHandler struct {
	websites     *websiteSvc.WebsiteService
	analytics    *analyticsSvc.EventService
	funnels      *funnelSvc.FunnelService
	replays      *replaySvc.ReplayService
	automations  *automationSvc.AutomationService
	buffer       *CollectBuffer
	websiteCache sync.Map // map[string]*websiteCacheEntry — 60 s TTL
	logger       zerolog.Logger
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
		websites:    websites,
		analytics:   events,
		funnels:     funnels,
		replays:     replays,
		automations: automations,
		buffer:      NewCollectBuffer(events, heatmaps, replays, automations, logger),
		logger:      logger,
	}
}

// getCachedWebsite returns a website from a 60 s in-memory cache to avoid a DB
// round-trip on every /collect request.
func (h *TrackerHandler) getCachedWebsite(ctx context.Context, id string) (*websiteModels.Website, error) {
	if v, ok := h.websiteCache.Load(id); ok {
		e := v.(*websiteCacheEntry)
		if time.Now().Before(e.expiry) {
			return e.w, nil
		}
	}
	w, err := h.websites.GetWebsiteByID(ctx, id)
	if err != nil {
		return nil, err
	}
	h.websiteCache.Store(id, &websiteCacheEntry{w: w, expiry: time.Now().Add(5 * time.Minute)})
	return w, nil
}

// ── Init ─────────────────────────────────────────────────────────────────────

func (h *TrackerHandler) Init(c *gin.Context) {
	websiteID := c.Param("website_id")
	if websiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	origin := originOf(c)
	ctx    := c.Request.Context()

	w, err := h.websites.GetWebsiteByID(ctx, websiteID)
	if err != nil {
		h.logger.Warn().Err(err).Str("website_id", websiteID).Msg("tracker init: config fetch failed")
		c.JSON(http.StatusNotFound, gin.H{"error": "website not found or domain mismatch"})
		return
	}
	if !h.websites.ValidateOriginDomain(origin, w.URL) {
		h.logger.Warn().Str("website_id", websiteID).Str("origin", origin).Msg("tracker init: domain mismatch")
		c.JSON(http.StatusNotFound, gin.H{"error": "website not found or domain mismatch"})
		return
	}

	config, err := h.websites.TrackerConfigMap(ctx, w)
	if err != nil {
		h.logger.Warn().Err(err).Str("website_id", websiteID).Msg("tracker init: config build failed")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load tracker config"})
		return
	}

	funnels, err := h.funnels.GetActiveFunnels(ctx, w.ID.String(), origin)
	if err != nil {
		h.logger.Warn().Err(err).Str("website_id", websiteID).Msg("tracker init: funnels fetch failed")
		funnels = []funnelModels.Funnel{}
	}

	// Return automations so the tracker script can evaluate conditions client-side
	automations, err := h.automations.GetActive(ctx, w.ID.String())
	if err != nil {
		h.logger.Warn().Err(err).Str("website_id", websiteID).Msg("tracker init: automations fetch failed")
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
	WebsiteID   string         `json:"website_id"`
	Domain      string         `json:"domain"`
	Events      []TrackerEvent `json:"events,omitempty"`
	Session     []TrackerEvent `json:"session,omitempty"`
	Heatmaps    []TrackerEvent `json:"heatmaps,omitempty"`
	Funnels     []TrackerEvent `json:"funnels,omitempty"`
	Automations []TrackerEvent `json:"automations,omitempty"`
}

func (h *TrackerHandler) Collect(c *gin.Context) {
	var req CollectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if req.WebsiteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "website_id is required"})
		return
	}

	total := len(req.Events) + len(req.Heatmaps) + len(req.Funnels) + len(req.Automations) + len(req.Session)
	if total == 0 {
		c.Status(http.StatusNoContent)
		return
	}

	website, err := h.getCachedWebsite(c.Request.Context(), req.WebsiteID)
	if err != nil || !website.IsActive {
		c.JSON(http.StatusNotFound, gin.H{"error": "website not found or inactive"})
		return
	}

	// Validate using the real Origin/Referer header — not the client-supplied domain field.
	if !h.websites.ValidateOriginDomain(originOf(c), website.URL) {
		h.logger.Warn().Str("origin", originOf(c)).Str("site", website.URL).Msg("collect: domain mismatch")
		c.JSON(http.StatusForbidden, gin.H{"error": "domain mismatch"})
		return
	}

	websiteUUID, _ := uuid.Parse(website.ID.String())
	now := time.Now()
	ip := c.ClientIP()
	ua := c.Request.UserAgent()

	// Enrichment (geo/UA parsing) is deferred to the buffer flush — keeps this
	// handler at sub-millisecond latency.
	analytics := collectMergeAnalytics(website.SiteID, req.Events, req.Funnels, now, ip, ua)
	heatmaps := collectPrepareHeatmaps(req.Heatmaps, websiteUUID, ua)
	sessions := collectPrepareSessions(req.Session, website.SiteID, ip, ua)
	automations := collectPrepareAutomations(req.Automations, website.SiteID)

	h.buffer.Push(analytics, heatmaps, sessions, automations)

	c.Status(http.StatusNoContent)
}

// ── Type converters ───────────────────────────────────────────────────────────

// collectMergeAnalytics maps pageview/custom/funnel tracker rows into analytics events (enrichment follows).
func collectMergeAnalytics(siteID string, events, funnels []TrackerEvent, now time.Time, clientIP, clientUA string) []analyticsModels.Event {
	pe := toAnalyticsEvents(siteID, events, now, clientIP, clientUA)
	pf := toAnalyticsEvents(siteID, funnels, now, clientIP, clientUA)
	return append(pe, pf...)
}

func toAnalyticsEvents(siteID string, evs []TrackerEvent, now time.Time, clientIP, clientUA string) []analyticsModels.Event {
	out := make([]analyticsModels.Event, 0, len(evs))
	for _, e := range evs {
		ev := normalize(siteID, e, now)
		if clientIP != "" && (ev.IPAddress == nil || *ev.IPAddress == "") {
			ip := clientIP
			ev.IPAddress = &ip
		}
		if clientUA != "" && (ev.UserAgent == nil || *ev.UserAgent == "") {
			ua := clientUA
			ev.UserAgent = &ua
		}
		out = append(out, ev)
	}
	return out
}

// collectPrepareHeatmaps keeps only types the heatmap pipeline persists; unknown types are dropped.
func collectPrepareHeatmaps(evs []TrackerEvent, websiteUUID uuid.UUID, clientUA string) []heatmapSvc.TrackerEvent {
	out := make([]heatmapSvc.TrackerEvent, 0, len(evs))
	for _, e := range evs {
		if e.Type != "heatmap_click" && e.Type != "heatmap_scroll" {
			continue
		}
		out = append(out, heatmapSvc.TrackerEvent{
			Type: e.Type, Data: e.Data, TS: e.TS, URL: e.URL, SID: e.SID, VID: e.VID,
			WebsiteUUID: websiteUUID, ClientUA: clientUA,
		})
	}
	return out
}

// collectPrepareSessions keeps rrweb session rows with a non-empty session id.
func collectPrepareSessions(evs []TrackerEvent, websiteID, clientIP, clientUA string) []replaySvc.TrackerEvent {
	out := make([]replaySvc.TrackerEvent, 0, len(evs))
	for _, e := range evs {
		if e.Type != "" && e.Type != "rrweb" && e.Type != "session_error" {
			continue
		}
		if e.SID == "" {
			continue
		}
		out = append(out, replaySvc.TrackerEvent{
			Type: e.Type, Data: e.Data, TS: e.TS, URL: e.URL, SID: e.SID, VID: e.VID,
			WebsiteID: websiteID, ClientIP: clientIP, ClientUA: clientUA,
		})
	}
	return out
}

// collectPrepareAutomations keeps only rows the automation executor handles.
func collectPrepareAutomations(evs []TrackerEvent, websiteID string) []automationSvc.TrackerEvent {
	out := make([]automationSvc.TrackerEvent, 0, len(evs))
	for _, e := range evs {
		if e.Type != "automation_trigger" {
			continue
		}
		out = append(out, automationSvc.TrackerEvent{
			Type: e.Type, Data: e.Data, TS: e.TS, URL: e.URL, SID: e.SID, VID: e.VID,
			WebsiteID: websiteID,
		})
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
