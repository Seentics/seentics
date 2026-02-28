package repository

import (
	"context"

	"github.com/Seentics/seentics/internal/modules/analytics/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresAnalyticsRepository provides PostgreSQL-backed analytics queries.
// Only used for goal stats and screen resolutions (metadata stored in PG);
// all other analytics are served by ClickHouse.
type PostgresAnalyticsRepository struct {
	goals          *GoalAnalytics
	topResolutions *TopResolutionsAnalytics
}

// NewPostgresAnalyticsRepository creates a PG analytics repository for goals & resolutions.
func NewPostgresAnalyticsRepository(db *pgxpool.Pool) *PostgresAnalyticsRepository {
	return &PostgresAnalyticsRepository{
		goals:          NewGoalAnalytics(db),
		topResolutions: NewTopResolutionsAnalytics(db),
	}
}

func (r *PostgresAnalyticsRepository) GetGoalStats(ctx context.Context, websiteID string, days int) ([]models.EventItem, error) {
	return r.goals.GetGoalStats(ctx, websiteID, days)
}

func (r *PostgresAnalyticsRepository) GetTopResolutions(ctx context.Context, websiteID string, days int, limit int) ([]models.TopItem, error) {
	return r.topResolutions.GetTopResolutions(ctx, websiteID, days, limit)
}
