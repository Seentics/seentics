package repository

import (
	"context"
	"fmt"
)

// GetUTMAnalytics returns UTM campaign performance data
func (da *DashboardAnalytics) GetUTMAnalytics(ctx context.Context, websiteID string, days int) (map[string]interface{}, error) {
	// Get UTM sources - group NULL and empty values as 'direct'
	sourcesQuery := fmt.Sprintf(`
		SELECT 
			CASE 
				WHEN utm_source IS NULL OR utm_source = '' THEN 'direct'
				ELSE utm_source
			END as source,
			COUNT(DISTINCT visitor_id) as unique_visitors,
			COUNT(*) as total_pageviews,
			COUNT(DISTINCT session_id) as sessions
		FROM events
		WHERE website_id = $1 
		AND timestamp >= NOW() - INTERVAL '%d days'
		AND event_type = 'pageview'
		GROUP BY CASE 
			WHEN utm_source IS NULL OR utm_source = '' THEN 'direct'
			ELSE utm_source
		END
		ORDER BY unique_visitors DESC
		LIMIT 10`, days)

	rows, err := da.db.Query(ctx, sourcesQuery, websiteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sources := make([]map[string]interface{}, 0)
	for rows.Next() {
		var source string
		var uniqueVisitors, totalPageviews, sessions int
		err := rows.Scan(&source, &uniqueVisitors, &totalPageviews, &sessions)
		if err != nil {
			continue
		}
		sources = append(sources, map[string]interface{}{
			"source":          source,
			"unique_visitors": uniqueVisitors,
			"visits":          totalPageviews, // Use 'visits' to match frontend expectations
			"pageviews":       totalPageviews, // Keep both for compatibility
			"sessions":        sessions,
		})
	}

	// Get UTM mediums
	mediumsQuery := fmt.Sprintf(`
		SELECT 
			CASE 
				WHEN utm_medium IS NULL OR utm_medium = '' THEN 'none'
				ELSE utm_medium
			END as medium,
			COUNT(DISTINCT visitor_id) as unique_visitors,
			COUNT(*) as total_pageviews
		FROM events
		WHERE website_id = $1 
		AND timestamp >= NOW() - INTERVAL '%d days'
		AND event_type = 'pageview'
		GROUP BY CASE 
			WHEN utm_medium IS NULL OR utm_medium = '' THEN 'none'
			ELSE utm_medium
		END
		ORDER BY unique_visitors DESC
		LIMIT 10`, days)

	rows, err = da.db.Query(ctx, mediumsQuery, websiteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	mediums := make([]map[string]interface{}, 0)
	for rows.Next() {
		var medium string
		var uniqueVisitors, totalPageviews int
		err := rows.Scan(&medium, &uniqueVisitors, &totalPageviews)
		if err != nil {
			continue
		}
		mediums = append(mediums, map[string]interface{}{
			"medium":          medium,
			"unique_visitors": uniqueVisitors,
			"visits":          totalPageviews, // Use 'visits' to match frontend expectations
			"pageviews":       totalPageviews, // Keep both for compatibility
		})
	}

	// Get UTM campaigns - only show campaigns that actually exist
	campaignsQuery := fmt.Sprintf(`
		SELECT 
			utm_campaign as campaign,
			COUNT(DISTINCT visitor_id) as unique_visitors,
			COUNT(*) as total_pageviews
		FROM events
		WHERE website_id = $1 
		AND timestamp >= NOW() - INTERVAL '%d days'
		AND event_type = 'pageview'
		AND utm_campaign IS NOT NULL 
		AND utm_campaign != ''
		GROUP BY utm_campaign
		ORDER BY unique_visitors DESC
		LIMIT 10`, days)

	rows, err = da.db.Query(ctx, campaignsQuery, websiteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	campaigns := make([]map[string]interface{}, 0)
	for rows.Next() {
		var campaign string
		var uniqueVisitors, totalPageviews int
		err := rows.Scan(&campaign, &uniqueVisitors, &totalPageviews)
		if err != nil {
			continue
		}
		campaigns = append(campaigns, map[string]interface{}{
			"campaign":        campaign,
			"unique_visitors": uniqueVisitors,
			"visits":          totalPageviews, // Use 'visits' to match frontend expectations
			"pageviews":       totalPageviews, // Keep both for compatibility
		})
	}

	// Get UTM terms - only show terms that actually exist
	termsQuery := fmt.Sprintf(`
		SELECT 
			utm_term as term,
			COUNT(DISTINCT visitor_id) as unique_visitors,
			COUNT(*) as total_pageviews
		FROM events
		WHERE website_id = $1 
		AND timestamp >= NOW() - INTERVAL '%d days'
		AND event_type = 'pageview'
		AND utm_term IS NOT NULL
		AND utm_term != ''
		GROUP BY utm_term
		ORDER BY unique_visitors DESC
		LIMIT 10`, days)

	rows, err = da.db.Query(ctx, termsQuery, websiteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	terms := make([]map[string]interface{}, 0)
	for rows.Next() {
		var term string
		var uniqueVisitors, totalPageviews int
		err := rows.Scan(&term, &uniqueVisitors, &totalPageviews)
		if err != nil {
			continue
		}
		terms = append(terms, map[string]interface{}{
			"term":            term,
			"unique_visitors": uniqueVisitors,
			"visits":          totalPageviews, // Use 'visits' to match frontend expectations
			"pageviews":       totalPageviews, // Keep both for compatibility
		})
	}

	// Get UTM content - only show content that actually exists
	contentQuery := fmt.Sprintf(`
		SELECT 
			utm_content as content,
			COUNT(DISTINCT visitor_id) as unique_visitors,
			COUNT(*) as total_pageviews
		FROM events
		WHERE website_id = $1 
		AND timestamp >= NOW() - INTERVAL '%d days'
		AND event_type = 'pageview'
		AND utm_content IS NOT NULL
		AND utm_content != ''
		GROUP BY utm_content
		ORDER BY unique_visitors DESC
		LIMIT 10`, days)

	rows, err = da.db.Query(ctx, contentQuery, websiteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	content := make([]map[string]interface{}, 0)
	for rows.Next() {
		var contentItem string
		var uniqueVisitors, totalPageviews int
		err := rows.Scan(&contentItem, &uniqueVisitors, &totalPageviews)
		if err != nil {
			continue
		}
		content = append(content, map[string]interface{}{
			"content":         contentItem,
			"unique_visitors": uniqueVisitors,
			"visits":          totalPageviews, // Use 'visits' to match frontend expectations
			"pageviews":       totalPageviews, // Keep both for compatibility
		})
	}

	return map[string]interface{}{
		"sources":   sources,
		"mediums":   mediums,
		"campaigns": campaigns,
		"terms":     terms,
		"content":   content,
	}, nil
}
