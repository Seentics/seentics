package tracker

import (
	"net/http"
	"sync"
	"time"

	analyticsModels "github.com/Seentics/seentics/internal/modules/analytics/models"
	analyticsSvc "github.com/Seentics/seentics/internal/modules/analytics/services"
	funnelSvc "github.com/Seentics/seentics/internal/modules/funnels/services"
	websiteSvc "github.com/Seentics/seentics/internal/modules/websites/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

// TrackerHandler provides two endpoints for the tracker script:
//   GET  /tracker/init/:site_id  — returns config + active funnels
//   POST /tracker/collect        — receives all event types in one flat array
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
	return &TrackerHandler{websites: websites, events: events, funnels: funnels, logger: logger}
}

// ── Init ─────────────────────────────────────────────────────────────────────

// Init returns site config and active funnels in a single response.
// Cached 60 s on the client to avoid a request on every page load.
func (h *TrackerHandler) Init(c *gin.Context) {
	siteID := c.Param("site_id")
	if siteID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "site_id is required"})
		return
	}

	origin := originOf(c)
	ctx := c.Request.Context()

	config, err := h.websites.GetTrackerConfig(ctx, siteID, origin)
	if err != nil {
		h.logger.Warn().Err(err).Str("site_id", siteID).Msg("tracker init: config fetch failed")
		c.JSON(http.StatusNotFound, gin.H{"error": "website not found or domain mismatch"})
		return
	}

	funnels, err := h.funnels.GetActiveFunnels(ctx, siteID, origin)
	if err != nil {
		h.logger.Warn().Err(err).Str("site_id", siteID).Msg("tracker init: funnels fetch failed")
		funnels = nil
	}

	c.Header("Cache-Control", "private, max-age=60, stale-while-revalidate=120")
	c.JSON(http.StatusOK, gin.H{"config": config, "funnels": funnels})
}

// ── Collect ───────────────────────────────────────────────────────────────────

// TrackerEvent is the wire format emitted by seentics.js for a single event.
type TrackerEvent struct {
	Type string                 `json:"type"`
	Data map[string]interface{} `json:"data"`
	TS   int64                  `json:"ts"`  // Unix milliseconds (client clock)
	URL  string                 `json:"url"`
	SID  string                 `json:"sid"` // session id
	VID  string                 `json:"vid"` // visitor id
}

// CollectRequest mirrors the sectioned payload shape the tracker script sends.
// Only non-empty sections are included, so all fields are optional.
type CollectRequest struct {
	SiteID      string         `json:"site_id"`
	Domain      string         `json:"domain"`
	Events      []TrackerEvent `json:"events,omitempty"`      // pageview, custom, identify, performance
	Session     []TrackerEvent `json:"session,omitempty"`     // rec_snapshot, rec_mutation, rec_mouse …
	Heatmaps    []TrackerEvent `json:"heatmaps,omitempty"`    // heatmap_click, heatmap_scroll
	Funnels     []TrackerEvent `json:"funnels,omitempty"`     // funnel_step, funnel_complete
	Automations []TrackerEvent `json:"automations,omitempty"` // automation_trigger
}

// Collect receives all tracking data. Each section of the payload maps directly
// to a category — no grouping needed. Sections are dispatched concurrently.
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

	// Validate website once — reused by all goroutines.
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

	dispatch := func(label string, evs []TrackerEvent) {
		if len(evs) == 0 {
			return
		}
		wg.Add(1)
		go func() {
			defer wg.Done()
			resp, err := h.events.TrackBatchEvents(ctx, &analyticsModels.BatchEventRequest{
				SiteID:   siteID,
				Domain:   req.Domain,
				Events:   toAnalyticsEvents(siteID, evs, now),
				ClientIP: clientIP,
				ClientUA: clientUA,
			})
			if err != nil {
				h.logger.Warn().Err(err).Str("site_id", siteID).Str("section", label).Msg("collect: dispatch failed")
				return
			}
			add(resp.EventsCount)
		}()
	}

	dispatch("events",      req.Events)
	dispatch("session",     req.Session)
	dispatch("heatmaps",    req.Heatmaps)
	dispatch("funnels",     req.Funnels)
	dispatch("automations", req.Automations)

	wg.Wait()
	c.JSON(http.StatusOK, gin.H{"status": "ok", "processed": processed})
}

// ── Normalization ─────────────────────────────────────────────────────────────

// toAnalyticsEvents converts tracker wire events to the storage model.
// Common analytics fields are promoted to top-level columns; everything else
// is stored in Properties so nothing is lost.
func toAnalyticsEvents(siteID string, evs []TrackerEvent, now time.Time) []analyticsModels.Event {
	out := make([]analyticsModels.Event, 0, len(evs))
	for _, e := range evs {
		out = append(out, normalize(siteID, e, now))
	}
	return out
}

func normalize(siteID string, e TrackerEvent, now time.Time) analyticsModels.Event {
	ts := now
	if e.TS > 0 {
		candidate := time.UnixMilli(e.TS)
		// Accept timestamps within ±24 h of server time to tolerate clock skew
		// without accepting obviously bogus far-future or ancient values.
		if candidate.After(now.Add(-24*time.Hour)) && candidate.Before(now.Add(time.Minute)) {
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

	// Promote well-known data fields to dedicated columns; remainder → Properties.
	props := make(analyticsModels.Properties)
	for k, v := range e.Data {
		switch k {
		case "referrer":
			if s, ok := v.(string); ok && s != "" {
				ev.Referrer = &s
			}
		case "lang", "language":
			if s, ok := v.(string); ok && s != "" {
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
		case "utm":
			if m, ok := v.(map[string]interface{}); ok {
				setStr := func(dst **string, key string) {
					if s, ok := m[key].(string); ok && s != "" {
						*dst = &s
					}
				}
				setStr(&ev.UTMSource, "source")
				setStr(&ev.UTMMedium, "medium")
				setStr(&ev.UTMCampaign, "campaign")
				setStr(&ev.UTMTerm, "term")
				setStr(&ev.UTMContent, "content")
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
