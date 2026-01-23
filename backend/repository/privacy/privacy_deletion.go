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
		fmt.Printf("Privacy operation: delete_events for user %s - Failed to get websites: %v\n", userID, err)
		return nil // Don't fail the entire operation if we can't get websites
	}

	if len(websiteIDs) == 0 {
		fmt.Printf("Privacy operation: delete_events for user %s - No websites found\n", userID)
		return nil
	}

	// Delete all events for user's websites
	deleteQuery := `DELETE FROM events WHERE website_id = ANY($1)`
	result, err := r.db.Exec(context.Background(), deleteQuery, websiteIDs)
	if err != nil {
		return fmt.Errorf("failed to delete events: %w", err)
	}

	rowsAffected := result.RowsAffected()
	fmt.Printf("Privacy operation: delete_events for user %s - Deleted %d events for %d websites\n", userID, rowsAffected, len(websiteIDs))

	return nil
}

// DeleteEventsDataForWebsite deletes all events data for a specific website
func (r *PrivacyRepository) DeleteEventsDataForWebsite(websiteID string) error {
	// Delete all events for this website
	deleteQuery := `DELETE FROM events WHERE website_id = $1`
	result, err := r.db.Exec(context.Background(), deleteQuery, websiteID)
	if err != nil {
		return fmt.Errorf("failed to delete events for website %s: %w", websiteID, err)
	}

	rowsAffected := result.RowsAffected()
	fmt.Printf("Privacy operation: delete_events for website %s - Deleted %d events\n", websiteID, rowsAffected)

	return nil
}

// DeleteAnalyticsData deletes all analytics data for a specific user
func (r *PrivacyRepository) DeleteAnalyticsData(userID string) error {
	// Get website IDs for this user
	websiteIDs, err := r.GetUserWebsitesFromUserService(userID)
	if err != nil {
		fmt.Printf("Privacy operation: delete_analytics for user %s - Failed to get websites: %v\n", userID, err)
		return nil
	}

	if len(websiteIDs) == 0 {
		fmt.Printf("Privacy operation: delete_analytics for user %s - No websites found\n", userID)
		return nil
	}

	// Delete custom events aggregated data
	deleteCustomEventsQuery := `DELETE FROM custom_events_aggregated WHERE website_id = ANY($1)`
	result, err := r.db.Exec(context.Background(), deleteCustomEventsQuery, websiteIDs)
	if err != nil {
		return fmt.Errorf("failed to delete custom events: %w", err)
	}

	customEventsDeleted := result.RowsAffected()
	fmt.Printf("Privacy operation: delete_analytics for user %s - Deleted %d custom events for %d websites\n", userID, customEventsDeleted, len(websiteIDs))

	return nil
}

// DeleteAnalyticsDataForWebsite deletes all analytics data for a specific website
func (r *PrivacyRepository) DeleteAnalyticsDataForWebsite(websiteID string) error {
	// Delete custom events aggregated data
	deleteCustomEventsQuery := `DELETE FROM custom_events_aggregated WHERE website_id = $1`
	result, err := r.db.Exec(context.Background(), deleteCustomEventsQuery, websiteID)
	if err != nil {
		return fmt.Errorf("failed to delete custom events for website %s: %w", websiteID, err)
	}

	customEventsDeleted := result.RowsAffected()
	fmt.Printf("Privacy operation: delete_analytics for website %s - Deleted %d custom events\n", websiteID, customEventsDeleted)

	return nil
}

// DeleteFunnelData deletes all funnel data for a specific user
func (r *PrivacyRepository) DeleteFunnelData(userID string) error {
	// Get website IDs for this user
	websiteIDs, err := r.GetUserWebsitesFromUserService(userID)
	if err != nil {
		fmt.Printf("Privacy operation: delete_funnels for user %s - Failed to get websites: %v\n", userID, err)
		return nil
	}

	if len(websiteIDs) == 0 {
		fmt.Printf("Privacy operation: delete_funnels for user %s - No websites found\n", userID)
		return nil
	}

	// Delete funnel events first (due to foreign key constraint)
	deleteFunnelEventsQuery := `
		DELETE FROM funnel_events 
		WHERE funnel_id IN (
			SELECT id FROM funnels WHERE website_id = ANY($1)
		)
	`

	result, err := r.db.Exec(context.Background(), deleteFunnelEventsQuery, websiteIDs)
	if err != nil {
		return fmt.Errorf("failed to delete funnel events: %w", err)
	}
	funnelEventsDeleted := result.RowsAffected()

	// Delete funnels
	deleteFunnelsQuery := `DELETE FROM funnels WHERE website_id = ANY($1)`

	result, err = r.db.Exec(context.Background(), deleteFunnelsQuery, websiteIDs)
	if err != nil {
		return fmt.Errorf("failed to delete funnels: %w", err)
	}
	funnelsDeleted := result.RowsAffected()

	fmt.Printf("Privacy operation: delete_funnels for user %s - Deleted %d funnels and %d funnel events for %d websites\n", userID, funnelsDeleted, funnelEventsDeleted, len(websiteIDs))

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

	result, err := r.db.Exec(context.Background(), deleteFunnelEventsQuery, websiteID)
	if err != nil {
		return fmt.Errorf("failed to delete funnel events for website %s: %w", websiteID, err)
	}
	funnelEventsDeleted := result.RowsAffected()

	// Delete funnels
	deleteFunnelsQuery := `DELETE FROM funnels WHERE website_id = $1`

	result, err = r.db.Exec(context.Background(), deleteFunnelsQuery, websiteID)
	if err != nil {
		return fmt.Errorf("failed to delete funnels for website %s: %w", websiteID, err)
	}
	funnelsDeleted := result.RowsAffected()

	fmt.Printf("Privacy operation: delete_funnels for website %s - Deleted %d funnels and %d funnel events\n", websiteID, funnelsDeleted, funnelEventsDeleted)

	return nil
}

// DeleteUserData deletes all analytics data for a specific user
func (r *PrivacyRepository) DeleteUserData(userID string) error {
	fmt.Printf("🗑️ Starting privacy deletion for user: %s\n", userID)

	// Get website IDs for this user
	websiteIDs, err := r.GetUserWebsitesFromUserService(userID)
	if err != nil {
		fmt.Printf("❌ Failed to get user websites: %v\n", err)
		return fmt.Errorf("failed to get user websites: %w", err)
	}

	if len(websiteIDs) == 0 {
		fmt.Printf("ℹ️ No websites found for user %s\n", userID)
		return nil
	}

	fmt.Printf("🔍 Found %d websites for user %s: %v\n", len(websiteIDs), userID, websiteIDs)

	// Delete analytics data for each website
	for _, websiteID := range websiteIDs {
		if err := r.DeleteWebsiteData(websiteID); err != nil {
			return fmt.Errorf("failed to delete data for website %s: %w", websiteID, err)
		}
	}

	fmt.Printf("✅ Privacy deletion completed for user: %s\n", userID)
	return nil
}

// DeleteWebsiteData deletes all analytics data for a specific website
func (r *PrivacyRepository) DeleteWebsiteData(websiteID string) error {
	fmt.Printf("🗑️ Starting privacy deletion for website: %s\n", websiteID)

	// Delete events data
	if err := r.DeleteEventsDataForWebsite(websiteID); err != nil {
		fmt.Printf("❌ Failed to delete events for website %s: %v\n", websiteID, err)
		return fmt.Errorf("failed to delete events for website %s: %w", websiteID, err)
	}

	// Delete analytics data
	if err := r.DeleteAnalyticsDataForWebsite(websiteID); err != nil {
		fmt.Printf("❌ Failed to delete analytics data for website %s: %v\n", websiteID, err)
		return fmt.Errorf("failed to delete analytics data for website %s: %w", websiteID, err)
	}

	// Delete funnel data
	if err := r.DeleteFunnelDataForWebsite(websiteID); err != nil {
		fmt.Printf("❌ Failed to delete funnel data for website %s: %v\n", websiteID, err)
		return fmt.Errorf("failed to delete funnel data for website %s: %w", websiteID, err)
	}

	fmt.Printf("✅ Successfully deleted analytics data for website: %s\n", websiteID)
	return nil
}
