package repository

import (
	"analytics-app/models"
	"context"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TopBrowsersAnalytics struct {
	db *pgxpool.Pool
}

func NewTopBrowsersAnalytics(db *pgxpool.Pool) *TopBrowsersAnalytics {
	return &TopBrowsersAnalytics{db: db}
}

// GetTopBrowsers returns the top browsers for a website with analytics
func (tb *TopBrowsersAnalytics) GetTopBrowsers(ctx context.Context, websiteID string, days int, limit int) ([]models.BrowserStat, error) {
	query := `
		WITH session_stats AS (
			SELECT 
				session_id,
				COUNT(*) as page_count
			FROM events
			WHERE website_id = $1 
			AND timestamp >= NOW() - INTERVAL '1 day' * $2
			AND event_type = 'pageview'
			GROUP BY session_id
		)
		SELECT 
			COALESCE(e.browser, 'unknown') as browser,
			COUNT(*) as views,
			COUNT(DISTINCT e.visitor_id) as unique_visitors,
			COALESCE(
				(COUNT(*) FILTER (WHERE s.page_count = 1) * 100.0) / 
				NULLIF(COUNT(DISTINCT e.session_id), 0), 0
			) as bounce_rate
		FROM events e
		LEFT JOIN session_stats s ON e.session_id = s.session_id
		WHERE e.website_id = $1 
		AND e.timestamp >= NOW() - INTERVAL '1 day' * $2
		AND e.event_type = 'pageview'
		GROUP BY e.browser
		ORDER BY unique_visitors DESC
		LIMIT $3`

	rows, err := tb.db.Query(ctx, query, websiteID, days, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var browsers []models.BrowserStat
	for rows.Next() {
		var browser models.BrowserStat
		var bounceRate *float64
		var uniqueVisitors int

		err := rows.Scan(&browser.Browser, &browser.Views, &uniqueVisitors, &bounceRate)
		if err != nil {
			continue
		}

		// Set both Unique (deprecated) and Visitors fields from the scanned value
		browser.Unique = uniqueVisitors
		browser.Visitors = uniqueVisitors

		// Cap bounce rate at 100%
		if bounceRate != nil && *bounceRate > 100.0 {
			*bounceRate = 100.0
		}

		browser.BounceRate = bounceRate
		browsers = append(browsers, browser)
	}

	return browsers, nil
}
