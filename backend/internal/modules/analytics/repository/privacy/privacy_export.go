package privacy

import (
	"analytics-app/models"
	"context"
	"encoding/json"
	"fmt"
	"time"
)

// ExportEventsData exports all events data for a specific user
func (r *PrivacyRepository) ExportEventsData(userID string) ([]map[string]interface{}, error) {
	// Get all websites owned by the user
	websiteIDs, err := r.GetUserWebsites(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user websites: %w", err)
	}

	if len(websiteIDs) == 0 {
		return []map[string]interface{}{
			{
				"user_id":     userID,
				"exported_at": time.Now().UTC().Format(time.RFC3339),
				"data":        []models.Event{},
				"message":     "No websites found for user",
			},
		}, nil
	}

	// Query events for all user's websites
	query := `
		SELECT id, website_id, visitor_id, session_id, event_type, page, referrer, 
		       user_agent, ip_address, country, city, browser, device, os,
		       utm_source, utm_medium, utm_campaign, utm_term, utm_content,
		       time_on_page, properties, timestamp, created_at
		FROM events 
		WHERE website_id = ANY($1)
		ORDER BY timestamp DESC
	`

	rows, err := r.db.Query(context.Background(), query, websiteIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to query events: %w", err)
	}
	defer rows.Close()

	var events []models.Event
	for rows.Next() {
		var event models.Event
		var propertiesJSON []byte

		err := rows.Scan(
			&event.ID, &event.WebsiteID, &event.VisitorID, &event.SessionID,
			&event.EventType, &event.Page, &event.Referrer, &event.UserAgent,
			&event.IPAddress, &event.Country, &event.City, &event.Browser,
			&event.Device, &event.OS, &event.UTMSource, &event.UTMMedium,
			&event.UTMCampaign, &event.UTMTerm, &event.UTMContent,
			&event.TimeOnPage, &propertiesJSON, &event.Timestamp, &event.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan event: %w", err)
		}

		// Parse properties JSON
		if len(propertiesJSON) > 0 {
			if err := json.Unmarshal(propertiesJSON, &event.Properties); err != nil {
				return nil, fmt.Errorf("failed to unmarshal properties: %w", err)
			}
		}

		events = append(events, event)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating events: %w", err)
	}

	// Log the export operation
	r.LogPrivacyOperation("export_events", userID, fmt.Sprintf("Exported %d events for %d websites", len(events), len(websiteIDs)))

	return []map[string]interface{}{
		{
			"user_id":      userID,
			"exported_at":  time.Now().UTC().Format(time.RFC3339),
			"website_ids":  websiteIDs,
			"events_count": len(events),
			"data":         events,
		},
	}, nil
}

// ExportAnalyticsData exports all analytics data for a specific user
func (r *PrivacyRepository) ExportAnalyticsData(userID string) ([]map[string]interface{}, error) {
	// Get all websites owned by the user
	websiteIDs, err := r.GetUserWebsites(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user websites: %w", err)
	}

	if len(websiteIDs) == 0 {
		return []map[string]interface{}{
			{
				"user_id":     userID,
				"exported_at": time.Now().UTC().Format(time.RFC3339),
				"data":        map[string]interface{}{},
				"message":     "No websites found for user",
			},
		}, nil
	}

	analyticsData := make(map[string]interface{})

	// Get basic metrics
	metricsQuery := `
		SELECT 
			COUNT(*) as page_views,
			COUNT(DISTINCT visitor_id) as unique_visitors,
			COUNT(DISTINCT session_id) as sessions,
			ROUND(AVG(CASE WHEN time_on_page IS NOT NULL AND time_on_page > 0 THEN time_on_page END)) as avg_time_on_page
		FROM events 
		WHERE website_id = ANY($1)
	`

	var pageViews, uniqueVisitors, sessions int
	var avgTimeOnPage *int
	err = r.db.QueryRow(context.Background(), metricsQuery, websiteIDs).Scan(
		&pageViews, &uniqueVisitors, &sessions, &avgTimeOnPage,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query basic metrics: %w", err)
	}

	analyticsData["page_views"] = pageViews
	analyticsData["unique_visitors"] = uniqueVisitors
	analyticsData["sessions"] = sessions
	if avgTimeOnPage != nil {
		analyticsData["avg_time_on_page"] = *avgTimeOnPage
	}

	// Get top pages
	topPagesQuery := `
		SELECT page, COUNT(*) as views, COUNT(DISTINCT visitor_id) as unique_visitors
		FROM events 
		WHERE website_id = ANY($1) AND page IS NOT NULL
		GROUP BY page 
		ORDER BY views DESC 
		LIMIT 50
	`

	rows, err := r.db.Query(context.Background(), topPagesQuery, websiteIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to query top pages: %w", err)
	}
	defer rows.Close()

	var topPages []map[string]interface{}
	for rows.Next() {
		var page string
		var views, unique int
		if err := rows.Scan(&page, &views, &unique); err != nil {
			return nil, fmt.Errorf("failed to scan top page: %w", err)
		}
		topPages = append(topPages, map[string]interface{}{
			"page":            page,
			"views":           views,
			"unique_visitors": unique,
		})
	}
	analyticsData["top_pages"] = topPages

	// Get top referrers
	topReferrersQuery := `
		SELECT COALESCE(referrer, 'Direct') as referrer, COUNT(*) as views, COUNT(DISTINCT visitor_id) as unique_visitors
		FROM events 
		WHERE website_id = ANY($1)
		GROUP BY COALESCE(referrer, 'Direct')
		ORDER BY views DESC 
		LIMIT 20
	`

	rows, err = r.db.Query(context.Background(), topReferrersQuery, websiteIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to query top referrers: %w", err)
	}
	defer rows.Close()

	var topReferrers []map[string]interface{}
	for rows.Next() {
		var referrer string
		var views, unique int
		if err := rows.Scan(&referrer, &views, &unique); err != nil {
			return nil, fmt.Errorf("failed to scan top referrer: %w", err)
		}
		topReferrers = append(topReferrers, map[string]interface{}{
			"referrer":        referrer,
			"views":           views,
			"unique_visitors": unique,
		})
	}
	analyticsData["top_referrers"] = topReferrers

	// Get countries
	countriesQuery := `
		SELECT COALESCE(country, 'Unknown') as country, COUNT(*) as views, COUNT(DISTINCT visitor_id) as unique_visitors
		FROM events 
		WHERE website_id = ANY($1)
		GROUP BY COALESCE(country, 'Unknown')
		ORDER BY views DESC 
		LIMIT 20
	`

	rows, err = r.db.Query(context.Background(), countriesQuery, websiteIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to query countries: %w", err)
	}
	defer rows.Close()

	var countries []map[string]interface{}
	for rows.Next() {
		var country string
		var views, unique int
		if err := rows.Scan(&country, &views, &unique); err != nil {
			return nil, fmt.Errorf("failed to scan country: %w", err)
		}
		countries = append(countries, map[string]interface{}{
			"country":         country,
			"views":           views,
			"unique_visitors": unique,
		})
	}
	analyticsData["countries"] = countries

	// Get browsers
	browsersQuery := `
		SELECT COALESCE(browser, 'Unknown') as browser, COUNT(*) as views, COUNT(DISTINCT visitor_id) as unique_visitors
		FROM events 
		WHERE website_id = ANY($1)
		GROUP BY COALESCE(browser, 'Unknown')
		ORDER BY views DESC 
		LIMIT 15
	`

	rows, err = r.db.Query(context.Background(), browsersQuery, websiteIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to query browsers: %w", err)
	}
	defer rows.Close()

	var browsers []map[string]interface{}
	for rows.Next() {
		var browser string
		var views, unique int
		if err := rows.Scan(&browser, &views, &unique); err != nil {
			return nil, fmt.Errorf("failed to scan browser: %w", err)
		}
		browsers = append(browsers, map[string]interface{}{
			"browser":         browser,
			"views":           views,
			"unique_visitors": unique,
		})
	}
	analyticsData["browsers"] = browsers

	// Get devices
	devicesQuery := `
		SELECT COALESCE(device, 'Unknown') as device, COUNT(*) as views, COUNT(DISTINCT visitor_id) as unique_visitors
		FROM events 
		WHERE website_id = ANY($1)
		GROUP BY COALESCE(device, 'Unknown')
		ORDER BY views DESC 
		LIMIT 10
	`

	rows, err = r.db.Query(context.Background(), devicesQuery, websiteIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to query devices: %w", err)
	}
	defer rows.Close()

	var devices []map[string]interface{}
	for rows.Next() {
		var device string
		var views, unique int
		if err := rows.Scan(&device, &views, &unique); err != nil {
			return nil, fmt.Errorf("failed to scan device: %w", err)
		}
		devices = append(devices, map[string]interface{}{
			"device":          device,
			"views":           views,
			"unique_visitors": unique,
		})
	}
	analyticsData["devices"] = devices

	// Get custom events
	customEventsQuery := `
		SELECT event_type, COUNT(*) as count
		FROM events 
		WHERE website_id = ANY($1) AND event_type != 'pageview'
		GROUP BY event_type
		ORDER BY count DESC
	`

	rows, err = r.db.Query(context.Background(), customEventsQuery, websiteIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to query custom events: %w", err)
	}
	defer rows.Close()

	var customEvents []map[string]interface{}
	for rows.Next() {
		var eventType string
		var count int
		if err := rows.Scan(&eventType, &count); err != nil {
			return nil, fmt.Errorf("failed to scan custom event: %w", err)
		}
		customEvents = append(customEvents, map[string]interface{}{
			"event_type": eventType,
			"count":      count,
		})
	}
	analyticsData["custom_events"] = customEvents

	// Log the export operation
	r.LogPrivacyOperation("export_analytics", userID, fmt.Sprintf("Exported analytics data for %d websites", len(websiteIDs)))

	return []map[string]interface{}{
		{
			"user_id":     userID,
			"exported_at": time.Now().UTC().Format(time.RFC3339),
			"website_ids": websiteIDs,
			"data":        analyticsData,
		},
	}, nil
}

// ExportFunnelData exports all funnel data for a specific user
func (r *PrivacyRepository) ExportFunnelData(userID string) ([]map[string]interface{}, error) {
	// Get all websites owned by the user
	websiteIDs, err := r.GetUserWebsites(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user websites: %w", err)
	}

	if len(websiteIDs) == 0 {
		return []map[string]interface{}{
			{
				"user_id":     userID,
				"exported_at": time.Now().UTC().Format(time.RFC3339),
				"data":        map[string]interface{}{},
				"message":     "No websites found for user",
			},
		}, nil
	}

	funnelData := make(map[string]interface{})

	// Get funnel definitions
	funnelsQuery := `
		SELECT id, name, description, website_id, user_id, steps, is_active, created_at, updated_at
		FROM funnels 
		WHERE website_id = ANY($1)
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(context.Background(), funnelsQuery, websiteIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to query funnels: %w", err)
	}
	defer rows.Close()

	var funnels []map[string]interface{}
	for rows.Next() {
		var id, name, description, websiteID, userID string
		var stepsJSON []byte
		var isActive bool
		var createdAt, updatedAt time.Time

		err := rows.Scan(&id, &name, &description, &websiteID, &userID, &stepsJSON, &isActive, &createdAt, &updatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan funnel: %w", err)
		}

		var steps interface{}
		if len(stepsJSON) > 0 {
			if err := json.Unmarshal(stepsJSON, &steps); err != nil {
				return nil, fmt.Errorf("failed to unmarshal funnel steps: %w", err)
			}
		}

		funnels = append(funnels, map[string]interface{}{
			"id":          id,
			"name":        name,
			"description": description,
			"website_id":  websiteID,
			"user_id":     userID,
			"steps":       steps,
			"is_active":   isActive,
			"created_at":  createdAt,
			"updated_at":  updatedAt,
		})
	}
	funnelData["funnels"] = funnels

	// Get funnel conversion statistics
	conversionQuery := `
		SELECT 
			f.id as funnel_id,
			f.name as funnel_name,
			COUNT(fe.id) as total_starts,
			COUNT(CASE WHEN fe.converted = true THEN 1 END) as conversions,
			CASE 
				WHEN COUNT(fe.id) > 0 THEN 
					ROUND((COUNT(CASE WHEN fe.converted = true THEN 1 END)::float / COUNT(fe.id)) * 100, 2)
				ELSE 0 
			END as conversion_rate
		FROM funnels f
		LEFT JOIN funnel_events fe ON f.id = fe.funnel_id
		WHERE f.website_id = ANY($1)
		GROUP BY f.id, f.name
		ORDER BY conversions DESC
	`

	rows, err = r.db.Query(context.Background(), conversionQuery, websiteIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to query funnel conversions: %w", err)
	}
	defer rows.Close()

	var conversions []map[string]interface{}
	totalConversions := 0
	totalStarts := 0

	for rows.Next() {
		var funnelID, funnelName string
		var starts, convs int
		var rate float64

		err := rows.Scan(&funnelID, &funnelName, &starts, &convs, &rate)
		if err != nil {
			return nil, fmt.Errorf("failed to scan funnel conversion: %w", err)
		}

		conversions = append(conversions, map[string]interface{}{
			"funnel_id":       funnelID,
			"funnel_name":     funnelName,
			"total_starts":    starts,
			"conversions":     convs,
			"conversion_rate": rate,
		})

		totalStarts += starts
		totalConversions += convs
	}
	funnelData["conversion_stats"] = conversions

	// Calculate overall conversion rate
	var overallRate float64
	if totalStarts > 0 {
		overallRate = float64(totalConversions) / float64(totalStarts) * 100
	}

	funnelData["total_conversions"] = totalConversions
	funnelData["total_starts"] = totalStarts
	funnelData["overall_conversion_rate"] = overallRate

	// Get funnel step analytics
	stepAnalyticsQuery := `
		SELECT 
			f.id as funnel_id,
			f.name as funnel_name,
			fe.current_step,
			COUNT(*) as step_count,
			COUNT(DISTINCT fe.visitor_id) as unique_visitors
		FROM funnels f
		JOIN funnel_events fe ON f.id = fe.funnel_id
		WHERE f.website_id = ANY($1)
		GROUP BY f.id, f.name, fe.current_step
		ORDER BY f.name, fe.current_step
	`

	rows, err = r.db.Query(context.Background(), stepAnalyticsQuery, websiteIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to query funnel step analytics: %w", err)
	}
	defer rows.Close()

	var stepAnalytics []map[string]interface{}
	for rows.Next() {
		var funnelID, funnelName string
		var currentStep, stepCount, uniqueVisitors int

		err := rows.Scan(&funnelID, &funnelName, &currentStep, &stepCount, &uniqueVisitors)
		if err != nil {
			return nil, fmt.Errorf("failed to scan funnel step: %w", err)
		}

		stepAnalytics = append(stepAnalytics, map[string]interface{}{
			"funnel_id":       funnelID,
			"funnel_name":     funnelName,
			"current_step":    currentStep,
			"step_count":      stepCount,
			"unique_visitors": uniqueVisitors,
		})
	}
	funnelData["step_analytics"] = stepAnalytics

	// Log the export operation
	r.LogPrivacyOperation("export_funnels", userID, fmt.Sprintf("Exported funnel data for %d websites", len(websiteIDs)))

	return []map[string]interface{}{
		{
			"user_id":     userID,
			"exported_at": time.Now().UTC().Format(time.RFC3339),
			"website_ids": websiteIDs,
			"data":        funnelData,
		},
	}, nil
}
