package repository

import (
	"analytics-app/internal/modules/analytics/models"
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type GoalAnalytics struct {
	db *pgxpool.Pool
}

func NewGoalAnalytics(db *pgxpool.Pool) *GoalAnalytics {
	return &GoalAnalytics{db: db}
}

// GetGoalStats returns conversion statistics for defined goals
func (ga *GoalAnalytics) GetGoalStats(ctx context.Context, websiteID string, days int) ([]models.EventItem, error) {
	// 1. Fetch defined goals for this website
	// Note: We're querying the goals table which is usually in the website/user schema
	// but since we're in the analytics service, we'll join it if it exists or
	// use a subquery if the DB is shared.

	query := `
		WITH website_goals AS (
			SELECT name, type, identifier
			FROM goals
			WHERE website_id = $1
		),
		custom_metrics AS (
			-- Count matches for Event goals
			SELECT 
				g.name as event_type,
				SUM(a.count) as count,
				a.sample_properties
			FROM website_goals g
			JOIN custom_events_aggregated a ON a.website_id = $1 AND a.event_type = g.identifier
			WHERE g.type = 'event'
			AND a.last_seen >= NOW() - INTERVAL '1 day' * $2
			GROUP BY g.name, a.sample_properties

			UNION ALL

			-- Count matches for Pageview goals
			SELECT 
				g.name as event_type,
				COUNT(*) as count,
				jsonb_build_object('page', e.page) as sample_properties
			FROM website_goals g
			JOIN events e ON e.website_id = $1 AND e.page = g.identifier
			WHERE g.type = 'pageview'
			AND e.event_type = 'pageview'
			AND e.timestamp >= NOW() - INTERVAL '1 day' * $2
			GROUP BY g.name, e.page
		)
		SELECT event_type, SUM(count) as count, sample_properties
		FROM custom_metrics
		GROUP BY event_type, sample_properties
		ORDER BY count DESC
	`

	rows, err := ga.db.Query(ctx, query, websiteID, days)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch goal stats: %w", err)
	}
	defer rows.Close()

	var stats []models.EventItem
	for rows.Next() {
		var item models.EventItem
		err := rows.Scan(&item.EventType, &item.Count, &item.SampleProperties)
		if err != nil {
			return nil, err
		}
		stats = append(stats, item)
	}

	return stats, nil
}
