package tracker

import (
	"context"
	"sync"
	"time"

	analyticsModels "github.com/Seentics/seentics/internal/modules/analytics/models"
	analyticsSvc    "github.com/Seentics/seentics/internal/modules/analytics/services"
	automationSvc   "github.com/Seentics/seentics/internal/modules/automations/services"
	heatmapSvc      "github.com/Seentics/seentics/internal/modules/heatmaps/services"
	replaySvc       "github.com/Seentics/seentics/internal/modules/replays/services"

	"github.com/rs/zerolog"
)

// Hard caps — drop events rather than grow unbounded under a traffic spike or slow DB.
const (
	maxAnalyticsCap   = 50_000
	maxHeatmapsCap    = 20_000
	maxSessionsCap    = 30_000
	maxAutomationsCap = 10_000
)

// CollectBuffer holds four feature queues: each /collect appends validated, feature-ready rows.
// Every ~2s, flush swaps each queue and runs one DB batch per non-empty feature.
type CollectBuffer struct {
	mu          sync.Mutex
	analytics   []analyticsModels.Event
	heatmaps    []heatmapSvc.TrackerEvent
	sessions    []replaySvc.TrackerEvent
	automations []automationSvc.TrackerEvent

	eventsSvc   *analyticsSvc.EventService
	heatmapsSvc *heatmapSvc.HeatmapService
	replaysSvc  *replaySvc.ReplayService
	automationsSvc *automationSvc.AutomationService
	logger      zerolog.Logger
}

func NewCollectBuffer(
	events *analyticsSvc.EventService,
	heatmaps *heatmapSvc.HeatmapService,
	replays *replaySvc.ReplayService,
	automations *automationSvc.AutomationService,
	logger zerolog.Logger,
) *CollectBuffer {
	b := &CollectBuffer{
		analytics:      make([]analyticsModels.Event, 0, 2048),
		heatmaps:       make([]heatmapSvc.TrackerEvent, 0, 512),
		sessions:       make([]replaySvc.TrackerEvent, 0, 1024),
		automations:    make([]automationSvc.TrackerEvent, 0, 256),
		eventsSvc:      events,
		heatmapsSvc:    heatmaps,
		replaysSvc:     replays,
		automationsSvc: automations,
		logger:         logger,
	}
	go b.run()
	return b
}

// Push appends validated rows from one /collect into the feature buffers (short lock).
// Events are dropped with a warning if a queue is at its hard cap.
func (b *CollectBuffer) Push(
	analytics []analyticsModels.Event,
	heat []heatmapSvc.TrackerEvent,
	sessions []replaySvc.TrackerEvent,
	automations []automationSvc.TrackerEvent,
) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if len(analytics) > 0 {
		if len(b.analytics)+len(analytics) <= maxAnalyticsCap {
			b.analytics = append(b.analytics, analytics...)
		} else {
			b.logger.Warn().Int("drop", len(analytics)).Msg("analytics buffer full")
		}
	}
	if len(heat) > 0 {
		if len(b.heatmaps)+len(heat) <= maxHeatmapsCap {
			b.heatmaps = append(b.heatmaps, heat...)
		} else {
			b.logger.Warn().Int("drop", len(heat)).Msg("heatmaps buffer full")
		}
	}
	if len(sessions) > 0 {
		if len(b.sessions)+len(sessions) <= maxSessionsCap {
			b.sessions = append(b.sessions, sessions...)
		} else {
			b.logger.Warn().Int("drop", len(sessions)).Msg("sessions buffer full")
		}
	}
	if len(automations) > 0 {
		if len(b.automations)+len(automations) <= maxAutomationsCap {
			b.automations = append(b.automations, automations...)
		} else {
			b.logger.Warn().Int("drop", len(automations)).Msg("automations buffer full")
		}
	}
}

func (b *CollectBuffer) run() {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		b.flush()
	}
}

func (b *CollectBuffer) flush() {
	b.mu.Lock()
	if len(b.analytics) == 0 && len(b.heatmaps) == 0 && len(b.sessions) == 0 && len(b.automations) == 0 {
		b.mu.Unlock()
		return
	}
	analytics := b.analytics
	heatmaps := b.heatmaps
	sessions := b.sessions
	automations := b.automations
	b.analytics = make([]analyticsModels.Event, 0, largerCap(1024, len(analytics)))
	b.heatmaps = make([]heatmapSvc.TrackerEvent, 0, largerCap(256, len(heatmaps)))
	b.sessions = make([]replaySvc.TrackerEvent, 0, largerCap(512, len(sessions)))
	b.automations = make([]automationSvc.TrackerEvent, 0, largerCap(128, len(automations)))
	b.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	var wg sync.WaitGroup
	if len(analytics) > 0   { wg.Add(1); go b.flushAnalytics(ctx, &wg, analytics) }
	if len(heatmaps) > 0    { wg.Add(1); go b.flushHeatmaps(ctx, &wg, heatmaps) }
	if len(sessions) > 0    { wg.Add(1); go b.flushSessionRecordings(ctx, &wg, sessions) }
	if len(automations) > 0 { wg.Add(1); go b.flushAutomations(ctx, &wg, automations) }
	wg.Wait()
}

func largerCap(floor, lastLen int) int {
	if lastLen > floor {
		return lastLen
	}
	return floor
}

func (b *CollectBuffer) flushAnalytics(ctx context.Context, wg *sync.WaitGroup, events []analyticsModels.Event) {
	defer wg.Done()
	if len(events) == 0 {
		return
	}
	// Enrich here (geo/UA parsing) so the /collect handler returns immediately.
	if err := b.eventsSvc.EnrichCollectAnalytics(ctx, events); err != nil {
		b.logger.Warn().Err(err).Msg("flush: analytics enrichment")
	}
	if _, err := b.eventsSvc.FlushCollectAnalytics(ctx, events); err != nil {
		b.logger.Warn().Err(err).Msg("flush: analytics (pageviews/funnels/custom)")
	}
}

func (b *CollectBuffer) flushHeatmaps(ctx context.Context, wg *sync.WaitGroup, heatmaps []heatmapSvc.TrackerEvent) {
	defer wg.Done()
	if len(heatmaps) == 0 {
		return
	}
	if err := b.heatmapsSvc.ProcessEvents(ctx, heatmaps); err != nil {
		b.logger.Warn().Err(err).Msg("flush: heatmaps")
	}
}

func (b *CollectBuffer) flushSessionRecordings(ctx context.Context, wg *sync.WaitGroup, session []replaySvc.TrackerEvent) {
	defer wg.Done()
	if len(session) == 0 {
		return
	}
	if err := b.replaysSvc.ProcessEvents(ctx, session); err != nil {
		b.logger.Warn().Err(err).Msg("flush: session recordings")
	}
}

func (b *CollectBuffer) flushAutomations(ctx context.Context, wg *sync.WaitGroup, automations []automationSvc.TrackerEvent) {
	defer wg.Done()
	if len(automations) == 0 {
		return
	}
	if err := b.automationsSvc.ProcessTriggers(ctx, automations); err != nil {
		b.logger.Warn().Err(err).Msg("flush: automations")
	}
}
