package repository

import (
	"analytics-app/internal/modules/analytics/models"
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type TopCountriesAnalytics struct {
	db *pgxpool.Pool
}

func NewTopCountriesAnalytics(db *pgxpool.Pool) *TopCountriesAnalytics {
	return &TopCountriesAnalytics{db: db}
}

// GetTopCountries returns the top countries for a website with analytics
func (tc *TopCountriesAnalytics) GetTopCountries(ctx context.Context, websiteID string, days int, timezone string, limit int) ([]models.CountryStat, error) {
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
			COALESCE(NULLIF(e.country, ''), 'Unknown') as country,
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
		GROUP BY e.country
		ORDER BY unique_visitors DESC
		LIMIT $4`, tzStartSQL, tzStartSQL)

	rows, err := tc.db.Query(ctx, query, websiteID, days, timezone, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var countries []models.CountryStat
	for rows.Next() {
		var country models.CountryStat
		var bounceRate *float64
		var uniqueVisitors int

		err := rows.Scan(&country.Country, &country.Views, &uniqueVisitors, &bounceRate)
		if err != nil {
			continue
		}

		country.Unique = uniqueVisitors
		country.Visitors = uniqueVisitors

		if bounceRate != nil && *bounceRate > 100.0 {
			*bounceRate = 100.0
		}

		country.BounceRate = bounceRate
		countries = append(countries, country)
	}

	return countries, nil
}
