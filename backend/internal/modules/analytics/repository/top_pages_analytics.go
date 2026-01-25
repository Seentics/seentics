package repository

import (
	"analytics-app/models"
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

type TopPagesAnalytics struct {
	db *pgxpool.Pool
}

func NewTopPagesAnalytics(db *pgxpool.Pool) *TopPagesAnalytics {
	return &TopPagesAnalytics{db: db}
}

// normalizePage normalizes page paths to eliminate duplicates
func (tp *TopPagesAnalytics) normalizePage(page string) string {
	if page == "" {
		return "/"
	}

	// Remove trailing slash and normalize
	normalized := strings.TrimRight(strings.TrimSpace(page), "/")
	if normalized == "" {
		return "/"
	}

	// Extract base path without query parameters
	if idx := strings.Index(normalized, "?"); idx != -1 {
		normalized = normalized[:idx]
	}

	// If it's a full URL, extract just the path
	if strings.HasPrefix(normalized, "http://") || strings.HasPrefix(normalized, "https://") {
		// Find the third slash (after protocol and domain)
		parts := strings.Split(normalized, "/")
		if len(parts) >= 4 {
			// Reconstruct path starting from the third slash
			path := "/" + strings.Join(parts[3:], "/")
			normalized = path
		} else {
			normalized = "/"
		}
	}

	// Ensure it starts with /
	if !strings.HasPrefix(normalized, "/") {
		normalized = "/" + normalized
	}

	// Remove trailing slash again after processing
	normalized = strings.TrimRight(normalized, "/")
	if normalized == "" {
		return "/"
	}

	return normalized
}

// GetTopPages returns the top pages for a website with analytics
func (tp *TopPagesAnalytics) GetTopPages(ctx context.Context, websiteID string, days int, limit int) ([]models.PageStat, error) {
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
			e.page as page,
			COUNT(*) as views,
			COUNT(DISTINCT e.visitor_id) as unique_visitors,
			COALESCE(
				(COUNT(*) FILTER (WHERE s.page_count = 1) * 100.0) / 
				NULLIF(COUNT(DISTINCT e.session_id), 0), 0
			) as bounce_rate,
			COALESCE(AVG(e.time_on_page), 0) as avg_time,
			COALESCE(
				(COUNT(*) FILTER (WHERE e.page = (
					SELECT e2.page 
					FROM events e2 
					WHERE e2.session_id = e.session_id 
					AND e2.event_type = 'pageview' 
					ORDER BY e2.timestamp ASC 
					LIMIT 1
				)) * 100.0) / NULLIF(COUNT(DISTINCT e.session_id), 0), 0
			) as entry_rate
		FROM events e
		LEFT JOIN session_stats s ON e.session_id = s.session_id
		WHERE e.website_id = $1 
		AND e.timestamp >= NOW() - INTERVAL '1 day' * $2
		AND e.event_type = 'pageview'
		AND e.page IS NOT NULL
		GROUP BY e.page
		ORDER BY views DESC
		LIMIT $3`

	rows, err := tp.db.Query(ctx, query, websiteID, days, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var pages []models.PageStat
	pageMap := make(map[string]*models.PageStat)

	for rows.Next() {
		var page models.PageStat
		var bounceRate, entryRate *float64
		var avgTime *float64
		var uniqueVisitors int
		var rawPage string

		err := rows.Scan(&rawPage, &page.Views, &uniqueVisitors, &bounceRate, &avgTime, &entryRate)
		if err != nil {
			continue
		}

		// Normalize the page path
		page.Page = tp.normalizePage(rawPage)

		// Set the Unique field from the scanned value
		page.Unique = uniqueVisitors

		// Cap bounce rate at 100%
		if bounceRate != nil && *bounceRate > 100.0 {
			*bounceRate = 100.0
		}

		page.BounceRate = bounceRate
		page.AvgTime = avgTime
		page.EntryRate = entryRate

		// Deduplicate by normalized page path
		if existing, exists := pageMap[page.Page]; exists {
			// Merge data if duplicate found
			existing.Views += page.Views
			existing.Unique += page.Unique
			// Recalculate averages
			if existing.AvgTime != nil && page.AvgTime != nil {
				*existing.AvgTime = (*existing.AvgTime + *page.AvgTime) / 2
			}
			if existing.BounceRate != nil && page.BounceRate != nil {
				*existing.BounceRate = (*existing.BounceRate + *page.BounceRate) / 2
			}
			if existing.EntryRate != nil && page.EntryRate != nil {
				*existing.EntryRate = (*existing.EntryRate + *page.EntryRate) / 2
			}
		} else {
			// Create a new copy to avoid pointer issues
			newPage := page
			pageMap[page.Page] = &newPage
		}
	}

	// Convert map back to slice
	for _, page := range pageMap {
		pages = append(pages, *page)
	}

	// Debug: Print what we're returning
	fmt.Printf("DEBUG: Returning %d pages after deduplication\n", len(pages))
	for _, page := range pages {
		fmt.Printf("DEBUG: %s - Views: %d, Unique: %d\n", page.Page, page.Views, page.Unique)
	}

	return pages, nil
}

// GetPageUTMBreakdown returns UTM parameter breakdown for a specific page
func (tp *TopPagesAnalytics) GetPageUTMBreakdown(ctx context.Context, websiteID, pagePath string, days int) (map[string]interface{}, error) {
	query := `
		SELECT 
			COALESCE(utm_source, 'direct') as source,
			COALESCE(utm_medium, 'none') as medium,
			COALESCE(utm_campaign, 'none') as campaign,
			COUNT(*) as visits,
			COUNT(DISTINCT visitor_id) as unique_visitors
		FROM events
		WHERE website_id = $1 
		AND (
			CASE 
				WHEN $2 LIKE '%?%' THEN 
					page LIKE $2 || '%'
				ELSE 
					page = $2 OR page LIKE $2 || '?%'
				END
		)
		AND timestamp >= NOW() - INTERVAL '1 day' * $3
		AND event_type = 'pageview'
		GROUP BY utm_source, utm_medium, utm_campaign
		ORDER BY visits DESC`

	rows, err := tp.db.Query(ctx, query, websiteID, pagePath, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	breakdown := map[string]interface{}{
		"sources":   make([]map[string]interface{}, 0),
		"mediums":   make([]map[string]interface{}, 0),
		"campaigns": make([]map[string]interface{}, 0),
	}

	sourceMap := make(map[string]map[string]interface{})
	mediumMap := make(map[string]map[string]interface{})
	campaignMap := make(map[string]map[string]interface{})

	for rows.Next() {
		var source, medium, campaign string
		var visits, uniqueVisitors int
		err := rows.Scan(&source, &medium, &campaign, &visits, &uniqueVisitors)
		if err != nil {
			continue
		}

		// Aggregate sources
		if sourceData, exists := sourceMap[source]; exists {
			sourceData["visits"] = sourceData["visits"].(int) + visits
			sourceData["unique_visitors"] = sourceData["unique_visitors"].(int) + uniqueVisitors
		} else {
			sourceMap[source] = map[string]interface{}{
				"source":          source,
				"visits":          visits,
				"unique_visitors": uniqueVisitors,
			}
		}

		// Aggregate mediums
		if mediumData, exists := mediumMap[medium]; exists {
			mediumData["visits"] = mediumData["visits"].(int) + visits
			mediumData["unique_visitors"] = mediumData["unique_visitors"].(int) + uniqueVisitors
		} else {
			mediumMap[medium] = map[string]interface{}{
				"medium":          medium,
				"visits":          visits,
				"unique_visitors": uniqueVisitors,
			}
		}

		// Aggregate campaigns
		if campaignData, exists := campaignMap[campaign]; exists {
			campaignData["visits"] = campaignData["visits"].(int) + visits
			campaignData["unique_visitors"] = campaignData["unique_visitors"].(int) + uniqueVisitors
		} else {
			campaignMap[campaign] = map[string]interface{}{
				"campaign":        campaign,
				"visits":          visits,
				"unique_visitors": uniqueVisitors,
			}
		}
	}

	// Convert maps to arrays
	for _, data := range sourceMap {
		breakdown["sources"] = append(breakdown["sources"].([]map[string]interface{}), data)
	}
	for _, data := range mediumMap {
		breakdown["mediums"] = append(breakdown["mediums"].([]map[string]interface{}), data)
	}
	for _, data := range campaignMap {
		breakdown["campaigns"] = append(breakdown["campaigns"].([]map[string]interface{}), data)
	}

	return breakdown, nil
}

// GetTopPagesWithTimeBucket returns top pages with time-bucket aggregation for better performance
func (tp *TopPagesAnalytics) GetTopPagesWithTimeBucket(ctx context.Context, websiteID string, days int, limit int) ([]models.PageStat, error) {
	query := `
		WITH session_stats AS (
			SELECT 
				session_id,
				COUNT(*) as page_count
			FROM events
			WHERE website_id = $1 
			AND timestamp >= time_bucket('1 day', NOW()) - INTERVAL '1 day' * $2
			AND event_type = 'pageview'
			GROUP BY session_id
		)
		SELECT 
			e.page as page,
			COUNT(*) as views,
			COUNT(DISTINCT e.visitor_id) as unique_visitors,
			COALESCE(
				(COUNT(*) FILTER (WHERE s.page_count = 1) * 100.0) / 
				NULLIF(COUNT(DISTINCT e.session_id), 0), 0
			) as bounce_rate,
			COALESCE(AVG(e.time_on_page), 0) as avg_time,
			COALESCE(
				(COUNT(*) FILTER (WHERE e.page = (
					SELECT e2.page 
					FROM events e2 
					WHERE e2.session_id = e.session_id 
					AND e2.event_type = 'pageview' 
					ORDER BY e2.timestamp ASC 
					LIMIT 1
				)) * 100.0) / NULLIF(COUNT(DISTINCT e.session_id), 0), 0
			) as entry_rate
		FROM events e
		LEFT JOIN session_stats s ON e.session_id = s.session_id
		WHERE e.website_id = $1 
		AND e.timestamp >= time_bucket('1 day', NOW()) - INTERVAL '1 day' * $2
		AND e.event_type = 'pageview'
		AND e.page IS NOT NULL
		GROUP BY e.page
		ORDER BY views DESC
		LIMIT $3`

	rows, err := tp.db.Query(ctx, query, websiteID, days, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var pages []models.PageStat
	pageMap := make(map[string]*models.PageStat)

	for rows.Next() {
		var page models.PageStat
		var bounceRate, exitRate *float64
		var avgTime *float64
		var uniqueVisitors int
		var rawPage string

		err := rows.Scan(&rawPage, &page.Views, &uniqueVisitors, &bounceRate, &avgTime, &exitRate)
		if err != nil {
			continue
		}

		// Normalize the page path
		page.Page = tp.normalizePage(rawPage)

		// Set the Unique field from the scanned value
		page.Unique = uniqueVisitors

		// Cap bounce rate at 100%
		if bounceRate != nil && *bounceRate > 100.0 {
			*bounceRate = 100.0
		}

		page.BounceRate = bounceRate
		page.AvgTime = avgTime
		page.ExitRate = exitRate

		// Deduplicate by normalized page path
		if existing, exists := pageMap[page.Page]; exists {
			// Merge data if duplicate found
			existing.Views += page.Views
			existing.Unique += page.Unique
			// Recalculate averages
			if existing.AvgTime != nil && page.AvgTime != nil {
				*existing.AvgTime = (*existing.AvgTime + *page.AvgTime) / 2
			}
			if existing.BounceRate != nil && page.BounceRate != nil {
				*existing.BounceRate = (*existing.BounceRate + *page.BounceRate) / 2
			}
			if existing.ExitRate != nil && page.ExitRate != nil {
				*existing.ExitRate = (*existing.ExitRate + *page.ExitRate) / 2
			}
		} else {
			// Create a new copy to avoid pointer issues
			newPage := page
			pageMap[page.Page] = &newPage
		}
	}

	// Convert map back to slice
	for _, page := range pageMap {
		pages = append(pages, *page)
	}

	return pages, nil
}
