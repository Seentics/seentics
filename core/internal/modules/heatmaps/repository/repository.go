package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/Seentics/seentics/internal/modules/heatmaps/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
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

const upsertPointSQL = `
	INSERT INTO heatmap_points
		(website_id, page_path, event_type, device_type, x_percent, y_percent, intensity, target_selector, last_updated)
	VALUES ($1, $2, $3, $4, $5, $6, 1, $7, NOW())
	ON CONFLICT (website_id, page_path, event_type, device_type, x_percent, y_percent, target_selector)
	DO UPDATE SET
		intensity    = heatmap_points.intensity + 1,
		last_updated = NOW()`

// BatchUpsertPoints sends all upserts in a single pgx pipeline (one network round-trip).
func (r *HeatmapRepository) BatchUpsertPoints(ctx context.Context, websiteID uuid.UUID, points []models.HeatmapPoint) error {
	if len(points) == 0 {
		return nil
	}
	batch := &pgx.Batch{}
	for _, p := range points {
		batch.Queue(upsertPointSQL, websiteID, p.PagePath, p.EventType, p.DeviceType, p.XPercent, p.YPercent, p.TargetSelector)
	}
	return r.db.SendBatch(ctx, batch).Close()
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
		ORDER BY intensity DESC`
	rows, err := r.db.Query(ctx, q, websiteID, pagePath, eventType)
	if err != nil {
		return nil, fmt.Errorf("heatmap query: %w", err)
	}
	defer rows.Close()

	var points []models.HeatmapPoint
	for rows.Next() {
		var p models.HeatmapPoint
		if err := rows.Scan(&p.PagePath, &p.EventType, &p.DeviceType, &p.XPercent, &p.YPercent, &p.Intensity, &p.TargetSelector); err != nil {
			return nil, fmt.Errorf("heatmap scan: %w", err)
		}
		points = append(points, p)
	}
	return points, nil
}

// ListPages returns a summary of all heatmap activity per page for a website.
// Includes click count, scroll count, and average scroll depth.
func (r *HeatmapRepository) ListPages(ctx context.Context, websiteID uuid.UUID) ([]models.PageSummary, error) {
	const q = `
		SELECT page_path,
		       COALESCE(SUM(CASE WHEN event_type = 'click'  THEN intensity ELSE 0 END), 0)::int AS click_count,
		       COALESCE(SUM(CASE WHEN event_type = 'scroll' THEN intensity ELSE 0 END), 0)::int AS scroll_count,
		       COALESCE(AVG(CASE WHEN event_type = 'scroll' THEN y_percent END), 0)::int        AS avg_scroll_raw,
		       MAX(last_updated) AS last_seen
		FROM heatmap_points
		WHERE website_id = $1
		GROUP BY page_path
		ORDER BY click_count DESC`
	rows, err := r.db.Query(ctx, q, websiteID)
	if err != nil {
		return nil, fmt.Errorf("list pages query: %w", err)
	}
	defer rows.Close()

	var pages []models.PageSummary
	for rows.Next() {
		var (
			ps            models.PageSummary
			avgScrollRaw  int
			lastSeen      time.Time
		)
		if err := rows.Scan(&ps.PagePath, &ps.ClickCount, &ps.ScrollCount, &avgScrollRaw, &lastSeen); err != nil {
			return nil, fmt.Errorf("list pages scan: %w", err)
		}
		ps.AvgScroll = avgScrollRaw / 100 // stored as depth*100, convert back to percent
		ps.LastSeen = lastSeen
		pages = append(pages, ps)
	}
	return pages, nil
}
// DeleteHeatmaps clears all heatmap points for a set of page paths
func (r *HeatmapRepository) DeleteHeatmaps(ctx context.Context, websiteID uuid.UUID, pagePaths []string) error {
	const q = `DELETE FROM heatmap_points WHERE website_id = $1 AND page_path = ANY($2)`
	_, err := r.db.Exec(ctx, q, websiteID, pagePaths)
	return err
}
