package repository

import (
	"analytics-app/internal/modules/analytics/models"
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type TopDevicesAnalytics struct {
	db *pgxpool.Pool
}

func NewTopDevicesAnalytics(db *pgxpool.Pool) *TopDevicesAnalytics {
	return &TopDevicesAnalytics{db: db}
}

// GetTopDevices returns the top devices for a website with analytics
func (td *TopDevicesAnalytics) GetTopDevices(ctx context.Context, websiteID string, days int, timezone string, limit int) ([]models.DeviceStat, error) {
	timezone = validateTimezone(timezone)

	query := fmt.Sprintf(`
		WITH session_stats AS (
			SELECT
				session_id,
				COUNT(*) as page_count
			FROM events
			WHERE website_id = $1
			AND timestamp >= %s
			AND event_type = 'pageview'
			GROUP BY session_id
		)
		SELECT
			COALESCE(e.device, 'unknown') as device,
			COUNT(*) as views,
			COUNT(DISTINCT e.visitor_id) as unique_visitors,
			COALESCE(
				(COUNT(*) FILTER (WHERE s.page_count = 1) * 100.0) /
				NULLIF(COUNT(DISTINCT e.session_id), 0), 0
			) as bounce_rate
		FROM events e
		LEFT JOIN session_stats s ON e.session_id = s.session_id
		WHERE e.website_id = $1
		AND e.timestamp >= %s
		AND e.event_type = 'pageview'
		GROUP BY e.device
		ORDER BY unique_visitors DESC
		LIMIT $4`, tzStartSQL, tzStartSQL)

	rows, err := td.db.Query(ctx, query, websiteID, days, timezone, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var devices []models.DeviceStat
	for rows.Next() {
		var device models.DeviceStat
		var bounceRate *float64
		var uniqueVisitors int

		err := rows.Scan(&device.Device, &device.Views, &uniqueVisitors, &bounceRate)
		if err != nil {
			continue
		}

		device.Unique = uniqueVisitors
		device.Visitors = uniqueVisitors

		if bounceRate != nil && *bounceRate > 100.0 {
			*bounceRate = 100.0
		}

		device.BounceRate = bounceRate
		devices = append(devices, device)
	}

	return devices, nil
}
