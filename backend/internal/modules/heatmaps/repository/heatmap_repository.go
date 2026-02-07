package repository

import (
	"analytics-app/internal/modules/heatmaps/models"
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type HeatmapRepository interface {
	RecordHeatmap(ctx context.Context, websiteID string, points []models.HeatmapPoint) error
	GetHeatmapData(ctx context.Context, websiteID string, url string, heatmapType string, from, to time.Time) ([]models.HeatmapPoint, error)
	GetHeatmapPages(ctx context.Context, websiteID string) ([]string, error)
	CountHeatmapPages(ctx context.Context, websiteID string) (int, error)
	HeatmapExistsForURL(ctx context.Context, websiteID string, url string) (bool, error)
}

type heatmapRepository struct {
	db *pgxpool.Pool
}

func NewHeatmapRepository(db *pgxpool.Pool) HeatmapRepository {
	return &heatmapRepository{db: db}
}

func (r *heatmapRepository) RecordHeatmap(ctx context.Context, websiteID string, points []models.HeatmapPoint) error {
	for _, p := range points {
		query := `
			INSERT INTO heatmap_points (website_id, url, x_percent, y_percent, type, intensity, last_seen)
			VALUES ($1, $2, $3, $4, $5, 1, NOW())
			ON CONFLICT (website_id, url, x_percent, y_percent, type)
			DO UPDATE SET 
				intensity = heatmap_points.intensity + 1,
				last_seen = NOW()
		`
		_, err := r.db.Exec(ctx, query, websiteID, p.URL, p.XPercent, p.YPercent, p.Type)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *heatmapRepository) GetHeatmapData(ctx context.Context, websiteID string, url string, heatmapType string, from, to time.Time) ([]models.HeatmapPoint, error) {
	query := `
		SELECT x_percent, y_percent, intensity 
		FROM heatmap_points 
		WHERE website_id = $1 AND url = $2 AND type = $3 AND last_seen BETWEEN $4 AND $5
	`
	rows, err := r.db.Query(ctx, query, websiteID, url, heatmapType, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var points []models.HeatmapPoint
	for rows.Next() {
		var p models.HeatmapPoint
		if err := rows.Scan(&p.XPercent, &p.YPercent, &p.Intensity); err != nil {
			return nil, err
		}
		points = append(points, p)
	}

	return points, nil
}

func (r *heatmapRepository) GetHeatmapPages(ctx context.Context, websiteID string) ([]string, error) {
	query := `
		SELECT DISTINCT url 
		FROM heatmap_points 
		WHERE website_id = $1 
		ORDER BY url ASC
	`
	rows, err := r.db.Query(ctx, query, websiteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var pages []string
	for rows.Next() {
		var page string
		if err := rows.Scan(&page); err != nil {
			return nil, err
		}
		pages = append(pages, page)
	}

	return pages, nil
}

func (r *heatmapRepository) CountHeatmapPages(ctx context.Context, websiteID string) (int, error) {
	query := `SELECT COUNT(DISTINCT url) FROM heatmap_points WHERE website_id = $1`
	var count int
	err := r.db.QueryRow(ctx, query, websiteID).Scan(&count)
	return count, err
}

func (r *heatmapRepository) HeatmapExistsForURL(ctx context.Context, websiteID string, url string) (bool, error) {
	query := `SELECT EXISTS(SELECT 1 FROM heatmap_points WHERE website_id = $1 AND url = $2 LIMIT 1)`
	var exists bool
	err := r.db.QueryRow(ctx, query, websiteID, url).Scan(&exists)
	return exists, err
}
