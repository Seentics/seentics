package repository

import (
	"context"

	"github.com/Seentics/seentics/internal/modules/analytics/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PostgresAnalyticsRepository provides PostgreSQL-backed analytics queries.
// Used for goal stats (event goals reference custom_events_aggregated in PG).
// All other analytics are served by ClickHouse.
type PostgresAnalyticsRepository struct {
	goals *GoalAnalytics
}

// NewPostgresAnalyticsRepository creates a PG analytics repository for goal stats.
func NewPostgresAnalyticsRepository(db *pgxpool.Pool) *PostgresAnalyticsRepository {
	return &PostgresAnalyticsRepository{
		goals: NewGoalAnalytics(db),
	}
}

func (r *PostgresAnalyticsRepository) GetGoalStats(ctx context.Context, websiteID string, days int) ([]models.GoalStatItem, error) {
	return r.goals.GetGoalStats(ctx, websiteID, days)
}
