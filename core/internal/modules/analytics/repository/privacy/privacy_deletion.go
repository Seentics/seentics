package privacy

import (
	"context"
	"fmt"
)

// DeleteEventsData is a no-op at the PostgreSQL layer: events are stored in
// ClickHouse, not PostgreSQL. To delete ClickHouse events for a user's websites,
// call EventRepository.DeleteByWebsiteID from the service layer.
func (r *PrivacyRepository) DeleteEventsData(userID string) error {
	return nil
}

// DeleteEventsDataForWebsite is a no-op at the PostgreSQL layer: events are
// stored in ClickHouse. Call EventRepository.DeleteByWebsiteID from the service layer.
func (r *PrivacyRepository) DeleteEventsDataForWebsite(websiteID string) error {
	return nil
}

// DeleteAnalyticsData deletes all analytics data for a specific user
func (r *PrivacyRepository) DeleteAnalyticsData(userID string) error {
	// Get website IDs for this user
	websiteIDs, err := r.GetUserWebsites(userID)
	if err != nil {
		return nil
	}

	if len(websiteIDs) == 0 {
		return nil
	}

	// Delete custom events aggregated data
	deleteCustomEventsQuery := `DELETE FROM custom_events_aggregated WHERE website_id = ANY($1)`
	_, err = r.db.Exec(context.Background(), deleteCustomEventsQuery, websiteIDs)
	if err != nil {
		return fmt.Errorf("failed to delete custom events: %w", err)
	}

	return nil
}

// DeleteAnalyticsDataForWebsite deletes all analytics data for a specific website
func (r *PrivacyRepository) DeleteAnalyticsDataForWebsite(websiteID string) error {
	// Delete custom events aggregated data
	deleteCustomEventsQuery := `DELETE FROM custom_events_aggregated WHERE website_id = $1`
	_, err := r.db.Exec(context.Background(), deleteCustomEventsQuery, websiteID)
	if err != nil {
		return fmt.Errorf("failed to delete custom events for website %s: %w", websiteID, err)
	}

	return nil
}

// DeleteFunnelData deletes all funnel data for a specific user
func (r *PrivacyRepository) DeleteFunnelData(userID string) error {
	// Get website IDs for this user
	websiteIDs, err := r.GetUserWebsites(userID)
	if err != nil {
		return nil
	}

	if len(websiteIDs) == 0 {
		return nil
	}

	// Delete funnel events first (due to foreign key constraint)
	deleteFunnelEventsQuery := `
		DELETE FROM funnel_events 
		WHERE funnel_id IN (
			SELECT id FROM funnels WHERE website_id = ANY($1)
		)
	`

	_, err = r.db.Exec(context.Background(), deleteFunnelEventsQuery, websiteIDs)
	if err != nil {
		return fmt.Errorf("failed to delete funnel events: %w", err)
	}

	// Delete funnels
	deleteFunnelsQuery := `DELETE FROM funnels WHERE website_id = ANY($1)`

	_, err = r.db.Exec(context.Background(), deleteFunnelsQuery, websiteIDs)
	if err != nil {
		return fmt.Errorf("failed to delete funnels: %w", err)
	}

	return nil
}

// DeleteFunnelDataForWebsite deletes all funnel data for a specific website
func (r *PrivacyRepository) DeleteFunnelDataForWebsite(websiteID string) error {
	// Delete funnel events first (due to foreign key constraint)
	deleteFunnelEventsQuery := `
		DELETE FROM funnel_events 
		WHERE funnel_id IN (
			SELECT id FROM funnels WHERE website_id = $1
		)
	`

	_, err := r.db.Exec(context.Background(), deleteFunnelEventsQuery, websiteID)
	if err != nil {
		return fmt.Errorf("failed to delete funnel events for website %s: %w", websiteID, err)
	}

	// Delete funnels
	deleteFunnelsQuery := `DELETE FROM funnels WHERE website_id = $1`

	_, err = r.db.Exec(context.Background(), deleteFunnelsQuery, websiteID)
	if err != nil {
		return fmt.Errorf("failed to delete funnels for website %s: %w", websiteID, err)
	}

	return nil
}

// DeleteUserData deletes all analytics data for a specific user
func (r *PrivacyRepository) DeleteUserData(userID string) error {

	// Get website IDs for this user
	websiteIDs, err := r.GetUserWebsites(userID)
	if err != nil {
		return fmt.Errorf("failed to get user websites: %w", err)
	}

	if len(websiteIDs) == 0 {
		return nil
	}

	// Delete analytics data for each website
	for _, websiteID := range websiteIDs {
		if err := r.DeleteWebsiteData(websiteID); err != nil {
			return fmt.Errorf("failed to delete data for website %s: %w", websiteID, err)
		}
	}

	return nil
}

// DeleteSessionsDataForWebsite deletes all session data for a specific website
func (r *PrivacyRepository) DeleteSessionsDataForWebsite(websiteID string) error {
	_, err := r.db.Exec(context.Background(), `DELETE FROM sessions WHERE website_id = $1`, websiteID)
	if err != nil {
		return fmt.Errorf("failed to delete sessions for website %s: %w", websiteID, err)
	}
	return nil
}

// DeleteHeatmapDataForWebsite deletes all heatmap data for a specific website
func (r *PrivacyRepository) DeleteHeatmapDataForWebsite(websiteID string) error {
	_, err := r.db.Exec(context.Background(), `DELETE FROM heatmap_points WHERE website_id::text = $1`, websiteID)
	if err != nil {
		return fmt.Errorf("failed to delete heatmap points for website %s: %w", websiteID, err)
	}
	_, err = r.db.Exec(context.Background(), `DELETE FROM heatmap_sessions WHERE website_id::text = $1`, websiteID)
	if err != nil {
		return fmt.Errorf("failed to delete heatmap sessions for website %s: %w", websiteID, err)
	}
	return nil
}

// DeleteReplayDataForWebsite deletes all session replay data for a specific website
func (r *PrivacyRepository) DeleteReplayDataForWebsite(websiteID string) error {
	_, err := r.db.Exec(context.Background(), `DELETE FROM session_replays WHERE website_id = $1`, websiteID)
	if err != nil {
		return fmt.Errorf("failed to delete replays for website %s: %w", websiteID, err)
	}
	return nil
}

// DeleteGoalDataForWebsite deletes all goal data for a specific website
func (r *PrivacyRepository) DeleteGoalDataForWebsite(websiteID string) error {
	_, err := r.db.Exec(context.Background(), `DELETE FROM goals WHERE website_id::text = $1`, websiteID)
	if err != nil {
		return fmt.Errorf("failed to delete goals for website %s: %w", websiteID, err)
	}
	return nil
}

// DeleteWebsiteData deletes all analytics data for a specific website
func (r *PrivacyRepository) DeleteWebsiteData(websiteID string) error {

	// Delete events data
	if err := r.DeleteEventsDataForWebsite(websiteID); err != nil {
		return fmt.Errorf("failed to delete events for website %s: %w", websiteID, err)
	}

	// Delete analytics data
	if err := r.DeleteAnalyticsDataForWebsite(websiteID); err != nil {
		return fmt.Errorf("failed to delete analytics data for website %s: %w", websiteID, err)
	}

	// Delete funnel data
	if err := r.DeleteFunnelDataForWebsite(websiteID); err != nil {
		return fmt.Errorf("failed to delete funnel data for website %s: %w", websiteID, err)
	}

	// Delete session data
	if err := r.DeleteSessionsDataForWebsite(websiteID); err != nil {
		return fmt.Errorf("failed to delete sessions for website %s: %w", websiteID, err)
	}

	// Delete heatmap data
	if err := r.DeleteHeatmapDataForWebsite(websiteID); err != nil {
		return fmt.Errorf("failed to delete heatmaps for website %s: %w", websiteID, err)
	}

	// Delete replay data
	if err := r.DeleteReplayDataForWebsite(websiteID); err != nil {
		return fmt.Errorf("failed to delete replays for website %s: %w", websiteID, err)
	}

	// Delete goal data
	if err := r.DeleteGoalDataForWebsite(websiteID); err != nil {
		return fmt.Errorf("failed to delete goals for website %s: %w", websiteID, err)
	}

	return nil
}
