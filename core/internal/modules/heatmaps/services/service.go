package services

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"

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

// ProcessEvents converts all heatmap events to points and writes them in one batch.
func (s *HeatmapService) ProcessEvents(ctx context.Context, websiteID uuid.UUID, events []TrackerEvent, ua string) error {
	if len(events) == 0 {
		return nil
	}
	uaInfo := utils.ParseUserAgent(ua)
	points := make([]models.HeatmapPoint, 0, len(events))

	for _, ev := range events {
		switch ev.Type {
		case "heatmap_click":
			points = append(points, models.HeatmapPoint{
				PagePath:       extractPath(ev.URL),
				EventType:      "click",
				DeviceType:     uaInfo.Device,
				XPercent:       int(toFloat(ev.Data["nx"]) * 10000),
				YPercent:       int(toFloat(ev.Data["ny"]) * 10000),
				TargetSelector: stringVal(ev.Data["target"]),
			})
		case "heatmap_scroll":
			points = append(points, models.HeatmapPoint{
				PagePath:   extractPath(ev.URL),
				EventType:  "scroll",
				DeviceType: uaInfo.Device,
				XPercent:   0,
				YPercent:   int(toFloat(ev.Data["depth"]) * 100),
			})
		}
	}

	if err := s.repo.BatchUpsertPoints(ctx, websiteID, points); err != nil {
		return fmt.Errorf("heatmap batch upsert: %w", err)
	}
	return nil
}

// GetHeatmap returns all heatmap points for a page and event type
func (s *HeatmapService) GetHeatmap(ctx context.Context, websiteID uuid.UUID, pagePath, eventType string) (*models.HeatmapData, error) {
	points, err := s.repo.GetHeatmapData(ctx, websiteID, pagePath, eventType)
	if err != nil {
		return nil, fmt.Errorf("get heatmap: %w", err)
	}
	return &models.HeatmapData{PagePath: pagePath, Points: points}, nil
}

// ListPages returns a summary of pages with heatmap data for a website
func (s *HeatmapService) ListPages(ctx context.Context, websiteID uuid.UUID) ([]models.PageSummary, error) {
	pages, err := s.repo.ListPages(ctx, websiteID)
	if err != nil {
		return nil, fmt.Errorf("list pages: %w", err)
	}
	return pages, nil
}

// DeleteHeatmaps clears all points for given page paths
func (s *HeatmapService) DeleteHeatmaps(ctx context.Context, websiteID uuid.UUID, pagePaths []string) error {
	if err := s.repo.DeleteHeatmaps(ctx, websiteID, pagePaths); err != nil {
		return fmt.Errorf("delete heatmaps: %w", err)
	}
	return nil
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
	switch n := v.(type) {
	case float64:
		return n
	case float32:
		return float64(n)
	case int:
		return float64(n)
	case int64:
		return float64(n)
	case json.Number:
		f, err := n.Float64()
		if err == nil {
			return f
		}
	case string:
		f, err := strconv.ParseFloat(n, 64)
		if err == nil {
			return f
		}
	}
	return 0
}

func stringVal(v interface{}) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}
