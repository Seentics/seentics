package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/Seentics/seentics/internal/modules/heatmaps/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// HeatmapRepository handles persistence for heatmap data
type HeatmapRepository struct {
	db *pgxpool.Pool
}

// NewHeatmapRepository creates a new HeatmapRepository
func NewHeatmapRepository(db *pgxpool.Pool) *HeatmapRepository {
	return &HeatmapRepository{db: db}
}

// UpsertPoint inserts a heatmap point or increments its intensity on conflict
func (r *HeatmapRepository) UpsertPoint(ctx context.Context, websiteID uuid.UUID, point models.HeatmapPoint) error {
	const q = `
		INSERT INTO heatmap_points
			(website_id, page_path, event_type, device_type, x_percent, y_percent, intensity, target_selector, last_updated)
		VALUES ($1, $2, $3, $4, $5, $6, 1, $7, NOW())
		ON CONFLICT (website_id, page_path, event_type, device_type, x_percent, y_percent)
		DO UPDATE SET
			intensity    = heatmap_points.intensity + 1,
			last_updated = NOW()
	`
	_, err := r.db.Exec(ctx, q,
		websiteID,
		point.PagePath,
		point.EventType,
		point.DeviceType,
		point.XPercent,
		point.YPercent,
		point.TargetSelector,
	)
	if err != nil {
		return fmt.Errorf("heatmap upsert: %w", err)
	}
	return nil
}

// GetHeatmapData returns all points for a given page and event type
func (r *HeatmapRepository) GetHeatmapData(ctx context.Context, websiteID uuid.UUID, pagePath, eventType string) ([]models.HeatmapPoint, error) {
	const q = `
		SELECT page_path, event_type, device_type, x_percent, y_percent, intensity,
		       COALESCE(target_selector, '')
		FROM heatmap_points
		WHERE website_id = $1
		  AND page_path  = $2
		  AND event_type = $3
		ORDER BY intensity DESC
	`
	rows, err := r.db.Query(ctx, q, websiteID, pagePath, eventType)
	if err != nil {
		return nil, fmt.Errorf("heatmap query: %w", err)
	}
	defer rows.Close()

	var points []models.HeatmapPoint
	for rows.Next() {
		var p models.HeatmapPoint
		if err := rows.Scan(
			&p.PagePath, &p.EventType, &p.DeviceType,
			&p.XPercent, &p.YPercent, &p.Intensity, &p.TargetSelector,
		); err != nil {
			return nil, fmt.Errorf("heatmap scan: %w", err)
		}
		points = append(points, p)
	}
	return points, nil
}

// ListPages returns a summary of click activity per page for a website
func (r *HeatmapRepository) ListPages(ctx context.Context, websiteID uuid.UUID) ([]models.PageSummary, error) {
	const q = `
		SELECT page_path,
		       COALESCE(SUM(intensity), 0)::int AS click_count,
		       MAX(last_updated)               AS last_seen
		FROM heatmap_points
		WHERE website_id = $1
		  AND event_type = 'click'
		GROUP BY page_path
		ORDER BY click_count DESC
	`
	rows, err := r.db.Query(ctx, q, websiteID)
	if err != nil {
		return nil, fmt.Errorf("list pages query: %w", err)
	}
	defer rows.Close()

	var pages []models.PageSummary
	for rows.Next() {
		var ps models.PageSummary
		var lastSeen time.Time
		if err := rows.Scan(&ps.PagePath, &ps.ClickCount, &lastSeen); err != nil {
			return nil, fmt.Errorf("list pages scan: %w", err)
		}
		ps.LastSeen = lastSeen
		pages = append(pages, ps)
	}
	return pages, nil
}
