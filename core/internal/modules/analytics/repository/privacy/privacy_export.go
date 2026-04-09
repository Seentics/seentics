package privacy

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

// ExportEventsData returns a placeholder: raw events live in ClickHouse and are
// not accessible from the PostgreSQL-only PrivacyRepository. Event data can be
// exported separately via the admin/internal endpoints that have ClickHouse access.
func (r *PrivacyRepository) ExportEventsData(userID string) ([]map[string]interface{}, error) {
	r.LogPrivacyOperation("export_events", userID, "skipped: events are ClickHouse-backed")
	return []map[string]interface{}{
		{
			"user_id":     userID,
			"exported_at": time.Now().UTC().Format(time.RFC3339),
			"message":     "Raw event export not available: events are stored in ClickHouse",
			"data":        []interface{}{},
		},
	}, nil
}

// ExportAnalyticsData returns a placeholder: aggregated analytics are served
// from ClickHouse, not PostgreSQL. Per-user analytics summaries can be obtained
// via the analytics API endpoints which have ClickHouse access.
func (r *PrivacyRepository) ExportAnalyticsData(userID string) ([]map[string]interface{}, error) {
	r.LogPrivacyOperation("export_analytics", userID, "skipped: analytics are ClickHouse-backed")
	return []map[string]interface{}{
		{
			"user_id":     userID,
			"exported_at": time.Now().UTC().Format(time.RFC3339),
			"message":     "Analytics summary export not available: data is served from ClickHouse",
			"data":        map[string]interface{}{},
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

// ExportSessionsData exports all session data for a specific user
func (r *PrivacyRepository) ExportSessionsData(userID string) ([]map[string]interface{}, error) {
	websiteIDs, err := r.GetUserWebsites(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user websites: %w", err)
	}
	if len(websiteIDs) == 0 {
		return []map[string]interface{}{{"user_id": userID, "exported_at": time.Now().UTC().Format(time.RFC3339), "data": []interface{}{}, "message": "No websites found"}}, nil
	}

	query := `
		SELECT id, website_id, visitor_id, session_id, start_time, entry_time, exit_time, created_at
		FROM sessions
		WHERE website_id = ANY($1)
		ORDER BY start_time DESC
	`
	rows, err := r.db.Query(context.Background(), query, websiteIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to query sessions: %w", err)
	}
	defer rows.Close()

	var sessions []map[string]interface{}
	for rows.Next() {
		var id, websiteID, visitorID, sessionID string
		var startTime, entryTime, exitTime, createdAt time.Time
		if err := rows.Scan(&id, &websiteID, &visitorID, &sessionID, &startTime, &entryTime, &exitTime, &createdAt); err != nil {
			return nil, fmt.Errorf("failed to scan session: %w", err)
		}
		sessions = append(sessions, map[string]interface{}{
			"id": id, "website_id": websiteID, "visitor_id": visitorID, "session_id": sessionID,
			"start_time": startTime, "entry_time": entryTime, "exit_time": exitTime, "created_at": createdAt,
		})
	}

	r.LogPrivacyOperation("export_sessions", userID, fmt.Sprintf("Exported %d sessions for %d websites", len(sessions), len(websiteIDs)))
	return []map[string]interface{}{{"user_id": userID, "exported_at": time.Now().UTC().Format(time.RFC3339), "website_ids": websiteIDs, "sessions_count": len(sessions), "data": sessions}}, nil
}

// ExportHeatmapData exports all heatmap data for a specific user
func (r *PrivacyRepository) ExportHeatmapData(userID string) ([]map[string]interface{}, error) {
	websiteIDs, err := r.GetUserWebsites(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user websites: %w", err)
	}
	if len(websiteIDs) == 0 {
		return []map[string]interface{}{{"user_id": userID, "exported_at": time.Now().UTC().Format(time.RFC3339), "data": map[string]interface{}{}, "message": "No websites found"}}, nil
	}

	// Export heatmap points
	pointsQuery := `
		SELECT website_id, page_path, event_type, device_type, x_percent, y_percent,
		       target_selector, intensity, el_x, el_y, doc_height, last_updated
		FROM heatmap_points
		WHERE website_id::text = ANY($1)
		ORDER BY last_updated DESC
	`
	rows, err := r.db.Query(context.Background(), pointsQuery, websiteIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to query heatmap points: %w", err)
	}
	defer rows.Close()

	var points []map[string]interface{}
	for rows.Next() {
		var websiteID, pagePath, eventType, deviceType, selector string
		var xPct, yPct, intensity, elX, elY, docHeight int
		var lastUpdated time.Time
		if err := rows.Scan(&websiteID, &pagePath, &eventType, &deviceType, &xPct, &yPct, &selector, &intensity, &elX, &elY, &docHeight, &lastUpdated); err != nil {
			return nil, fmt.Errorf("failed to scan heatmap point: %w", err)
		}
		points = append(points, map[string]interface{}{
			"website_id": websiteID, "page_path": pagePath, "event_type": eventType, "device_type": deviceType,
			"x_percent": xPct, "y_percent": yPct, "target_selector": selector, "intensity": intensity,
			"el_x": elX, "el_y": elY, "doc_height": docHeight, "last_updated": lastUpdated,
		})
	}

	// Export heatmap sessions
	sessionsQuery := `
		SELECT id, website_id, session_id, page_path, screen_width, screen_height, created_at
		FROM heatmap_sessions
		WHERE website_id::text = ANY($1)
		ORDER BY created_at DESC
	`
	rows, err = r.db.Query(context.Background(), sessionsQuery, websiteIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to query heatmap sessions: %w", err)
	}
	defer rows.Close()

	var heatmapSessions []map[string]interface{}
	for rows.Next() {
		var id, websiteID, sessionID, pagePath string
		var screenW, screenH int
		var createdAt time.Time
		if err := rows.Scan(&id, &websiteID, &sessionID, &pagePath, &screenW, &screenH, &createdAt); err != nil {
			return nil, fmt.Errorf("failed to scan heatmap session: %w", err)
		}
		heatmapSessions = append(heatmapSessions, map[string]interface{}{
			"id": id, "website_id": websiteID, "session_id": sessionID, "page_path": pagePath,
			"screen_width": screenW, "screen_height": screenH, "created_at": createdAt,
		})
	}

	r.LogPrivacyOperation("export_heatmaps", userID, fmt.Sprintf("Exported %d heatmap points, %d sessions for %d websites", len(points), len(heatmapSessions), len(websiteIDs)))
	return []map[string]interface{}{{
		"user_id": userID, "exported_at": time.Now().UTC().Format(time.RFC3339), "website_ids": websiteIDs,
		"data": map[string]interface{}{"points": points, "points_count": len(points), "sessions": heatmapSessions, "sessions_count": len(heatmapSessions)},
	}}, nil
}

// ExportReplayData exports all session replay metadata for a specific user (excludes raw JSONB data for size)
func (r *PrivacyRepository) ExportReplayData(userID string) ([]map[string]interface{}, error) {
	websiteIDs, err := r.GetUserWebsites(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user websites: %w", err)
	}
	if len(websiteIDs) == 0 {
		return []map[string]interface{}{{"user_id": userID, "exported_at": time.Now().UTC().Format(time.RFC3339), "data": []interface{}{}, "message": "No websites found"}}, nil
	}

	// Export replay metadata (grouped by session, no raw JSONB to keep size down)
	query := `
		SELECT website_id, session_id, COUNT(*) as chunk_count,
		       MIN(timestamp) as start_time, MAX(timestamp) as end_time,
		       MAX(browser) as browser, MAX(device) as device, MAX(os) as os,
		       MAX(country) as country, MAX(entry_page) as entry_page,
		       BOOL_OR(has_rage_clicks) as has_rage_clicks,
		       BOOL_OR(has_errors) as has_errors
		FROM session_replays
		WHERE website_id = ANY($1)
		GROUP BY website_id, session_id
		ORDER BY MIN(timestamp) DESC
	`
	rows, err := r.db.Query(context.Background(), query, websiteIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to query replays: %w", err)
	}
	defer rows.Close()

	var replays []map[string]interface{}
	for rows.Next() {
		var websiteID, sessionID string
		var chunkCount int
		var startTime, endTime time.Time
		var browser, device, os, country, entryPage *string
		var hasRageClicks, hasErrors *bool
		if err := rows.Scan(&websiteID, &sessionID, &chunkCount, &startTime, &endTime, &browser, &device, &os, &country, &entryPage, &hasRageClicks, &hasErrors); err != nil {
			return nil, fmt.Errorf("failed to scan replay: %w", err)
		}
		replays = append(replays, map[string]interface{}{
			"website_id": websiteID, "session_id": sessionID, "chunk_count": chunkCount,
			"start_time": startTime, "end_time": endTime, "browser": browser, "device": device,
			"os": os, "country": country, "entry_page": entryPage, "has_rage_clicks": hasRageClicks, "has_errors": hasErrors,
		})
	}

	r.LogPrivacyOperation("export_replays", userID, fmt.Sprintf("Exported %d replay sessions for %d websites", len(replays), len(websiteIDs)))
	return []map[string]interface{}{{"user_id": userID, "exported_at": time.Now().UTC().Format(time.RFC3339), "website_ids": websiteIDs, "replays_count": len(replays), "data": replays}}, nil
}

// ExportGoalData exports all goal definitions for a specific user
func (r *PrivacyRepository) ExportGoalData(userID string) ([]map[string]interface{}, error) {
	websiteIDs, err := r.GetUserWebsites(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user websites: %w", err)
	}
	if len(websiteIDs) == 0 {
		return []map[string]interface{}{{"user_id": userID, "exported_at": time.Now().UTC().Format(time.RFC3339), "data": []interface{}{}, "message": "No websites found"}}, nil
	}

	query := `
		SELECT id, website_id, name, type, identifier, selector, revenue, currency, created_at, updated_at
		FROM goals
		WHERE website_id::text = ANY($1)
		ORDER BY created_at DESC
	`
	rows, err := r.db.Query(context.Background(), query, websiteIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to query goals: %w", err)
	}
	defer rows.Close()

	var goals []map[string]interface{}
	for rows.Next() {
		var id, websiteID, name, goalType, identifier string
		var selector *string
		var revenue *float64
		var currency *string
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&id, &websiteID, &name, &goalType, &identifier, &selector, &revenue, &currency, &createdAt, &updatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan goal: %w", err)
		}
		goals = append(goals, map[string]interface{}{
			"id": id, "website_id": websiteID, "name": name, "type": goalType, "identifier": identifier,
			"selector": selector, "revenue": revenue, "currency": currency, "created_at": createdAt, "updated_at": updatedAt,
		})
	}

	r.LogPrivacyOperation("export_goals", userID, fmt.Sprintf("Exported %d goals for %d websites", len(goals), len(websiteIDs)))
	return []map[string]interface{}{{"user_id": userID, "exported_at": time.Now().UTC().Format(time.RFC3339), "website_ids": websiteIDs, "goals_count": len(goals), "data": goals}}, nil
}

// ExportWebsiteData exports all data for a specific website (used for per-website export)
func (r *PrivacyRepository) ExportWebsiteData(websiteID string) (map[string]interface{}, error) {
	ctx := context.Background()
	exportData := map[string]interface{}{
		"website_id":  websiteID,
		"exported_at": time.Now().UTC().Format(time.RFC3339),
	}

	// Events live in ClickHouse — not exported here.
	exportData["events"] = []interface{}{}
	exportData["events_count"] = 0
	exportData["events_note"] = "Raw events are stored in ClickHouse and not included in this export"

	// Sessions
	sessRows, err := r.db.Query(ctx, `SELECT id, website_id, visitor_id, session_id, start_time, entry_time, exit_time, created_at FROM sessions WHERE website_id = $1 ORDER BY start_time DESC`, websiteID)
	if err == nil {
		defer sessRows.Close()
		var sessions []map[string]interface{}
		for sessRows.Next() {
			var id, wID, vID, sID string
			var st, et, xt, ca time.Time
			if err := sessRows.Scan(&id, &wID, &vID, &sID, &st, &et, &xt, &ca); err == nil {
				sessions = append(sessions, map[string]interface{}{"id": id, "website_id": wID, "visitor_id": vID, "session_id": sID, "start_time": st, "entry_time": et, "exit_time": xt, "created_at": ca})
			}
		}
		exportData["sessions"] = sessions
		exportData["sessions_count"] = len(sessions)
	}

	// Goals
	goalRows, err := r.db.Query(ctx, `SELECT id, website_id, name, type, identifier, selector, revenue, currency, created_at, updated_at FROM goals WHERE website_id::text = $1 ORDER BY created_at DESC`, websiteID)
	if err == nil {
		defer goalRows.Close()
		var goals []map[string]interface{}
		for goalRows.Next() {
			var id, wID, name, gType, ident string
			var sel, cur *string
			var rev *float64
			var ca, ua time.Time
			if err := goalRows.Scan(&id, &wID, &name, &gType, &ident, &sel, &rev, &cur, &ca, &ua); err == nil {
				goals = append(goals, map[string]interface{}{"id": id, "website_id": wID, "name": name, "type": gType, "identifier": ident, "selector": sel, "revenue": rev, "currency": cur, "created_at": ca, "updated_at": ua})
			}
		}
		exportData["goals"] = goals
		exportData["goals_count"] = len(goals)
	}

	// Funnels
	funnelRows, err := r.db.Query(ctx, `SELECT id, name, description, website_id, user_id, steps, is_active, created_at, updated_at FROM funnels WHERE website_id = $1 ORDER BY created_at DESC`, websiteID)
	if err == nil {
		defer funnelRows.Close()
		var funnels []map[string]interface{}
		for funnelRows.Next() {
			var id, name, desc, wID, uID string
			var stepsJSON []byte
			var active bool
			var ca, ua time.Time
			if err := funnelRows.Scan(&id, &name, &desc, &wID, &uID, &stepsJSON, &active, &ca, &ua); err == nil {
				var steps interface{}
				if len(stepsJSON) > 0 {
					json.Unmarshal(stepsJSON, &steps)
				}
				funnels = append(funnels, map[string]interface{}{"id": id, "name": name, "description": desc, "website_id": wID, "user_id": uID, "steps": steps, "is_active": active, "created_at": ca, "updated_at": ua})
			}
		}
		exportData["funnels"] = funnels
		exportData["funnels_count"] = len(funnels)
	}

	// Heatmap points
	hpRows, err := r.db.Query(ctx, `SELECT website_id, page_path, event_type, device_type, x_percent, y_percent, target_selector, intensity, el_x, el_y, doc_height, last_updated FROM heatmap_points WHERE website_id::text = $1`, websiteID)
	if err == nil {
		defer hpRows.Close()
		var points []map[string]interface{}
		for hpRows.Next() {
			var wID, pp, et, dt, sel string
			var xp, yp, inten, ex, ey, dh int
			var lu time.Time
			if err := hpRows.Scan(&wID, &pp, &et, &dt, &xp, &yp, &sel, &inten, &ex, &ey, &dh, &lu); err == nil {
				points = append(points, map[string]interface{}{"website_id": wID, "page_path": pp, "event_type": et, "device_type": dt, "x_percent": xp, "y_percent": yp, "target_selector": sel, "intensity": inten, "el_x": ex, "el_y": ey, "doc_height": dh, "last_updated": lu})
			}
		}
		exportData["heatmap_points"] = points
		exportData["heatmap_points_count"] = len(points)
	}

	// Replay metadata
	rpRows, err := r.db.Query(ctx, `
		SELECT website_id, session_id, COUNT(*) as chunks, MIN(timestamp) as start_time, MAX(timestamp) as end_time,
		       MAX(browser) as browser, MAX(device) as device, MAX(os) as os, MAX(country) as country,
		       MAX(entry_page) as entry_page, BOOL_OR(has_rage_clicks) as has_rage_clicks,
		       BOOL_OR(has_errors) as has_errors
		FROM session_replays WHERE website_id = $1
		GROUP BY website_id, session_id ORDER BY MIN(timestamp) DESC
	`, websiteID)
	if err == nil {
		defer rpRows.Close()
		var replays []map[string]interface{}
		for rpRows.Next() {
			var wID, sID string
			var chunks int
			var st, et time.Time
			var br, dv, os, co, ep *string
			var rage, errs *bool
			if err := rpRows.Scan(&wID, &sID, &chunks, &st, &et, &br, &dv, &os, &co, &ep, &rage, &errs); err == nil {
				replays = append(replays, map[string]interface{}{"website_id": wID, "session_id": sID, "chunk_count": chunks, "start_time": st, "end_time": et, "browser": br, "device": dv, "os": os, "country": co, "entry_page": ep, "has_rage_clicks": rage, "has_errors": errs})
			}
		}
		exportData["replays"] = replays
		exportData["replays_count"] = len(replays)
	}

	return exportData, nil
}
