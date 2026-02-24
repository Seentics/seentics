package privacy

import (
	"context"
	"fmt"
)

// DeleteEventsData deletes all events data for websites owned by a specific user
func (r *PrivacyRepository) DeleteEventsData(userID string) error {
	// Since we don't have a websites table in analytics service, we'll call the user service
	// to get the website IDs for this user, then delete all events for those websites
	websiteIDs, err := r.GetUserWebsitesFromUserService(userID)
	if err != nil {
		return nil // Don't fail the entire operation if we can't get websites
	}

	if len(websiteIDs) == 0 {
		return nil
	}

	// Delete all events for user's websites
	deleteQuery := `DELETE FROM events WHERE website_id = ANY($1)`
	_, err = r.db.Exec(context.Background(), deleteQuery, websiteIDs)
	if err != nil {
		return fmt.Errorf("failed to delete events: %w", err)
	}

	return nil
}

// DeleteEventsDataForWebsite deletes all events data for a specific website
func (r *PrivacyRepository) DeleteEventsDataForWebsite(websiteID string) error {
	// Delete all events for this website
	deleteQuery := `DELETE FROM events WHERE website_id = $1`
	_, err := r.db.Exec(context.Background(), deleteQuery, websiteID)
	if err != nil {
		return fmt.Errorf("failed to delete events for website %s: %w", websiteID, err)
	}

	return nil
}

// DeleteAnalyticsData deletes all analytics data for a specific user
func (r *PrivacyRepository) DeleteAnalyticsData(userID string) error {
	// Get website IDs for this user
	websiteIDs, err := r.GetUserWebsitesFromUserService(userID)
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
	websiteIDs, err := r.GetUserWebsitesFromUserService(userID)
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
	websiteIDs, err := r.GetUserWebsitesFromUserService(userID)
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

	return nil
}
