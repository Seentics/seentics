package repository

import (
	"context"
	"fmt"

	"github.com/Seentics/seentics/internal/modules/analytics/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

type GoalAnalytics struct {
	db *pgxpool.Pool
}

func NewGoalAnalytics(db *pgxpool.Pool) *GoalAnalytics {
	return &GoalAnalytics{db: db}
}

// GetGoalStats returns configured goals for the site. Completion counts and
// conversion metrics are filled from ClickHouse in ClickHouseAnalyticsRepository.
func (ga *GoalAnalytics) GetGoalStats(ctx context.Context, websiteID string, days int) ([]models.GoalStatItem, error) {
	query := `
		WITH target_site AS (
			SELECT id AS website_uuid, site_id
			FROM websites
			WHERE id::text = $1 OR site_id = $1
			LIMIT 1
		),
		website_goals AS (
			SELECT g.id, g.name, g.type, g.identifier
			FROM goals g
			JOIN target_site ts ON g.website_id = ts.website_uuid
		)
		SELECT
			wg.id::text,
			wg.name,
			wg.type,
			wg.identifier,
			0::int AS completions
		FROM website_goals wg
		ORDER BY wg.name ASC
	`

	rows, err := ga.db.Query(ctx, query, websiteID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch goal stats: %w", err)
	}
	defer rows.Close()

	var stats []models.GoalStatItem
	for rows.Next() {
		var item models.GoalStatItem
		if err := rows.Scan(&item.ID, &item.Name, &item.GoalType, &item.Target, &item.Completions); err != nil {
			return nil, err
		}
		item.ConversionRate = 0
		stats = append(stats, item)
	}

	return stats, nil
}
