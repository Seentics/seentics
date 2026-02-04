package repository

import (
	"analytics-app/internal/modules/analytics/models"
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type TimeSeriesAnalytics struct {
	db *pgxpool.Pool
}

func NewTimeSeriesAnalytics(db *pgxpool.Pool) *TimeSeriesAnalytics {
	return &TimeSeriesAnalytics{db: db}
}

// GetDailyStats returns daily statistics for a website
func (ts *TimeSeriesAnalytics) GetDailyStats(ctx context.Context, websiteID string, days int, timezone string) ([]models.DailyStat, error) {
	if timezone == "" {
		timezone = "UTC"
	}

	query := `
		SELECT 
			DATE(timestamp AT TIME ZONE $3)::text as date,
			COUNT(*) as views,
			COUNT(DISTINCT visitor_id) as unique_visitors
		FROM events
		WHERE website_id = $1 
		AND timestamp >= NOW() - INTERVAL '1 day' * $2
		AND event_type = 'pageview'
		GROUP BY date
		ORDER BY date DESC
		LIMIT $2`

	rows, err := ts.db.Query(ctx, query, websiteID, days, timezone)
	if err != nil {
		return nil, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	var stats []models.DailyStat
	for rows.Next() {
		var stat models.DailyStat
		var uniqueVisitors int
		err := rows.Scan(&stat.Date, &stat.Views, &uniqueVisitors)
		if err != nil {
			return nil, fmt.Errorf("scan failed: %w", err)
		}
		stat.Unique = uniqueVisitors
		stats = append(stats, stat)
	}

	// Check for any iteration errors
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration failed: %w", err)
	}

	return stats, nil
}

// GetHourlyStats returns hourly statistics for a website
func (ts *TimeSeriesAnalytics) GetHourlyStats(ctx context.Context, websiteID string, days int, timezone string) ([]models.HourlyStat, error) {
	if timezone == "" {
		timezone = "UTC"
	}

	query := `
		SELECT 
			EXTRACT(HOUR FROM timestamp AT TIME ZONE $3)::integer as hour,
			DATE_TRUNC('hour', timestamp AT TIME ZONE $3) as local_timestamp,
			COUNT(*) as views,
			COUNT(DISTINCT visitor_id) as unique_visitors
		FROM events
		WHERE website_id = $1 
		AND timestamp >= NOW() - INTERVAL '1 day' * $2
		AND event_type = 'pageview'
		GROUP BY local_timestamp, hour
		ORDER BY local_timestamp ASC
		LIMIT LEAST($2 * 24, 24*30)`

	rows, err := ts.db.Query(ctx, query, websiteID, days, timezone)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// Load timezone - we keep it for validation but use SQL for conversion
	_, err = time.LoadLocation(timezone)
	if err != nil {
		timezone = "UTC"
	}

	var stats []models.HourlyStat
	for rows.Next() {
		var stat models.HourlyStat
		var timestamp time.Time
		var uniqueVisitors int
		err := rows.Scan(&stat.Hour, &timestamp, &stat.Views, &uniqueVisitors)
		if err != nil {
			continue
		}

		stat.Timestamp = timestamp
		stat.Unique = uniqueVisitors
		stat.Hour = fmt.Sprintf("%d", stat.Hour) // This is already the local hour from SQL
		stat.HourLabel = timestamp.Format("15:04")
		stats = append(stats, stat)
	}

	return stats, nil
}
