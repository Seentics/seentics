package services

import (
	"context"
	"fmt"
	"net/url"

	"github.com/Seentics/seentics/internal/modules/heatmaps/models"
	"github.com/Seentics/seentics/internal/modules/heatmaps/repository"
	"github.com/Seentics/seentics/internal/shared/utils"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

// TrackerEvent is the wire-format event emitted by seentics.js
type TrackerEvent struct {
	Type string                 `json:"type"`
	Data map[string]interface{} `json:"data"`
	TS   int64                  `json:"ts"`
	URL  string                 `json:"url"`
	SID  string                 `json:"sid"`
	VID  string                 `json:"vid"`
}

// HeatmapService orchestrates heatmap processing
type HeatmapService struct {
	repo   *repository.HeatmapRepository
	logger zerolog.Logger
}

// NewHeatmapService creates a new HeatmapService
func NewHeatmapService(repo *repository.HeatmapRepository, logger zerolog.Logger) *HeatmapService {
	return &HeatmapService{repo: repo, logger: logger}
}

// ProcessEvents handles a batch of heatmap tracker events for a website
func (s *HeatmapService) ProcessEvents(ctx context.Context, websiteID uuid.UUID, events []TrackerEvent, ua string) error {
	uaInfo := utils.ParseUserAgent(ua)

	for _, ev := range events {
		switch ev.Type {
		case "heatmap_click":
			if err := s.processClick(ctx, websiteID, ev, uaInfo.Device); err != nil {
				s.logger.Warn().Err(err).Str("type", ev.Type).Msg("heatmap: failed to process click")
			}
		case "heatmap_scroll":
			if err := s.processScroll(ctx, websiteID, ev, uaInfo.Device); err != nil {
				s.logger.Warn().Err(err).Str("type", ev.Type).Msg("heatmap: failed to process scroll")
			}
		}
	}
	return nil
}

func (s *HeatmapService) processClick(ctx context.Context, websiteID uuid.UUID, ev TrackerEvent, deviceType string) error {
	pagePath := extractPath(ev.URL)
	nx := toFloat(ev.Data["nx"])
	ny := toFloat(ev.Data["ny"])

	var targetSelector string
	if ts, ok := ev.Data["target_selector"].(string); ok {
		targetSelector = ts
	}

	point := models.HeatmapPoint{
		PagePath:       pagePath,
		EventType:      "click",
		DeviceType:     deviceType,
		XPercent:       int(nx * 10000),
		YPercent:       int(ny * 10000),
		TargetSelector: targetSelector,
	}
	return s.repo.UpsertPoint(ctx, websiteID, point)
}

func (s *HeatmapService) processScroll(ctx context.Context, websiteID uuid.UUID, ev TrackerEvent, deviceType string) error {
	pagePath := extractPath(ev.URL)
	depth := toFloat(ev.Data["depth"]) // 0–100

	point := models.HeatmapPoint{
		PagePath:   pagePath,
		EventType:  "scroll",
		DeviceType: deviceType,
		XPercent:   0,
		YPercent:   int(depth * 100),
	}
	return s.repo.UpsertPoint(ctx, websiteID, point)
}

// GetHeatmap returns all heatmap points for a page and event type
func (s *HeatmapService) GetHeatmap(ctx context.Context, websiteID uuid.UUID, pagePath, eventType string) (*models.HeatmapData, error) {
	points, err := s.repo.GetHeatmapData(ctx, websiteID, pagePath, eventType)
	if err != nil {
		return nil, fmt.Errorf("get heatmap: %w", err)
	}
	return &models.HeatmapData{
		PagePath: pagePath,
		Points:   points,
	}, nil
}

// ListPages returns a summary of pages with heatmap data for a website
func (s *HeatmapService) ListPages(ctx context.Context, websiteID uuid.UUID) ([]models.PageSummary, error) {
	pages, err := s.repo.ListPages(ctx, websiteID)
	if err != nil {
		return nil, fmt.Errorf("list pages: %w", err)
	}
	return pages, nil
}

// ── helpers ──────────────────────────────────────────────────────────────────

func extractPath(rawURL string) string {
	if rawURL == "" {
		return "/"
	}
	u, err := url.Parse(rawURL)
	if err != nil || u.Path == "" {
		return "/"
	}
	return u.Path
}

func toFloat(v interface{}) float64 {
	if f, ok := v.(float64); ok {
		return f
	}
	return 0
}
