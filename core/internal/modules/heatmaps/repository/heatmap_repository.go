package repository

import (
	"analytics-app/internal/modules/heatmaps/models"
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type HeatmapRepository interface {
	RecordHeatmap(ctx context.Context, websiteID string, points []models.HeatmapPoint) error
	GetHeatmapData(ctx context.Context, websiteID string, url string, heatmapType string, from, to time.Time) ([]models.HeatmapPoint, error)
	GetHeatmapPages(ctx context.Context, websiteID string) ([]models.HeatmapPageStat, error)
	CountHeatmapPages(ctx context.Context, websiteID string) (int, error)
	HeatmapExistsForURL(ctx context.Context, websiteID string, url string) (bool, error)
	GetTrackedURLs(ctx context.Context, websiteID string) ([]string, error)
	DeleteHeatmapPage(ctx context.Context, websiteID string, url string) error
}

type heatmapRepository struct {
	db *pgxpool.Pool
}

func NewHeatmapRepository(db *pgxpool.Pool) HeatmapRepository {
	return &heatmapRepository{db: db}
}

func (r *heatmapRepository) RecordHeatmap(ctx context.Context, websiteID string, points []models.HeatmapPoint) error {
	if len(points) == 0 {
		return nil
	}

	query := `
		INSERT INTO heatmap_points (website_id, page_path, event_type, device_type, x_percent, y_percent, target_selector, intensity, last_updated)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 1, NOW())
		ON CONFLICT (website_id, page_path, event_type, device_type, x_percent, y_percent, target_selector)
		DO UPDATE SET
			intensity = heatmap_points.intensity + 1,
			last_updated = NOW()
	`

	batch := &pgx.Batch{}
	for _, p := range points {
		deviceType := p.DeviceType
		if deviceType == "" {
			deviceType = "desktop"
		}
		batch.Queue(query, websiteID, p.URL, p.Type, deviceType, p.XPercent, p.YPercent, p.Selector)
	}

	br := r.db.SendBatch(ctx, batch)
	defer br.Close()

	for range points {
		if _, err := br.Exec(); err != nil {
			return err
		}
	}
	return nil
}

func (r *heatmapRepository) GetHeatmapData(ctx context.Context, websiteID string, url string, heatmapType string, from, to time.Time) ([]models.HeatmapPoint, error) {
	query := `
		SELECT x_percent, y_percent, intensity, target_selector 
		FROM heatmap_points 
		WHERE website_id::text = $1 AND page_path = $2 AND event_type = $3 AND last_updated BETWEEN $4 AND $5
	`
	rows, err := r.db.Query(ctx, query, websiteID, url, heatmapType, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var points []models.HeatmapPoint
	for rows.Next() {
		var p models.HeatmapPoint
		if err := rows.Scan(&p.XPercent, &p.YPercent, &p.Intensity, &p.Selector); err != nil {
			return nil, err
		}
		points = append(points, p)
	}

	return points, nil
}

func (r *heatmapRepository) GetHeatmapPages(ctx context.Context, websiteID string) ([]models.HeatmapPageStat, error) {
	// Aggregate directly from heatmap_points:
	// - clicks: sum of intensity for 'click' events
	// - views: sum of intensity for 'pageview' events (recorded by the tracker on each page load)
	query := `
		SELECT
			page_path,
			SUM(CASE WHEN event_type = 'click' THEN intensity ELSE 0 END) AS total_clicks,
			SUM(CASE WHEN event_type = 'pageview' THEN intensity ELSE 0 END) AS total_views
		FROM heatmap_points
		WHERE website_id::text = $1
		GROUP BY page_path
		ORDER BY total_clicks DESC
	`
	rows, err := r.db.Query(ctx, query, websiteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var pages []models.HeatmapPageStat
	for rows.Next() {
		var p models.HeatmapPageStat
		if err := rows.Scan(&p.URL, &p.Clicks, &p.Views); err != nil {
			return nil, err
		}
		p.Active = true
		pages = append(pages, p)
	}

	return pages, nil
}

func (r *heatmapRepository) CountHeatmapPages(ctx context.Context, websiteID string) (int, error) {
	query := `SELECT COUNT(DISTINCT page_path) FROM heatmap_points WHERE website_id::text = $1`
	var count int
	err := r.db.QueryRow(ctx, query, websiteID).Scan(&count)
	return count, err
}

func (r *heatmapRepository) HeatmapExistsForURL(ctx context.Context, websiteID string, url string) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM heatmap_points WHERE website_id::text = $1 AND page_path = $2 LIMIT 1)`
	var exists bool
	err := r.db.QueryRow(ctx, query, websiteID, url).Scan(&exists)
	return exists, err
}

func (r *heatmapRepository) GetTrackedURLs(ctx context.Context, websiteID string) ([]string, error) {
	query := `SELECT DISTINCT page_path FROM heatmap_points WHERE website_id::text = $1`
	rows, err := r.db.Query(ctx, query, websiteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var urls []string
	for rows.Next() {
		var url string
		if err := rows.Scan(&url); err != nil {
			return nil, err
		}
		urls = append(urls, url)
	}

	return urls, nil
}

func (r *heatmapRepository) DeleteHeatmapPage(ctx context.Context, websiteID string, url string) error {
	query := `DELETE FROM heatmap_points WHERE website_id::text = $1 AND page_path = $2`
	_, err := r.db.Exec(ctx, query, websiteID, url)
	return err
}
