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

// GetGoalStats returns all configured goals for the site with completion counts.
// Event goals use custom_events_aggregated (PostgreSQL). Pageview / other types
// get completions from ClickHouse in the analytics repository wrapper.
func (ga *GoalAnalytics) GetGoalStats(ctx context.Context, websiteID string, days int) ([]models.GoalStatItem, error) {
	query := `
		WITH target_site AS (
			SELECT id AS website_uuid, site_id
			FROM websites
			WHERE id::text = $1 OR site_id = $1
			LIMIT 1
		),
		website_goals AS (
			SELECT g.id, g.name, g.type, g.identifier, ts.site_id
			FROM goals g
			JOIN target_site ts ON g.website_id = ts.website_uuid
		)
		SELECT
			wg.id::text,
			wg.name,
			wg.type,
			wg.identifier,
			CASE
				WHEN wg.type = 'event' THEN COALESCE(SUM(a.count), 0)::int
				ELSE 0
			END AS completions
		FROM website_goals wg
		LEFT JOIN custom_events_aggregated a
			ON wg.type = 'event'
			AND (a.website_id = wg.site_id OR a.website_id = $1)
			AND a.event_type = wg.identifier
			AND a.last_seen >= NOW() - ($2::bigint * INTERVAL '1 day')
		GROUP BY wg.id, wg.name, wg.type, wg.identifier, wg.site_id
		ORDER BY completions DESC, wg.name ASC
	`

	rows, err := ga.db.Query(ctx, query, websiteID, days)
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
